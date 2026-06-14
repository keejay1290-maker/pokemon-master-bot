import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { addXp } from '../../services/userService.js';
import { checkAndAwardAchievements } from '../../services/achievementService.js';
import { incrementQuestProgress } from '../../services/questService.js';

// Hunt encounter table — can spawn actual Pokemon
const HUNT_ENCOUNTERS = [
  // Common
  { pokemonName: 'Pidgey',     pokemonId: 16,  rarity: 'common',    coinReward: 0,    catchChance: 0.9, weight: 20 },
  { pokemonName: 'Rattata',    pokemonId: 19,  rarity: 'common',    coinReward: 0,    catchChance: 0.9, weight: 20 },
  { pokemonName: 'Zigzagoon',  pokemonId: 263, rarity: 'common',    coinReward: 0,    catchChance: 0.85, weight: 15 },
  { pokemonName: 'Sentret',    pokemonId: 161, rarity: 'common',    coinReward: 0,    catchChance: 0.85, weight: 12 },
  // Uncommon
  { pokemonName: 'Growlithe',  pokemonId: 58,  rarity: 'uncommon',  coinReward: 0,    catchChance: 0.65, weight: 8 },
  { pokemonName: 'Eevee',      pokemonId: 133, rarity: 'uncommon',  coinReward: 0,    catchChance: 0.60, weight: 6 },
  { pokemonName: 'Togepi',     pokemonId: 175, rarity: 'uncommon',  coinReward: 0,    catchChance: 0.55, weight: 5 },
  // Rare
  { pokemonName: 'Riolu',      pokemonId: 447, rarity: 'rare',      coinReward: 0,    catchChance: 0.40, weight: 4 },
  { pokemonName: 'Dratini',    pokemonId: 147, rarity: 'rare',      coinReward: 0,    catchChance: 0.35, weight: 3 },
  { pokemonName: 'Larvitar',   pokemonId: 246, rarity: 'rare',      coinReward: 0,    catchChance: 0.30, weight: 3 },
  { pokemonName: 'Bagon',      pokemonId: 371, rarity: 'rare',      coinReward: 0,    catchChance: 0.30, weight: 3 },
  // Very Rare
  { pokemonName: 'Beldum',     pokemonId: 374, rarity: 'very_rare', coinReward: 0,    catchChance: 0.20, weight: 1 },
];

// Coin-only outcomes (no Pokemon spawned)
const COIN_OUTCOMES = [
  { description: 'You found an abandoned bag of PokéCoins!',   min: 200, max: 500 },
  { description: 'A wild Pokemon dropped its held item. Sold it!', min: 300, max: 700 },
  { description: 'You found a rare berry and sold it at the market.', min: 150, max: 400 },
];

// Item outcomes (added to UserInventory)
const ITEM_OUTCOMES: Array<{ description: string; itemId: string; itemName: string; chance: number }> = [
  { description: 'You found a Poke Ball on the ground!', itemId: 'pokeball', itemName: 'Poke Ball', chance: 0.08 },
  { description: 'You found a Potion!', itemId: 'potion', itemName: 'Potion', chance: 0.05 },
  { description: 'You found an Oran Berry!', itemId: 'oran_berry', itemName: 'Oran Berry', chance: 0.04 },
  { description: 'Incredible — you found a Fire Stone!', itemId: 'fire_stone', itemName: 'Fire Stone', chance: 0.01 },
  { description: 'Amazing — a Rare Candy was hidden here!', itemId: 'rare_candy', itemName: 'Rare Candy', chance: 0.005 },
];

const NATURES = ['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky'];

