import { Message } from 'discord.js';
import type { BotClient } from '../types/index.js';
import { checkAutoMod } from '../services/moderationService.js';
import { handleSpawnMessage } from '../services/spawnService.js';

export async function handleMessageCreate(message: Message, client: BotClient) {
  if (message.author.bot || !message.guild) return;

  // Auto-mod check
  await checkAutoMod(message, client).catch(() => {});

  // Random spawn trigger
  await handleSpawnMessage(message, client).catch(() => {});

  // XP gain
  const key = `xp:cooldown:${message.guild.id}:${message.author.id}`;
  const hasCooldown = await client.redis.get(key);
  if (!hasCooldown) {
    const xpGain = Math.floor(Math.random() * 15) + 5;
    await client.prisma.guildUser.upsert({
      where: { guildId_userId: { guildId: message.guild.id, userId: message.author.id } },
      update: { xp: { increment: xpGain }, messages: { increment: 1 } },
      create: { guildId: message.guild.id, userId: message.author.id, xp: xpGain, messages: 1 },
    });
    await client.redis.set(key, '1', { EX: 60 });
  }
}
