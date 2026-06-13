import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((o) => o.setName('reason').setDescription('Reason')),

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient) {
    if (!interaction.guild || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) return;
    const reason = interaction.options.getString('reason') ?? 'Channel locked';
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason });
    await interaction.reply({ content: `🔒 Channel locked. Reason: ${reason}` });
  },
};
export default command;
