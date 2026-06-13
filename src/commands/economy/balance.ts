import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your PokeCoin balance')
    .addUserOption((opt) => opt.setName('user').setDescription('Check another user\'s balance')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const target = interaction.options.getUser('user') ?? interaction.user;

    const user = await client.prisma.user.findUnique({ where: { id: target.id } });
    if (!user) {
      await interaction.reply({ content: "This user hasn't started their journey yet!", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(`💰 ${target.username}'s Wallet`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '💵 Wallet', value: `**${formatNumber(user.balance)}** PokéCoins`, inline: true },
        { name: '🏦 Bank', value: `**${formatNumber(user.bankBalance)}** PokéCoins`, inline: true },
        { name: '💎 Total', value: `**${formatNumber(user.balance + user.bankBalance)}** PokéCoins`, inline: true },
        { name: '📈 Total Earned', value: formatNumber(user.totalEarned), inline: true },
        { name: '📉 Total Spent', value: formatNumber(user.totalSpent), inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
