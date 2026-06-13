import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';

const SHOP_ITEMS = [
  { id: 'poke_ball', name: 'Poké Ball', price: 200, emoji: '🎾', description: 'A basic ball for catching Pokemon.' },
  { id: 'great_ball', name: 'Great Ball', price: 600, emoji: '🔵', description: 'Better catch rate than a Poké Ball.' },
  { id: 'ultra_ball', name: 'Ultra Ball', price: 1200, emoji: '⚫', description: 'Excellent catch rate.' },
  { id: 'master_ball', name: 'Master Ball', price: 100000, emoji: '🟣', description: 'Catches any Pokemon without fail.' },
  { id: 'repel', name: 'Repel', price: 350, emoji: '🧴', description: 'Prevents weak wild Pokemon from appearing.' },
  { id: 'lure', name: 'Lure', price: 500, emoji: '🎣', description: 'Increases spawn rate for 30 minutes.' },
  { id: 'exp_candy_s', name: 'Exp. Candy S', price: 1000, emoji: '🍬', description: 'Gives your Pokemon experience points.' },
  { id: 'exp_candy_m', name: 'Exp. Candy M', price: 3000, emoji: '🍭', description: 'Gives more experience points.' },
  { id: 'exp_candy_xl', name: 'Exp. Candy XL', price: 10000, emoji: '🍫', description: 'Gives a large amount of experience.' },
  { id: 'shiny_charm', name: 'Shiny Charm', price: 50000, emoji: '✨', description: 'Increases Shiny encounter rate.' },
  { id: 'coin_case', name: 'Coin Case', price: 5000, emoji: '💰', description: 'Slightly increases daily reward.' },
  { id: 'amulet_coin', name: 'Amulet Coin', price: 25000, emoji: '🪙', description: 'Doubles coins from work shifts.' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse and buy items from the PokéShop'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });

    const embed = new EmbedBuilder()
      .setColor(0xffcb05)
      .setTitle('🏪 PokéMart')
      .setDescription(`**Your balance:** ${formatNumber(user?.balance ?? 0)} PokéCoins\nUse \`/buy <item>\` to purchase!\n\u200b`)
      .addFields(
        SHOP_ITEMS.map((item) => ({
          name: `${item.emoji} ${item.name}`,
          value: `${item.description}\n**Price:** ${formatNumber(item.price)} PokéCoins`,
          inline: true,
        }))
      )
      .setFooter({ text: 'New items added regularly!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
