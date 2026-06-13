import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to check').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser('user', true);
    const warnings = await client.prisma.warning.findMany({
      where: { guildId: interaction.guild.id, userId: target.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle(`⚠️ Warnings — ${target.tag}`)
      .setThumbnail(target.displayAvatarURL());

    if (warnings.length === 0) {
      embed.setDescription('No warnings found.');
    } else {
      embed.setDescription(
        warnings.map((w, i) =>
          `**${i + 1}.** ${w.reason}\n> By <@${w.moderatorId}> • <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`
        ).join('\n\n')
      ).setFooter({ text: `Total: ${warnings.length} warning(s)` });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
export default command;
