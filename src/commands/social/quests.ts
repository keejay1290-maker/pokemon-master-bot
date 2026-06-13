import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { progressBar } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('quests')
    .setDescription('View your active quests'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const quests = await client.prisma.userQuest.findMany({
      where: { userId: interaction.user.id, completed: false },
      include: { quest: true },
    });

    const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle('📋 Active Quests').setTimestamp();

    if (quests.length === 0) {
      embed.setDescription('No active quests! Quests reset daily/weekly.');
    } else {
      embed.setDescription(
        quests.map((uq) => {
          const req = uq.quest.requirement as { count?: number; amount?: number };
          const target = req.count ?? req.amount ?? 1;
          return `**${uq.quest.name}** (${uq.quest.resetPeriod})\n${uq.quest.description}\n\`${progressBar(uq.progress, target)}\` ${uq.progress}/${target}`;
        }).join('\n\n')
      );
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
