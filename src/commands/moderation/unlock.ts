import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient) {
    if (!interaction.guild || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) return;
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    await interaction.reply({ content: '🔓 Channel unlocked.' });
  },
};
export default command;
