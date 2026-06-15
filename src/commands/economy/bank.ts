import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Manage your PokéCoin bank account')
    .addSubcommand((sub) =>
      sub.setName('view')
        .setDescription('Check your wallet and bank balance')
        .addUserOption((o) => o.setName('user').setDescription("View another user's balance"))
    )
    .addSubcommand((sub) =>
      sub.setName('deposit')
        .setDescription('Deposit PokéCoins into your bank')
        .addStringOption((o) =>
          o.setName('amount')
            .setDescription('Amount to deposit (or "all")')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('withdraw')
        .setDescription('Withdraw PokéCoins from your bank')
        .addStringOption((o) =>
          o.setName('amount')
            .setDescription('Amount to withdraw (or "all")')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'view') await handleView(interaction, client);
    else if (sub === 'deposit') await handleDeposit(interaction, client);
    else if (sub === 'withdraw') await handleWithdraw(interaction, client);
  },
};

async function handleView(interaction: ChatInputCommandInteraction, client: BotClient) {
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
}

async function handleDeposit(interaction: ChatInputCommandInteraction, client: BotClient) {
  const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
  if (!user) { await interaction.reply({ content: 'User not found!', ephemeral: true }); return; }

  const raw = interaction.options.getString('amount', true);
  const amount = raw.toLowerCase() === 'all' ? user.balance : parseInt(raw);
  if (isNaN(amount) || amount <= 0) { await interaction.reply({ content: 'Invalid amount.', ephemeral: true }); return; }

  try {
    await client.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({ where: { id: interaction.user.id } });
      if (!currentUser || currentUser.balance < amount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }
      await tx.user.update({
        where: { id: interaction.user.id },
        data: { balance: { decrement: amount }, bankBalance: { increment: amount } },
      });
    });
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🏦 Deposited')
        .setDescription(`Deposited **${formatNumber(amount)} PokéCoins** into your bank.`)],
    });
  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      const currentBalance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
      await interaction.reply({ content: `You only have **${formatNumber(currentBalance)}** PokéCoins in your wallet.`, ephemeral: true });
    } else {
      console.error(error);
      await interaction.reply({ content: 'An error occurred during deposit.', ephemeral: true });
    }
  }
}

async function handleWithdraw(interaction: ChatInputCommandInteraction, client: BotClient) {
  const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
  if (!user) { await interaction.reply({ content: 'User not found!', ephemeral: true }); return; }

  const raw = interaction.options.getString('amount', true);
  const amount = raw.toLowerCase() === 'all' ? user.bankBalance : parseInt(raw);
  if (isNaN(amount) || amount <= 0) { await interaction.reply({ content: 'Invalid amount.', ephemeral: true }); return; }

  try {
    await client.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({ where: { id: interaction.user.id } });
      if (!currentUser || currentUser.bankBalance < amount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }
      await tx.user.update({
        where: { id: interaction.user.id },
        data: { bankBalance: { decrement: amount }, balance: { increment: amount } },
      });
    });
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🏦 Withdrawn')
        .setDescription(`Withdrew **${formatNumber(amount)} PokéCoins** to your wallet.`)],
    });
  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      const currentBankBalance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.bankBalance ?? 0;
      await interaction.reply({ content: `You only have **${formatNumber(currentBankBalance)}** PokéCoins in your bank.`, ephemeral: true });
    } else {
      console.error(error);
      await interaction.reply({ content: 'An error occurred during withdrawal.', ephemeral: true });
    }
  }
}

export default command;