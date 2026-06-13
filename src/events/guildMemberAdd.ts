import { GuildMember, EmbedBuilder } from 'discord.js';
import type { BotClient } from '../types/index.js';
import { ensureUser } from '../services/userService.js';

export async function handleGuildMemberAdd(member: GuildMember, client: BotClient) {
  await ensureUser(client.prisma, member.user);

  const guild = await client.prisma.guild.findUnique({
    where: { id: member.guild.id },
  });

  if (!guild?.welcomeEnabled || !guild.welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(guild.welcomeChannelId);
  if (!channel?.isTextBased()) return;

  const welcomeMsg = guild.welcomeMessage
    ? guild.welcomeMessage.replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name)
    : `Welcome <@${member.id}> to **${member.guild.name}**! You are member #${member.guild.memberCount}. Use \`/starter\` to choose your starter Pokemon!`;

  const embedData = guild.welcomeEmbed as Record<string, unknown> | null;

  const embed = new EmbedBuilder()
    .setColor((embedData?.color as number) || 0xffcb05)
    .setTitle((embedData?.title as string) || '🎉 New Trainer Arrived!')
    .setDescription(welcomeMsg)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: '👤 Member', value: `<@${member.id}>`, inline: true },
      { name: '📊 Member Count', value: `#${member.guild.memberCount}`, inline: true },
      { name: '🎮 Get Started', value: 'Use `/starter` to choose your first Pokemon!', inline: false }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});

  // Assign Trainer role if it exists
  const trainerRole = member.guild.roles.cache.find((r) => r.name === 'Trainer');
  if (trainerRole) {
    await member.roles.add(trainerRole).catch(() => {});
  }
}
