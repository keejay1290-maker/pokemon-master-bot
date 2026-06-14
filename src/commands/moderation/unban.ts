import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { logModAction } from '../../services/moderationService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a previously banned user')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((o) =>
      o.setName('user_id').setDescription('Discord user ID to unban').setRequired(true)
    )
    .addStringOption((o) => o.setName('reason').setDescription('Reason for unban')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const userId = interaction.options.getString('user_id', true).trim();
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({ content: 'Invalid user ID. Must be a 17-20 digit Discord snowflake.', ephemeral: true });
      return;
    }

    try {
      await interaction.guild.bans.remove(userId, reason);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x00dd66)
          .setTitle('✅ User Unbanned')
          .addFields(
            { name: 'User ID', value: userId, inline: true },
            { name: 'Reason', value: reason, inline: true },
          )
          .setTimestamp()],
      });

      await logModAction(client, interaction.guild.id, 'UNBAN', userId, interaction.user.id, reason);
    } catch {
      await interaction.reply({ content: 'Failed to unban. User may not be banned or the ID is invalid.', ephemeral: true });
    }
  },
};

export default command;
