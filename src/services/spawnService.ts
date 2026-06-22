import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  Message,
  PermissionFlagsBits,
} from 'discord.js';
import type { Guild as GuildConfig, Pokemon } from '@prisma/client';
import type { BotClient } from '../types/index.js';
import { TypeColors } from '../utils/embeds.js';
import { REDIS_KEYS, REDIS_TTLS, serializeSpawn } from '../utils/redisKeys.js';
import { addXp, ensureUser } from './userService.js';
import { checkAndAwardAchievements } from './achievementService.js';
import { incrementQuestProgress } from './questService.js';

const SPAWN_LIFETIME_MS = REDIS_TTLS.SPAWN * 1000;
const POKEDEX_MILESTONES: Record<number, { coins: number; label: string }> = {
  10: { coins: 500, label: '10 Pokémon Caught!' },
  25: { coins: 1000, label: '25 Pokémon Caught!' },
  50: { coins: 2500, label: '50 Pokémon Caught!' },
  100: { coins: 5000, label: '100 Pokémon Caught!' },
  250: { coins: 15000, label: '250 Pokémon Caught!' },
  500: { coins: 50000, label: '500 Pokémon Caught!' },
};

type SpawnResult = { spawnId: string; messageId: string; channelId: string; pokemonName: string };

export function spawnChanceFromRate(spawnRate: number) {
  return Math.min(1, Math.max(0, spawnRate / 100));
}

export function configuredSpawnChannelIds(guild: Pick<GuildConfig, 'spawnChannelIds' | 'pokeSpawnsChannelId'>) {
  return [...new Set([
    ...guild.spawnChannelIds,
    ...(guild.pokeSpawnsChannelId ? [guild.pokeSpawnsChannelId] : []),
  ])];
}

export async function handleSpawnMessage(message: Message, client: BotClient) {
  if (!message.guild) return;

  const guild = await client.prisma.guild.findUnique({ where: { id: message.guild.id } });
  if (!guild?.spawnEnabled || Math.random() >= spawnChanceFromRate(guild.spawnRate)) return;

  const channelIds = selectActivitySpawnChannels(message.guild, guild, message.channel.id);
  if (channelIds.length === 0) return;
  if (!(await claimSpawnCooldown(client, guild))) return;

  const results = await Promise.allSettled(
    channelIds.map((channelId) => spawnPokemon(client, message.guild!.id, channelId))
  );
  const spawned = results.filter((result) => result.status === 'fulfilled' && result.value).length;
  if (spawned === 0) {
    await releaseSpawnCooldown(client, guild.id);
  }
}

function selectActivitySpawnChannels(discordGuild: Guild, config: GuildConfig, fallbackChannelId: string) {
  const configured = configuredSpawnChannelIds(config).filter((channelId) =>
    canSpawnInChannel(discordGuild, channelId)
  );
  const candidates = configured.length > 0
    ? configured
    : canSpawnInChannel(discordGuild, fallbackChannelId) ? [fallbackChannelId] : [];

  if (config.spawnMode === 'all') return candidates;
  if (candidates.length === 0) return [];
  return [candidates[Math.floor(Math.random() * candidates.length)]];
}

function canSpawnInChannel(guild: Guild, channelId: string) {
  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased() || channel.isDMBased()) return false;
  const me = guild.members.me;
  if (!me) return true;
  const permissions = channel.permissionsFor(me);
  return Boolean(
    permissions?.has(PermissionFlagsBits.ViewChannel)
    && permissions.has(PermissionFlagsBits.SendMessages)
    && permissions.has(PermissionFlagsBits.EmbedLinks)
  );
}

async function claimSpawnCooldown(client: BotClient, guild: GuildConfig) {
  const key = REDIS_KEYS.spawnCooldown(guild.id);
  if (client.redis.isReady) {
    const claimed = await client.redis.set(key, '1', { EX: guild.spawnCooldown, NX: true }).catch(() => null);
    if (claimed === 'OK') return true;
    if (claimed === null) client.logger.warn(`Redis spawn cooldown unavailable for guild ${guild.id}; using database fallback`);
    else return false;
  }

  const recent = await client.prisma.spawn.findFirst({
    where: { guildId: guild.id, spawnedAt: { gte: new Date(Date.now() - guild.spawnCooldown * 1000) } },
    select: { id: true },
  });
  return !recent;
}

