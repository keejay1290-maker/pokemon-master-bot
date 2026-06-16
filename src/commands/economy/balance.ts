import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your PokéCoin wallet and bank balance')
    .addUserOption((o) => o.setName('user').setDescription("View another user's balance")),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const target = interaction.options.getUser('user') ?? interaction.user;

    const user = await client.prisma.user.findUnique({ where: { id: target.id } });
    if (!user) {
      await interaction.reply({
        content: "This user hasn't started their journey yet!",
        ephemeral: true,
      });
      return;
    }

    const total = user.balance + user.bankBalance;

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(`💰 ${target.username}'s Balance`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '💵 Wallet', value: `**${user.balance.toLocaleString()}** PokéCoins`, inline: true },
        { name: '🏦 Bank', value: `**${user.bankBalance.toLocaleString()}** PokéCoins`, inline: true },
        { name: '💎 Total', value: `**${total.toLocaleString()}** PokéCoins`, inline: true },
        { name: '📈 Total Earned', value: user.totalEarned.toLocaleString(), inline: true },
        { name: '📉 Total Spent', value: user.totalSpent.toLocaleString(), inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;