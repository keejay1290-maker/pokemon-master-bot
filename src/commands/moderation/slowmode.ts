import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set channel slowmode')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((o) => o.setName('seconds').setDescription('Slowmode seconds (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(21600)),

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient) {
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) return;
    const secs = interaction.options.getInteger('seconds', true);
    await interaction.channel.setRateLimitPerUser(secs);
    await interaction.reply({ content: secs === 0 ? '✅ Slowmode disabled.' : `✅ Slowmode set to ${secs}s.` });
  },
};
export default command;
