import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure the welcome system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName('setup').setDescription('Setup welcome channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Welcome channel').setRequired(true))
        .addStringOption((o) => o.setName('message').setDescription('Welcome message ({user} = mention, {server} = server name)'))
    )
    .addSubcommand((s) => s.setName('preview').setDescription('Preview welcome message'))
    .addSubcommand((s) =>
      s.setName('disable').setDescription('Disable welcome messages')
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message') ?? 'Welcome {user} to **{server}**! You are member #{count}. Use `/starter` to begin!';

      await client.prisma.guild.update({
        where: { id: interaction.guild.id },
        data: { welcomeChannelId: channel.id, welcomeMessage: message, welcomeEnabled: true },
      });

      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Welcome System Configured')
          .addFields(
            { name: 'Channel', value: `<#${channel.id}>`, inline: true },
            { name: 'Message', value: message, inline: false },
          )],
      });
    } else if (sub === 'preview') {
      const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
      const msg = (guild?.welcomeMessage ?? 'Welcome {user} to **{server}**!')
        .replace('{user}', `<@${interaction.user.id}>`)
        .replace('{server}', interaction.guild.name)
        .replace('{count}', interaction.guild.memberCount.toString());

      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xffcb05).setTitle('👋 Welcome Message Preview').setDescription(msg).setThumbnail(interaction.user.displayAvatarURL())],
      });
    } else if (sub === 'disable') {
      await client.prisma.guild.update({ where: { id: interaction.guild.id }, data: { welcomeEnabled: false } });
      await interaction.reply({ content: '✅ Welcome messages disabled.', ephemeral: true });
    }
  },
};
export default command;
