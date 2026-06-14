import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';
import { transferBalance } from '../../services/userService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Send PokéCoins to another trainer')
    .addUserOption((o) => o.setName('user').setDescription('Trainer to pay').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('Amount of PokéCoins to send').setRequired(true).setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const target = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "You can't pay yourself.", ephemeral: true });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "You can't pay bots.", ephemeral: true });
      return;
    }

    const sender = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
    if (!sender || sender.balance < amount) {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle('❌ Insufficient Funds')
          .setDescription(`You only have **${formatNumber(sender?.balance ?? 0)} PokéCoins**.`)],
        ephemeral: true,
      });
      return;
    }

    try {
      await transferBalance(client.prisma, interaction.user.id, target.id, amount);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('💸 Payment Sent!')
          .setDescription(`You sent **${formatNumber(amount)} PokéCoins** to ${target}!`)
          .addFields(
            { name: '📤 From', value: interaction.user.username, inline: true },
            { name: '📥 To', value: target.username, inline: true },
            { name: '💰 Amount', value: `${formatNumber(amount)} PokéCoins`, inline: true },
          )
          .setTimestamp()],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INSUFFICIENT_FUNDS') {
        await interaction.reply({ content: 'Not enough PokéCoins.', ephemeral: true });
      } else {
        throw err;
      }
    }
  },
};

export default command;