async function releaseSpawnCooldown(client: BotClient, guildId: string) {
  if (client.redis.isReady) {
    await client.redis.del(REDIS_KEYS.spawnCooldown(guildId)).catch(() => {});
  }
}

export async function spawnPokemon(
  client: BotClient,
  guildId: string,
  channelId: string,
  forcedPokemon?: Pokemon,
): Promise<SpawnResult | null> {
  try {
    const [guild, discordGuild] = await Promise.all([
      client.prisma.guild.findUnique({ where: { id: guildId } }),
      Promise.resolve(client.guilds.cache.get(guildId)),
    ]);
    if (!guild || !discordGuild || !canSpawnInChannel(discordGuild, channelId)) return null;

    const channel = discordGuild.channels.cache.get(channelId);
    if (!channel?.isTextBased() || channel.isDMBased()) return null;

    const pokemon = forcedPokemon ?? await selectRandomPokemon(client, guild.legendaryRate, guild.mythicalRate);
    if (!pokemon) return null;

    const isShiny = Math.random() < guild.shinyRate;
    const expiresAt = new Date(Date.now() + SPAWN_LIFETIME_MS);
    const spawn = await client.prisma.spawn.create({
      data: { guildId, channelId, pokemonId: pokemon.id, isShiny, expiresAt },
    });

    const imageUrl = isShiny ? pokemon.shinyArtworkUrl : pokemon.artworkUrl;
    const embed = buildSpawnEmbed(pokemon, isShiny, imageUrl);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`catch_spawn:${spawn.id}`)
        .setLabel('Throw Poké Ball')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎾')
    );

    let msg;
    try {
      msg = await channel.send({ embeds: [embed], components: [row] });
    } catch (error) {
      await client.prisma.spawn.delete({ where: { id: spawn.id } }).catch(() => {});
      throw error;
    }

    await client.prisma.spawn.update({ where: { id: spawn.id }, data: { messageId: msg.id } });
    await cacheSpawn(client, {
      pokemonId: pokemon.id,
      isShiny,
      spawnId: spawn.id,
      guildId,
      channelId,
      messageId: msg.id,
      expiresAt,
    });

    setTimeout(() => {
      void expireSpawn(client, spawn.id).catch((err) => {
        client.logger.error(`Failed to expire spawn ${spawn.id}:`, err);
      });
    }, SPAWN_LIFETIME_MS);

    return { spawnId: spawn.id, messageId: msg.id, channelId, pokemonName: pokemon.nameDisplay };
  } catch (err) {
    client.logger.error(`Spawn error in guild ${guildId}, channel ${channelId}:`, err);
    return null;
  }
}

function buildSpawnEmbed(pokemon: Pokemon, isShiny: boolean, imageUrl: string | null) {
  const rarityLabel = pokemon.isLegendary ? 'Legendary energy fills the air…' :
    pokemon.isMythical ? 'A mythical presence has appeared…' :
    `${pokemon.rarity} encounter`;
  const embed = new EmbedBuilder()
    .setColor((TypeColors[pokemon.type1] as number) || 0xffcb05)
    .setTitle(isShiny ? '✨ Shiny Wild Encounter!' : '⚡ Wild Encounter!')
    .setDescription(
      `**${rarityLabel}**\n` +
      `**Type${pokemon.type2 ? 's' : ''}:** ${[pokemon.type1, pokemon.type2].filter(Boolean).map((type) => capitalize(type!)).join(' / ')}\n\n` +
      'First trainer to press **Throw Poké Ball** adds it to their Pokédex.'
    )
    .setImage(imageUrl)
    .setFooter({ text: 'Encounter expires in 5 minutes • Multiple wild Pokémon can be active' })
    .setTimestamp();
  if (isShiny) embed.addFields({ name: '✨ Shiny aura', value: 'An exceptionally rare color flashes through the grass!', inline: false });
  return embed;
}

async function cacheSpawn(client: BotClient, spawn: Parameters<typeof serializeSpawn>[0]) {
  if (!client.redis.isReady) return;
  await client.redis.set(
    REDIS_KEYS.spawn(spawn.messageId),
    serializeSpawn(spawn),
    { EX: REDIS_TTLS.SPAWN },
  ).catch((err) => client.logger.warn(`Could not cache spawn ${spawn.spawnId}: ${(err as Error).message}`));
}

