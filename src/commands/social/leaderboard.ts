import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View server leaderboards')
    .addStringOption((o) =>
      o.setName('type').setDescription('Leaderboard type').addChoices(
        { name: 'Balance', value: 'balance' },
        { name: 'Pokemon Caught', value: 'pokemon' },
        { name: 'Battles Won', value: 'battles' },
        { name: 'Ranked Points', value: 'ranked' },
        { name: 'Shiny Pokemon', value: 'shiny' },
        { name: 'Trainer Level', value: 'level' },
      )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const type = interaction.options.getString('type') ?? 'balance';

    const orderBy: Record<string, unknown> = {};
    let title = '', valueKey = '';

    switch (type) {
      case 'balance': orderBy.balance = 'desc'; title = '💰 Richest Trainers'; valueKey = 'balance'; break;
      case 'pokemon': orderBy.pokemonCaught = 'desc'; title = '🎾 Top Catchers'; valueKey = 'pokemonCaught'; break;
      case 'battles': orderBy.battlesWon = 'desc'; title = '⚔️ Top Battlers'; valueKey = 'battlesWon'; break;
      case 'ranked': orderBy.rankedPoints = 'desc'; title = '🏆 Ranked Ladder'; valueKey = 'rankedPoints'; break;
      case 'shiny': orderBy.shinyCaught = 'desc'; title = '✨ Shiny Hunters'; valueKey = 'shinyCaught'; break;
      case 'level': orderBy.trainerLevel = 'desc'; title = '⭐ Top Trainers'; valueKey = 'trainerLevel'; break;
    }

    const users = await client.prisma.user.findMany({ orderBy, take: 10 });
    const medals = ['🥇', '🥈', '🥉'];

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(title)
      .setDescription(
        users.map((u, i) => {
          const medal = medals[i] ?? `**${i + 1}.**`;
          const val = (u as Record<string, unknown>)[valueKey] as number;
          return `${medal} <@${u.id}> — **${formatNumber(val)}**`;
        }).join('\n') || 'No data yet.'
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
