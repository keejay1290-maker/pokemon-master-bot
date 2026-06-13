import { PrismaClient } from '@prisma/client';
import {
  Guild as DiscordGuild,
  ChannelType,
  PermissionsBitField,
  CategoryChannel,
  TextChannel,
} from 'discord.js';

export async function ensureGuild(prisma: PrismaClient, guild: DiscordGuild) {
  return prisma.guild.upsert({
    where: { id: guild.id },
    update: { name: guild.name, ownerId: guild.ownerId },
    create: { id: guild.id, name: guild.name, ownerId: guild.ownerId },
  });
}

export async function runFullSetup(guild: DiscordGuild, prisma: PrismaClient) {
  const channelNames = [
    { name: 'welcome', topic: 'Welcome new trainers!' },
    { name: 'announcements', topic: 'Official announcements' },
    { name: 'pokemon-chat', topic: 'Chat about Pokemon!' },
    { name: 'pokemon-battles', topic: 'Challenge trainers to battles!' },
    { name: 'pokemon-trades', topic: 'Trade Pokemon with other trainers!' },
    { name: 'pokemon-showcase', topic: 'Show off your Pokemon!' },
    { name: 'poke-spawns', topic: 'Pokemon spawn here. Type /catch to catch them!' },
    { name: 'pokecoins', topic: 'Economy channel' },
    { name: 'giveaways', topic: 'Pokemon giveaways!' },
    { name: 'bot-commands', topic: 'Use bot commands here' },
    { name: 'trainer-hub', topic: 'Trainer profiles and stats' },
    { name: 'daily-rewards', topic: 'Claim your daily rewards!' },
    { name: 'gym-challenges', topic: 'Gym battle challenges' },
    { name: 'elite-four', topic: 'Elite Four challenges' },
    { name: 'marketplace', topic: 'Buy and sell Pokemon and cards' },
  ];

  const roleNames = [
    { name: 'Trainer', color: 0x3498db },
    { name: 'Gym Leader', color: 0xe74c3c },
    { name: 'Elite Four', color: 0x9b59b6 },
    { name: 'Champion', color: 0xf1c40f },
    { name: 'Shiny Hunter', color: 0xffd700 },
    { name: 'Legendary Hunter', color: 0xff8c00 },
    { name: 'Collector', color: 0x1abc9c },
    { name: 'Breeder', color: 0x2ecc71 },
    { name: 'Researcher', color: 0x3498db },
  ];

  const createdChannels: Record<string, string> = {};
  const createdRoles: Record<string, string> = {};

  // Create category
  let category: CategoryChannel | undefined;
  try {
    category = await guild.channels.create({
      name: '🎮 Pokemon Master',
      type: ChannelType.GuildCategory,
    });
  } catch {}

  // Create channels
  for (const ch of channelNames) {
    try {
      const existing = guild.channels.cache.find(
        (c) => c.name === ch.name && c.type === ChannelType.GuildText
      ) as TextChannel | undefined;

      if (existing) {
        createdChannels[ch.name] = existing.id;
        continue;
      }

      const created = await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildText,
        topic: ch.topic,
        parent: category?.id,
      });
      createdChannels[ch.name] = created.id;
    } catch {}
  }

  // Create roles
  for (const role of roleNames) {
    try {
      const existing = guild.roles.cache.find((r) => r.name === role.name);
      if (existing) {
        createdRoles[role.name] = existing.id;
        continue;
      }
      const created = await guild.roles.create({
        name: role.name,
        color: role.color,
        reason: 'Pokemon Master Full Setup',
      });
      createdRoles[role.name] = created.id;
    } catch {}
  }

  // Update DB
  await prisma.guild.update({
    where: { id: guild.id },
    data: {
      setupComplete: true,
      setupType: 'full',
      welcomeChannelId: createdChannels['welcome'],
      announcementsChannelId: createdChannels['announcements'],
      pokemonChatChannelId: createdChannels['pokemon-chat'],
      pokemonBattlesChannelId: createdChannels['pokemon-battles'],
      pokemonTradesChannelId: createdChannels['pokemon-trades'],
      pokemonShowcaseChannelId: createdChannels['pokemon-showcase'],
      pokeSpawnsChannelId: createdChannels['poke-spawns'],
      pokecoinsChannelId: createdChannels['pokecoins'],
      giveawaysChannelId: createdChannels['giveaways'],
      botCommandsChannelId: createdChannels['bot-commands'],
      trainerHubChannelId: createdChannels['trainer-hub'],
      dailyRewardsChannelId: createdChannels['daily-rewards'],
      gymChallengesChannelId: createdChannels['gym-challenges'],
      eliteFourChannelId: createdChannels['elite-four'],
      marketplaceChannelId: createdChannels['marketplace'],
      welcomeEnabled: true,
    },
  });

  return { channels: createdChannels, roles: createdRoles };
}
