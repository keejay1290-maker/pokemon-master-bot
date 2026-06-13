import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName('amount').setDescription('Messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.channel?.isTextBased()) return;
    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const toDelete = user
      ? messages.filter((m) => m.author.id === user.id).first(amount)
      : [...messages.values()].slice(0, amount);

    if ('bulkDelete' in interaction.channel) {
      const deleted = await interaction.channel.bulkDelete(toDelete, true).catch(() => null);
      await interaction.editReply({ embeds: [successEmbed('Purge', `Deleted ${deleted?.size ?? 0} messages.`)] });
    } else {
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Cannot delete messages in this channel.')] });
    }
  },
};
export default command;
