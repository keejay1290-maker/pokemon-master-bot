import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { logModAction } from '../../services/moderationService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member?.kickable) { await interaction.reply({ content: "Can't kick that user.", ephemeral: true }); return; }

    await member.kick(reason);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xff8c00).setTitle('👢 Member Kicked')
        .addFields({ name: 'User', value: target.tag, inline: true }, { name: 'Reason', value: reason, inline: true }).setTimestamp()],
    });
    await logModAction(client, interaction.guild.id, 'KICK', target.id, interaction.user.id, reason);
  },
};
export default command;