export async function handleSpawnCatch(interaction: ButtonInteraction, client: BotClient) {
  if (!interaction.customId.startsWith('catch_spawn:')) return;
  await interaction.deferReply({ ephemeral: true });

  const spawnId = interaction.customId.slice('catch_spawn:'.length);
  const spawn = await client.prisma.spawn.findUnique({
    where: { id: spawnId },
    include: { guild: true },
  });
  if (!spawn || spawn.isCaught || spawn.expiresAt <= new Date()) {
    await interaction.editReply('This Pokémon has already been caught or fled.');
    return;
  }

  const pokemon = await client.prisma.pokemon.findUnique({ where: { id: spawn.pokemonId } });
  if (!pokemon) {
    await interaction.editReply('This encounter could not be found in the Pokédex.');
    return;
  }

  await ensureUser(client.prisma, interaction.user);
  const [shinyCharm, moves] = await Promise.all([
    spawn.isShiny ? null : client.prisma.userInventory.findUnique({
      where: { userId_itemId: { userId: interaction.user.id, itemId: 'shiny_charm' } },
    }),
    client.prisma.pokemonMove.findMany({
      where: { pokemonId: pokemon.id },
      orderBy: [{ learnLevel: 'asc' }, { moveName: 'asc' }],
      take: 4,
    }),
  ]);

  const finalIsShiny = spawn.isShiny || Boolean(
    shinyCharm?.quantity && Math.random() < spawn.guild.shinyRate * 3
  );
  const nature = randomNature();
  const caughtAt = new Date();

  try {
    const result = await client.prisma.$transaction(async (tx) => {
      const claimed = await tx.spawn.updateMany({
        where: { id: spawn.id, isCaught: false, expiresAt: { gt: caughtAt } },
        data: { isCaught: true, caughtById: interaction.user.id, caughtAt },
      });
      if (claimed.count !== 1) throw new Error('SPAWN_ALREADY_CLAIMED');

      const userPokemon = await tx.userPokemon.create({
        data: {
          userId: interaction.user.id,
          pokemonId: pokemon.id,
          isShiny: finalIsShiny,
          level: Math.floor(Math.random() * 30) + 1,
          nature,
          caughtIn: interaction.guild?.name ?? 'Wild encounter',
          ivHp: randomIv(),
          ivAttack: randomIv(),
          ivDefense: randomIv(),
          ivSpAttack: randomIv(),
          ivSpDefense: randomIv(),
          ivSpeed: randomIv(),
          moves: moves.length ? moves.map((move) => move.moveName) : ['tackle', 'growl', 'scratch', 'quick-attack'],
        },
      });
      const user = await tx.user.update({
        where: { id: interaction.user.id },
        data: {
          pokemonCaught: { increment: 1 },
          shinyCaught: finalIsShiny ? { increment: 1 } : undefined,
          legendariesCaught: pokemon.isLegendary ? { increment: 1 } : undefined,
        },
      });
      const milestone = POKEDEX_MILESTONES[user.pokemonCaught];
      if (milestone) {
        await tx.user.update({
          where: { id: interaction.user.id },
          data: { balance: { increment: milestone.coins }, totalEarned: { increment: milestone.coins } },
        });
      }
      return { userPokemon, user, milestone };
    });

    if (client.redis.isReady && spawn.messageId) {
      await client.redis.del(REDIS_KEYS.spawn(spawn.messageId)).catch(() => {});
    }

    const catchXp = finalIsShiny ? 100 : pokemon.isLegendary ? 500 : 25;
    const xp = await addXp(client.prisma, interaction.user.id, catchXp).catch((err) => {
      client.logger.error(`Failed to award catch XP for spawn ${spawnId}:`, err);
      return { leveledUp: false, newLevel: 0 };
    });
    const imageUrl = finalIsShiny ? pokemon.shinyArtworkUrl : pokemon.artworkUrl;
    const catchEmbed = new EmbedBuilder()
      .setColor(finalIsShiny ? 0xffd700 : 0x00c853)
      .setTitle(finalIsShiny ? `✨ Shiny ${pokemon.nameDisplay} caught!` : `🎉 ${pokemon.nameDisplay} caught!`)
      .setThumbnail(imageUrl)
      .addFields(
        { name: 'Level', value: `${result.userPokemon.level}`, inline: true },
        { name: 'Nature', value: nature, inline: true },
        { name: 'Pokédex ID', value: `#${result.userPokemon.id.slice(0, 8)}`, inline: true },
        { name: 'Trainer XP', value: `+${catchXp} XP`, inline: true },
      );
    if (finalIsShiny && !spawn.isShiny) {
      catchEmbed.addFields({ name: '✨ Shiny Charm', value: 'Your charm transformed the encounter into a Shiny catch!', inline: false });
    }
    if (xp.leveledUp) catchEmbed.addFields({ name: '🎉 Trainer Level Up', value: `You reached level **${xp.newLevel}**!`, inline: false });
    if (result.milestone) {
      catchEmbed.addFields({
        name: `📖 ${result.milestone.label}`,
        value: `+${result.milestone.coins.toLocaleString()} PokéCoins`,
        inline: false,
      });
    }
    await interaction.editReply({ embeds: [catchEmbed] });

    const caughtEmbed = new EmbedBuilder()
      .setColor(finalIsShiny ? 0xffd700 : 0x00c853)
      .setTitle(finalIsShiny ? `✨ Shiny ${pokemon.nameDisplay} was caught!` : `${pokemon.nameDisplay} was caught!`)
      .setDescription(`<@${interaction.user.id}> won the encounter and added it to their Pokédex.`)
      .setImage(imageUrl);
    await interaction.message.edit({ embeds: [caughtEmbed], components: [] }).catch(() => {});

    checkAndAwardAchievements(client, interaction.user.id, interaction.channelId, spawn.guildId).catch(() => {});
    incrementQuestProgress(client.prisma, interaction.user.id, 'catch', 1).catch(() => {});
  } catch (err) {
    if ((err as Error).message === 'SPAWN_ALREADY_CLAIMED') {
      await interaction.editReply('Another trainer caught this Pokémon first!');
      return;
    }
    client.logger.error(`Catch error for spawn ${spawnId}:`, err);
    await interaction.editReply('The catch failed unexpectedly. Your encounter is still safe—please try again.');
  }
}

