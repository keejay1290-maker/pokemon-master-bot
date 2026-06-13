import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { logModAction } from '../../services/moderationService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to timeout').setRequired(true))
    .addIntegerOption((o) => o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption((o) => o.setName('reason').setDescription('Reason')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser('user', true);
    const duration = interaction.options.getInteger('duration', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member?.moderatable) { await interaction.reply({ content: "Can't timeout that user.", ephemeral: true }); return; }

    await member.timeout(duration * 60000, reason);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xffaa00).setTitle('⏰ Member Timed Out')
        .addFields({ name: 'User', value: target.tag, inline: true }, { name: 'Duration', value: `${duration} min`, inline: true }, { name: 'Reason', value: reason }).setTimestamp()],
    });
    await logModAction(client, interaction.guild.id, 'TIMEOUT', target.id, interaction.user.id, reason, { duration: `${duration} minutes` });
  },
};
export default command;
