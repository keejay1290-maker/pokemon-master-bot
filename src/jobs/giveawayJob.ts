import type { BotClient } from '../types/index.js';
import { EmbedBuilder } from 'discord.js';

export async function checkGiveaways(client: BotClient) {
  const expiredGiveaways = await client.prisma.giveaway.findMany({
    where: { status: 'active', endsAt: { lte: new Date() } },
    include: { entries: true },
  });

  for (const giveaway of expiredGiveaways) {
    await endGiveaway(client, giveaway.id);
  }
}

export async function endGiveaway(client: BotClient, giveawayId: string) {
  const giveaway = await client.prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { entries: true },
  });
  if (!giveaway || giveaway.status !== 'active') return;

  const entries = giveaway.entries;
  const winnerCount = Math.min(giveaway.winners, entries.length);
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, winnerCount).map((e) => e.userId);

  await client.prisma.giveaway.update({
    where: { id: giveawayId },
    data: { status: 'ended', winnerIds: winners, endedAt: new Date() },
  });

  const guild = client.guilds.cache.get(giveaway.guildId);
  if (!guild) return;
  const channel = guild.channels.cache.get(giveaway.channelId);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🎉 Giveaway Ended!')
    .setDescription(
      `**${giveaway.title}**\n\n` +
      (winners.length > 0
        ? `🏆 **Winner${winners.length > 1 ? 's' : ''}:** ${winners.map((w) => `<@${w}>`).join(', ')}`
        : 'No entries — no winner.')
    )
    .addFields({ name: 'Entries', value: entries.length.toString(), inline: true })
    .setTimestamp();

  if (giveaway.messageId) {
    await channel.messages.fetch(giveaway.messageId).then((msg) => msg.edit({ embeds: [embed], components: [] })).catch(() => {});
  }

  if (winners.length > 0) {
    await channel.send({
      content: `🎉 Congratulations ${winners.map((w) => `<@${w}>`).join(', ')}! You won **${giveaway.title}**!`,
    }).catch(() => {});
  }
}
