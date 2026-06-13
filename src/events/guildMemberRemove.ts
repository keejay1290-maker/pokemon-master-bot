import { GuildMember, PartialGuildMember, EmbedBuilder } from 'discord.js';
import type { BotClient } from '../types/index.js';

export async function handleGuildMemberRemove(
  member: GuildMember | PartialGuildMember,
  client: BotClient
) {
  const guild = await client.prisma.guild.findUnique({ where: { id: member.guild.id } });
  if (!guild?.welcomeEnabled || !guild.welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(guild.welcomeChannelId);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x808080)
    .setTitle('👋 Trainer Left')
    .setDescription(`**${member.user?.username ?? 'A trainer'}** has left the server.`)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}
