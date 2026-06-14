import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { BotClient } from '../types/index.js';
import { TypeColors } from '../utils/embeds.js';
import { REDIS_KEYS, REDIS_TTLS, deserializeSpawn, serializeSpawn } from '../utils/redisKeys.js';
import { addXp } from './userService.js';
import { checkAndAwardAchievements } from './achievementService.js';
import { incrementQuestProgress } from './questService.js';

const MESSAGE_SPAWN_CHANCE = 0.05;

export async function handleSpawnMessage(message: Message, client: BotClient) {
  if (!message.guild || Math.random() > MESSAGE_SPAWN_CHANCE) return;

  const guild = await client.prisma.guild.findUnique({ where: { id: message.guild.id } });
  if (!guild?.spawnEnabled) return;

  const channelId = guild.pokeSpawnsChannelId || message.channel.id;
  const spawnChannel = message.guild.channels.cache.get(channelId);
  if (!spawnChannel?.isTextBased()) return;

  const cooldownKey = `spawn:cooldown:${message.guild.id}`;
  if (await client.redis.get(cooldownKey)) return;

  await client.redis.set(cooldownKey, '1', { EX: guild.spawnCooldown });

  await spawnPokemon(client, message.guild.id, channelId);
}

export async function spawnPokemon(client: BotClient, guildId: string, channelId: string) {
  try {
    const guild = await client.prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) return;

    const pokemon = await selectRandomPokemon(client, guild.shinyRate, guild.legendaryRate, guild.mythicalRate);
    if (!pokemon) return;

    const isShiny = Math.random() < guild.shinyRate;
    const imageUrl = isShiny ? pokemon.shinyArtworkUrl : pokemon.artworkUrl;

    const embed = new EmbedBuilder()
      .setColor((TypeColors[pokemon.type1] as number) || 0xffcb05)
      .setTitle(isShiny ? '✨ A wild Shiny Pokemon appeared!' : '⚡ A wild Pokemon appeared!')
      .setDescription(
        `**Type${pokemon.type2 ? 's' : ''}:** ${[pokemon.type1, pokemon.type2].filter((type): type is string => Boolean(type)).map(capitalize).join(' / ')}\n\nQuick! Use **/catch** to capture it!`
      )
      .setImage(imageUrl ?? null)
      .setFooter({ text: `This Pokemon will disappear in 5 minutes!` })
      .setTimestamp();

    if (isShiny) {
      embed.addFields({ name: '✨ Shiny!', value: 'This is a rare shiny Pokemon!', inline: true });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`catch:${pokemon.id}:${isShiny}`)
        .setLabel('Catch!')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎾')
    );

    const discordGuild = client.guilds.cache.get(guildId);
    if (!discordGuild) return;
    const channel = discordGuild.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return;

    const msg = await channel.send({ embeds: [embed], components: [row] });

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const spawn = await client.prisma.spawn.create({
      data: {
        guildId,
        channelId,
        messageId: msg.id,
        pokemonId: pokemon.id,
        isShiny,
        expiresAt,
      },
    });

    const spawnState = {
      pokemonId: pokemon.id,
      isShiny,
      spawnId: spawn.id,
      guildId,
      channelId,
      messageId: msg.id,
      expiresAt,
    };
    
    const spawnKey = REDIS_KEYS.spawn(msg.id);
    const guildSpawnKey = REDIS_KEYS.guildSpawn(guildId);
    await client.redis
      .multi()
      .set(spawnKey, serializeSpawn(spawnState), { EX: REDIS_TTLS.SPAWN })
      .set(guildSpawnKey, msg.id, { EX: REDIS_TTLS.SPAWN })
      .exec();

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000,
    });

    collector.on('collect', async (interaction) => {
      const customId = interaction.customId;
      if (!customId.startsWith('catch:')) return;

      await interaction.deferReply({ ephemeral: true });

      // GETDEL atomically claims the spawn so only one interaction can catch it.
      try {
        const spawnData = await client.redis.sendCommand(['GETDEL', spawnKey]) as string | null;
        if (!spawnData) {
          await interaction.editReply('This Pokemon has already been caught or ran away!');
          return;
        }
        
        const activeSpawn = deserializeSpawn(spawnData);
        if (!activeSpawn) {
          await interaction.editReply('This Pokemon has already been caught or ran away!');
          return;
        }

        const dbSpawn = await client.prisma.spawn.findUnique({ where: { id: activeSpawn.spawnId } });
        if (!dbSpawn || dbSpawn.isCaught) {
          await interaction.editReply('This Pokemon has already been caught!');
          return;
        }

        // Catch the Pokemon
        collector.stop();

        const nature = ['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky'][Math.floor(Math.random() * 25)];

        const moves = await client.prisma.pokemonMove.findMany({
          where: { pokemonId: pokemon.id },
          orderBy: [{ learnLevel: 'asc' }, { moveName: 'asc' }],
          take: 4,
        });

        const userPokemon = await client.prisma.userPokemon.create({
          data: {
            userId: interaction.user.id,
            pokemonId: pokemon.id,
            isShiny,
            level: Math.floor(Math.random() * 30) + 1,
            nature,
            ivHp: Math.floor(Math.random() * 32),
            ivAttack: Math.floor(Math.random() * 32),
            ivDefense: Math.floor(Math.random() * 32),
            ivSpAttack: Math.floor(Math.random() * 32),
            ivSpDefense: Math.floor(Math.random() * 32),
            ivSpeed: Math.floor(Math.random() * 32),
            moves: moves.length > 0 ? moves.map((move) => move.moveName) : ['tackle', 'growl', 'scratch', 'quick-attack'],
          },
        });

        await client.prisma.spawn.update({
          where: { id: activeSpawn.spawnId },
          data: { isCaught: true, caughtById: interaction.user.id, caughtAt: new Date() },
        });

        const updatedUser = await client.prisma.user.update({
          where: { id: interaction.user.id },
          data: {
            pokemonCaught: { increment: 1 },
            shinyCaught: isShiny ? { increment: 1 } : undefined,
            legendariesCaught: pokemon.isLegendary ? { increment: 1 } : undefined,
          },
        });

        const catchXp = isShiny ? 100 : pokemon.isLegendary ? 500 : 25;
        const { leveledUp: catchLeveledUp, newLevel: catchNewLevel } = await addXp(client.prisma, interaction.user.id, catchXp);

        // Pokédex milestone rewards
        const POKEDEX_MILESTONES: Record<number, { coins: number; label: string }> = {
          10: { coins: 500, label: '10 Pokémon Caught!' },
          25: { coins: 1000, label: '25 Pokémon Caught!' },
          50: { coins: 2500, label: '50 Pokémon Caught!' },
          100: { coins: 5000, label: '100 Pokémon Caught!' },
          250: { coins: 15000, label: '250 Pokémon Caught!' },
          500: { coins: 50000, label: '500 Pokémon Caught!' },
        };
        const milestone = POKEDEX_MILESTONES[updatedUser.pokemonCaught];
        if (milestone) {
          await client.prisma.user.update({
            where: { id: interaction.user.id },
            data: { balance: { increment: milestone.coins }, totalEarned: { increment: milestone.coins } },
          });
        }

        await client.redis.del(guildSpawnKey);

        const catchEmbed = new EmbedBuilder()
          .setColor(isShiny ? 0xffd700 : 0x00ff00)
          .setTitle(isShiny ? `✨ Shiny ${pokemon.nameDisplay} caught!` : `🎉 ${pokemon.nameDisplay} caught!`)
          .setThumbnail(imageUrl ?? null)
          .addFields(
            { name: 'Level', value: `${userPokemon.level}`, inline: true },
            { name: 'Nature', value: nature, inline: true },
            { name: 'ID', value: `#${userPokemon.id.slice(0, 8)}`, inline: true },
            { name: '⭐ Trainer XP', value: `+${catchXp} XP`, inline: true },
          );

        if (catchLeveledUp) catchEmbed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Trainer Level ${catchNewLevel}**!`, inline: false });
        if (milestone) catchEmbed.addFields({ name: `📖 Pokédex Milestone: ${milestone.label}`, value: `+${milestone.coins.toLocaleString()} PokéCoins rewarded!`, inline: false });

        await interaction.editReply({ embeds: [catchEmbed] });

        // Check achievement milestones after catch (fire-and-forget)
        checkAndAwardAchievements(client, interaction.user.id, interaction.channelId, guildId).catch(() => {});
        // Advance 'catch' quests (fire-and-forget)
        incrementQuestProgress(client.prisma, interaction.user.id, 'catch', 1).catch(() => {});

        const caughtEmbed = new EmbedBuilder()
          .setColor(isShiny ? 0xffd700 : 0x00ff00)
          .setTitle(isShiny ? `✨ Shiny ${pokemon.nameDisplay} was caught!` : `${pokemon.nameDisplay} was caught!`)
          .setDescription(`<@${interaction.user.id}> caught the ${isShiny ? 'Shiny ' : ''}${pokemon.nameDisplay}!`)
          .setImage(imageUrl ?? null);

        await msg.edit({ embeds: [caughtEmbed], components: [] }).catch(() => {});
      } catch (err) {
        client.logger.error('Catch error:', err);
        await interaction.editReply('The catch failed unexpectedly. Please try again.');
      }
    });

    collector.on('end', async () => {
      await client.redis.del([spawnKey, guildSpawnKey]);
      const dbSpawn = await client.prisma.spawn.findUnique({ where: { id: spawn.id } });
      if (dbSpawn && !dbSpawn.isCaught) {
        await msg.edit({
          embeds: [
            new EmbedBuilder()
              .setColor(0x808080)
              .setTitle(`${pokemon.nameDisplay} fled!`)
              .setDescription('The Pokemon escaped into the wild...'),
          ],
          components: [],
        }).catch(() => {});
      }
    });
  } catch (err) {
    client.logger.error('Spawn error:', err);
  }
}

async function selectRandomPokemon(
  client: BotClient,
  _shinyRate: number,
  legendaryRate: number,
  mythicalRate: number
) {
  const roll = Math.random();
  let rarity: string;
  if (roll < mythicalRate) rarity = 'Mythical';
  else if (roll < mythicalRate + legendaryRate) rarity = 'Legendary';
  else if (roll < 0.05) rarity = 'Epic';
  else if (roll < 0.15) rarity = 'Rare';
  else rarity = 'Common';

  const count = await client.prisma.pokemon.count({ where: { rarity } });
  if (count === 0) return client.prisma.pokemon.findFirst();

  const skip = Math.floor(Math.random() * count);
  return client.prisma.pokemon.findFirst({ where: { rarity }, skip });
}

export function startSpawnService(client: BotClient) {
  client.logger.info('Spawn service started');
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