const RARITY_COLOR: Record<string, number> = {
  common: 0x2ecc71, uncommon: 0x3498db, rare: 0x9b59b6, very_rare: 0xe91e63,
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('hunt')
    .setDescription('Hunt in the wild — encounter Pokémon, find items, and earn PokéCoins'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } });
    const cooldownSecs = guild?.huntCooldown ?? 3600;

    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'hunt', cooldownSecs);
    if (onCooldown) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Cooldown').setDescription(`Hunt again in **${formatDuration(remaining!)}**.`)],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    await setCooldown(client, interaction.user.id, 'hunt', cooldownSecs);

    // Total failure (15%)
    if (Math.random() < 0.15) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x888888).setTitle('🌿 Nothing Found').setDescription('You searched the tall grass but found nothing. Better luck next time!')],
      });
      return;
    }

    const embed = new EmbedBuilder().setTimestamp();
    let coinGain = 0;
    let xpGain = 10;

    // Item find (independent roll)
    let itemFound: typeof ITEM_OUTCOMES[number] | null = null;
    for (const item of ITEM_OUTCOMES) {
      if (Math.random() < item.chance) { itemFound = item; break; }
    }

    if (itemFound) {
      await client.prisma.userInventory.upsert({
        where: { userId_itemId: { userId: interaction.user.id, itemId: itemFound.itemId } },
        update: { quantity: { increment: 1 } },
        create: { userId: interaction.user.id, itemId: itemFound.itemId, itemName: itemFound.itemName, quantity: 1 },
      });
    }

    // Pokemon encounter (60% chance)
    const hasPokemonEncounter = Math.random() < 0.60;

    if (hasPokemonEncounter) {
      // Weighted random selection
      const totalWeight = HUNT_ENCOUNTERS.reduce((s, e) => s + e.weight, 0);
      let roll = Math.random() * totalWeight;
      let enc = HUNT_ENCOUNTERS[0];
      for (const e of HUNT_ENCOUNTERS) { roll -= e.weight; if (roll <= 0) { enc = e; break; } }

      // Verify this Pokemon exists in DB
      const pokemon = await client.prisma.pokemon.findUnique({ where: { id: enc.pokemonId } });

      // Ball system — check for best owned ball
      const BALL_PRIORITY = ['master_ball', 'ultra_ball', 'great_ball', 'poke_ball'];
      const BALL_MULTIPLIERS: Record<string, number> = {
        master_ball: 999, ultra_ball: 2.0, great_ball: 1.5, poke_ball: 1.0,
      };
      let bestBall: string | null = null;
      for (const ballId of BALL_PRIORITY) {
        const inv = await client.prisma.userInventory.findUnique({
          where: { userId_itemId: { userId: interaction.user.id, itemId: ballId } },
        });
        if (inv && inv.quantity > 0) { bestBall = ballId; break; }
      }

      if (!bestBall) {
        // No balls — Pokemon flees, coin consolation
        coinGain = Math.floor(Math.random() * 100) + 30;
        embed.setColor(0x888888)
          .setTitle(`🌿 Wild ${pokemon?.name ?? enc.pokemonName} Appeared — No Balls!`)
          .setDescription(`A wild **${pokemon?.name ?? enc.pokemonName}** appeared but you have no Poké Balls!\nBuy balls with \`/buy\` to catch Pokémon.\n\n💰 Consolation: +${formatNumber(coinGain)} PokéCoins`)
          .addFields({ name: '🎾 Balls Needed', value: 'Visit `/shop` to buy Poké Balls', inline: false });
      } else if (pokemon && Math.random() < Math.min(1.0, enc.catchChance * (BALL_MULTIPLIERS[bestBall] ?? 1.0))) {
        // Deduct ball first (atomic, before creating Pokemon to prevent double-reward)
        const ballInv = await client.prisma.userInventory.findUnique({
          where: { userId_itemId: { userId: interaction.user.id, itemId: bestBall } },
        });
        if (ballInv) {
          if (ballInv.quantity === 1) {
            await client.prisma.userInventory.delete({ where: { userId_itemId: { userId: interaction.user.id, itemId: bestBall } } });
          } else {
            await client.prisma.userInventory.update({
              where: { userId_itemId: { userId: interaction.user.id, itemId: bestBall } },
              data: { quantity: { decrement: 1 } },
            });
          }
        }
        // Caught!
        const isShiny = Math.random() < (guild?.shinyRate ?? 0.002);
        const nature = NATURES[Math.floor(Math.random() * 25)];
        const moves = await client.prisma.pokemonMove.findMany({
          where: { pokemonId: pokemon.id },
          orderBy: [{ learnLevel: 'asc' }],
          take: 4,
        });

        await client.prisma.userPokemon.create({
          data: {
            userId: interaction.user.id,
            pokemonId: pokemon.id,
            isShiny,
            level: Math.floor(Math.random() * 20) + 1,
            nature,
            ivHp: Math.floor(Math.random() * 32),
            ivAttack: Math.floor(Math.random() * 32),
            ivDefense: Math.floor(Math.random() * 32),
            ivSpAttack: Math.floor(Math.random() * 32),
            ivSpDefense: Math.floor(Math.random() * 32),
            ivSpeed: Math.floor(Math.random() * 32),
            moves: moves.length > 0 ? moves.map((m) => m.moveName) : ['tackle', 'growl'],
            caughtIn: bestBall === 'master_ball' ? 'Master Ball' : bestBall === 'ultra_ball' ? 'Ultra Ball' : bestBall === 'great_ball' ? 'Great Ball' : 'Poke Ball',
          },
        });

        await client.prisma.user.update({
          where: { id: interaction.user.id },
          data: { pokemonCaught: { increment: 1 }, shinyCaught: isShiny ? { increment: 1 } : undefined },
        });

        xpGain = enc.rarity === 'very_rare' ? 80 : enc.rarity === 'rare' ? 50 : enc.rarity === 'uncommon' ? 30 : 15;

        const ballLabel = bestBall === 'master_ball' ? 'Master Ball' : bestBall === 'ultra_ball' ? 'Ultra Ball' : bestBall === 'great_ball' ? 'Great Ball' : 'Poké Ball';
        embed.setColor(isShiny ? 0xffd700 : RARITY_COLOR[enc.rarity])
          .setTitle(`🌿 Wild ${pokemon.name}${isShiny ? ' ✨' : ''} Appeared — Caught!`)
          .setDescription(`You caught **${isShiny ? '✨ ' : ''}${pokemon.name}**! It's been added to your collection.`)
          .addFields(
            { name: '📦 Rarity', value: enc.rarity.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()), inline: true },
            { name: '🎾 Ball Used', value: ballLabel, inline: true },
            ...(isShiny ? [{ name: '✨ Shiny!', value: 'Incredible — a shiny Pokémon!', inline: false }] : []),
          );

        if (pokemon.spriteUrl) embed.setThumbnail(pokemon.spriteUrl);

        incrementQuestProgress(client.prisma, interaction.user.id, 'catch_pokemon', 1).catch(() => {});
        checkAndAwardAchievements(client, interaction.user.id, interaction.channelId, interaction.guild?.id).catch(() => {});
      } else if (pokemon && bestBall) {
        // Ball thrown but Pokemon fled — still consume ball
        const ballInv = await client.prisma.userInventory.findUnique({
          where: { userId_itemId: { userId: interaction.user.id, itemId: bestBall } },
        });
        if (ballInv) {
          if (ballInv.quantity === 1) {
            await client.prisma.userInventory.delete({ where: { userId_itemId: { userId: interaction.user.id, itemId: bestBall } } });
          } else {
            await client.prisma.userInventory.update({
              where: { userId_itemId: { userId: interaction.user.id, itemId: bestBall } },
              data: { quantity: { decrement: 1 } },
            });
          }
        }
        coinGain = Math.floor(Math.random() * 150) + 30;
        xpGain = 8;
        embed.setColor(0x888888)
          .setTitle(`🌿 Wild ${pokemon.name} Appeared — Escaped!`)
          .setDescription(`A wild **${pokemon.name}** broke free and escaped! Your ball was used.\n💰 Consolation: +${formatNumber(coinGain)} PokéCoins`)
          .addFields({ name: '🎾 Ball Used', value: bestBall === 'master_ball' ? 'Master Ball' : bestBall === 'ultra_ball' ? 'Ultra Ball' : bestBall === 'great_ball' ? 'Great Ball' : 'Poké Ball', inline: true });
      }
    } else {
      // Coin-only outcome
      const outcome = COIN_OUTCOMES[Math.floor(Math.random() * COIN_OUTCOMES.length)];
      coinGain = Math.floor(Math.random() * (outcome.max - outcome.min) + outcome.min);
      xpGain = 12;
      embed.setColor(0xf5c518)
        .setTitle('🌿 Hunt Results')
        .setDescription(outcome.description)
        .addFields({ name: '💰 Coins', value: `+${formatNumber(coinGain)}`, inline: true });
    }

    if (coinGain > 0) {
      await client.prisma.user.update({
        where: { id: interaction.user.id },
        data: { balance: { increment: coinGain }, totalEarned: { increment: coinGain } },
      });
    }

    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    embed.addFields({ name: '⭐ Trainer XP', value: `+${xpGain}`, inline: true });
    if (itemFound) embed.addFields({ name: '🎒 Item Found!', value: itemFound.description, inline: false });
    if (leveledUp) embed.addFields({ name: '🎉 Level Up!', value: `You reached **Trainer Level ${newLevel}**!`, inline: false });
    embed.setFooter({ text: `Cooldown: ${formatDuration(cooldownSecs)}` });

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
