import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Deposit PokéCoins into your bank')
    .addStringOption((o) => o.setName('amount').setDescription('Amount to deposit (or "all")').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
    if (!user) { await interaction.reply({ content: 'User not found!', ephemeral: true }); return; }

    const raw = interaction.options.getString('amount', true);
    const amount = raw.toLowerCase() === 'all' ? user.balance : parseInt(raw);
    if (isNaN(amount) || amount <= 0) { await interaction.reply({ content: 'Invalid amount.', ephemeral: true }); return; }
    if (amount > user.balance) { await interaction.reply({ content: `You only have **${formatNumber(user.balance)}** PokéCoins in your wallet.`, ephemeral: true }); return; }

    await client.prisma.user.update({ where: { id: interaction.user.id }, data: { balance: { decrement: amount }, bankBalance: { increment: amount } } });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('🏦 Deposited').setDescription(`Deposited **${formatNumber(amount)} PokéCoins** into your bank.`)] });
  },
};
export default command;
