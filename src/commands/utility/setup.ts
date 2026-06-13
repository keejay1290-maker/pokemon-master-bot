import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { runFullSetup } from '../../services/guildService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup Pokemon Master for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o.setName('type').setDescription('Setup type').setRequired(true).addChoices(
        { name: 'Full Setup (creates all channels & roles)', value: 'full' },
        { name: 'Manual (configure manually)', value: 'manual' },
      )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const type = interaction.options.getString('type', true);

    await interaction.deferReply({ ephemeral: true });

    if (type === 'full') {
      const embed = new EmbedBuilder().setColor(0xffcb05).setTitle('🔄 Setting up...')
        .setDescription('Creating channels and roles...');
      await interaction.editReply({ embeds: [embed] });

      const { channels, roles } = await runFullSetup(interaction.guild, client.prisma);

      const chList = Object.entries(channels).map(([n, id]) => `<#${id}> #${n}`).join('\n');
      const rList = Object.entries(roles).map(([n, id]) => `<@&${id}> ${n}`).join('\n');

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Setup Complete!')
          .addFields(
            { name: `📁 Channels (${Object.keys(channels).length})`, value: chList || 'None', inline: false },
            { name: `🎭 Roles (${Object.keys(roles).length})`, value: rList || 'None', inline: false },
          ).setTimestamp()],
      });
    } else {
      await client.prisma.guild.update({ where: { id: interaction.guild.id }, data: { setupComplete: true, setupType: 'manual' } });
      await interaction.editReply({ content: '✅ Manual setup selected. Use other commands to configure the bot.' });
    }
  },
};
export default command;
