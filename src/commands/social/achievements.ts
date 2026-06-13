import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View your achievements')
    .addUserOption((o) => o.setName('user').setDescription('View another user\'s achievements')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') ?? interaction.user;

    const earned = await client.prisma.userAchievement.findMany({
      where: { userId: target.id },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    });

    const total = await client.prisma.achievement.count();

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(`🏆 ${target.username}'s Achievements`)
      .setDescription(earned.length === 0
        ? 'No achievements yet!'
        : earned.slice(0, 20).map((ua) =>
            `${ua.achievement.icon} **${ua.achievement.name}** — ${ua.achievement.description}`
          ).join('\n')
      )
      .setFooter({ text: `${earned.length}/${total} achievements unlocked` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
