import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { logModAction } from '../../services/moderationService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for ban'))
    .addIntegerOption((o) => o.setName('delete_days').setDescription('Days of messages to delete').setMinValue(0).setMaxValue(7)),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const delDays = interaction.options.getInteger('delete_days') ?? 0;

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member && !member.bannable) {
      await interaction.reply({ content: "I can't ban that user (higher role).", ephemeral: true });
      return;
    }

    try {
      await target.send({
        embeds: [new EmbedBuilder().setColor(0xff0000).setTitle(`You were banned from ${interaction.guild.name}`)
          .addFields({ name: 'Reason', value: reason }).setTimestamp()],
      }).catch(() => {});

      await interaction.guild.members.ban(target.id, { reason, deleteMessageDays: delDays });

      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setTitle('🔨 Member Banned')
          .addFields({ name: 'User', value: `${target.tag}`, inline: true }, { name: 'Reason', value: reason, inline: true }).setTimestamp()],
      });

      await logModAction(client, interaction.guild.id, 'BAN', target.id, interaction.user.id, reason);
    } catch {
      await interaction.reply({ content: 'Failed to ban user.', ephemeral: true });
    }
  },
};
export default command;
