import { Message, EmbedBuilder } from 'discord.js';
import type { BotClient } from '../types/index.js';

const SCAM_PATTERNS = [
  /discord\.gift[^.]/i,
  /free\s*nitro/i,
  /claim\s*your\s*prize/i,
  /steam\s*gift/i,
  /steamcommunity\.com\/gift/i,
];

const SPAM_MESSAGE_LIMIT = 5;
const SPAM_TIME_WINDOW = 5000;

export async function checkAutoMod(message: Message, client: BotClient) {
  if (!message.guild || !message.member) return;
  if (message.member.permissions.has('ManageMessages')) return;

  const guild = await client.prisma.guild.findUnique({ where: { id: message.guild.id } });
  if (!guild?.autoModEnabled) return;

  // Scam detection
  if (guild.scamDetectionEnabled) {
    for (const pattern of SCAM_PATTERNS) {
      if (pattern.test(message.content)) {
        await message.delete().catch(() => {});
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('🚫 Scam Detected')
              .setDescription(`<@${message.author.id}> A potential scam link was detected and removed.`),
          ],
        });
        await autoWarn(client, message.guild.id, message.author.id, client.user!.id, 'Auto-mod: Scam link detected');
        return;
      }
    }
  }

  // Anti-spam
  if (guild.antiSpamEnabled) {
    const key = `spam:${message.guild.id}:${message.author.id}`;
    const count = await client.redis.incr(key);
    if (count === 1) await client.redis.pExpire(key, SPAM_TIME_WINDOW);

    if (count >= SPAM_MESSAGE_LIMIT) {
      await message.channel.bulkDelete(
        await message.channel.messages.fetch({ limit: 10 }).then(
          (msgs) => msgs.filter((m) => m.author.id === message.author.id).first(SPAM_MESSAGE_LIMIT)
        )
      ).catch(() => {});

      await message.member.timeout(60000, 'Auto-mod: Spam').catch(() => {});
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff8c00)
            .setTitle('⚠️ Spam Detected')
            .setDescription(`<@${message.author.id}> has been timed out for spamming.`),
        ],
      });
    }
  }
}

export async function autoWarn(
  client: BotClient,
  guildId: string,
  userId: string,
  moderatorId: string,
  reason: string
) {
  await client.prisma.warning.create({
    data: { guildId, userId, moderatorId, reason },
  });

  await client.prisma.auditLog.create({
    data: { guildId, action: 'AUTO_WARN', targetId: userId, moderatorId, reason },
  });
}

export async function logModAction(
  client: BotClient,
  guildId: string,
  action: string,
  targetId: string,
  moderatorId: string,
  reason: string,
  extra?: Record<string, unknown>
) {
  const guild = await client.prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild?.modLogChannelId) return;

  const channel = client.guilds.cache.get(guildId)?.channels.cache.get(guild.modLogChannelId);
  if (!channel?.isTextBased()) return;

  const actionEmojis: Record<string, string> = {
    BAN: '🔨', TEMPBAN: '⏱️', KICK: '👢', MUTE: '🔇', TIMEOUT: '⏰',
    WARN: '⚠️', UNBAN: '✅', UNMUTE: '🔊', LOCK: '🔒', UNLOCK: '🔓',
  };

  const embed = new EmbedBuilder()
    .setColor(action === 'BAN' || action === 'KICK' ? 0xff0000 : action === 'WARN' ? 0xffaa00 : 0x3498db)
    .setTitle(`${actionEmojis[action] ?? '📋'} ${action}`)
    .addFields(
      { name: 'Target', value: `<@${targetId}>`, inline: true },
      { name: 'Moderator', value: `<@${moderatorId}>`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: false }
    )
    .setTimestamp();

  if (extra?.duration) embed.addFields({ name: 'Duration', value: extra.duration as string, inline: true });

  await channel.send({ embeds: [embed] }).catch(() => {});

  await client.prisma.auditLog.create({
    data: { guildId, action, targetId, moderatorId, reason, metadata: extra ?? {} },
  });
}