async function expireSpawn(client: BotClient, spawnId: string) {
  const spawn = await client.prisma.spawn.findUnique({ where: { id: spawnId } });
  if (!spawn || spawn.isCaught || spawn.expiresAt > new Date() || !spawn.messageId) return;
  const pokemon = await client.prisma.pokemon.findUnique({ where: { id: spawn.pokemonId } });
  if (!pokemon) return;

  const guild = client.guilds.cache.get(spawn.guildId);
  const channel = guild?.channels.cache.get(spawn.channelId);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(spawn.messageId).catch(() => null);
  if (!message) return;
  await message.edit({
    embeds: [new EmbedBuilder()
      .setColor(0x607d8b)
      .setTitle(`${pokemon.nameDisplay} fled!`)
      .setDescription('The grass settles. Another encounter will come.')],
    components: [],
  }).catch(() => {});
}

export async function findPokemonForManualSpawn(client: BotClient, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  const id = Number(normalized.replace(/^#/, ''));
  if (Number.isInteger(id) && id > 0) {
    return client.prisma.pokemon.findUnique({ where: { id } });
  }
  return client.prisma.pokemon.findFirst({
    where: {
      OR: [
        { name: { equals: normalized, mode: 'insensitive' } },
        { nameDisplay: { equals: query.trim(), mode: 'insensitive' } },
      ],
    },
  });
}

async function selectRandomPokemon(client: BotClient, legendaryRate: number, mythicalRate: number) {
  const roll = Math.random();
  const rarity = roll < mythicalRate ? 'Mythical'
    : roll < mythicalRate + legendaryRate ? 'Legendary'
      : roll < 0.05 ? 'Epic'
        : roll < 0.15 ? 'Rare'
          : 'Common';
  const count = await client.prisma.pokemon.count({ where: { rarity } });
  if (count === 0) return client.prisma.pokemon.findFirst();
  return client.prisma.pokemon.findFirst({ where: { rarity }, skip: Math.floor(Math.random() * count) });
}

export function startSpawnService(client: BotClient) {
  client.logger.info('Spawn service started (database-backed catches, Redis-optional cooldowns)');
}

function randomIv() {
  return Math.floor(Math.random() * 32);
}

function randomNature() {
  const natures = ['Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax', 'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive', 'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash', 'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'];
  return natures[Math.floor(Math.random() * natures.length)];
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
