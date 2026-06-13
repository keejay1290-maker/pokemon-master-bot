import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { logModAction } from '../../services/moderationService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    await client.prisma.warning.create({
      data: { guildId: interaction.guild.id, userId: target.id, moderatorId: interaction.user.id, reason },
    });

    const count = await client.prisma.warning.count({ where: { guildId: interaction.guild.id, userId: target.id } });

    await target.send({
      embeds: [new EmbedBuilder().setColor(0xffaa00).setTitle(`⚠️ Warning in ${interaction.guild.name}`)
        .addFields({ name: 'Reason', value: reason }, { name: 'Total Warnings', value: `${count}`}).setTimestamp()],
    }).catch(() => {});

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xffaa00).setTitle('⚠️ Warning Issued')
        .addFields({ name: 'User', value: target.tag, inline: true }, { name: 'Reason', value: reason, inline: true }, { name: 'Total Warnings', value: `${count}`, inline: true }).setTimestamp()],
    });
    await logModAction(client, interaction.guild.id, 'WARN', target.id, interaction.user.id, reason);
  },
};
export default command;
