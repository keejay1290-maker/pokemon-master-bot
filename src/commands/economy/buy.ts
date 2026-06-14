import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';
import { addBalance } from '../../services/userService.js';

const SHOP_ITEMS = [
  { id: 'poke_ball', name: 'Poké Ball', price: 200, emoji: '🎾', description: 'A basic ball for catching Pokémon.' },
  { id: 'great_ball', name: 'Great Ball', price: 600, emoji: '🔵', description: 'Better catch rate than a Poké Ball.' },
  { id: 'ultra_ball', name: 'Ultra Ball', price: 1200, emoji: '⚫', description: 'Excellent catch rate.' },
  { id: 'master_ball', name: 'Master Ball', price: 100000, emoji: '🟣', description: 'Catches any Pokémon without fail.' },
  { id: 'repel', name: 'Repel', price: 350, emoji: '🧴', description: 'Prevents weak wild Pokémon from appearing.' },
  { id: 'lure', name: 'Lure', price: 500, emoji: '🎣', description: 'Increases spawn rate for 30 minutes.' },
  { id: 'exp_candy_s', name: 'Exp. Candy S', price: 1000, emoji: '🍬', description: 'Gives your Pokémon experience points.' },
  { id: 'exp_candy_m', name: 'Exp. Candy M', price: 3000, emoji: '🍭', description: 'Gives more experience points.' },
  { id: 'exp_candy_xl', name: 'Exp. Candy XL', price: 10000, emoji: '🍫', description: 'Gives a large amount of experience.' },
  { id: 'shiny_charm', name: 'Shiny Charm', price: 50000, emoji: '✨', description: 'Increases Shiny encounter rate.' },
  { id: 'coin_case', name: 'Coin Case', price: 5000, emoji: '💰', description: 'Slightly increases daily reward.' },
  { id: 'amulet_coin', name: 'Amulet Coin', price: 25000, emoji: '🪙', description: 'Doubles coins from work shifts.' },
  // Career equipment
  { id: 'old_rod', name: 'Old Rod', price: 1500, emoji: '🎣', description: 'Basic fishing rod. Increases fisher rewards.' },
  { id: 'good_rod', name: 'Good Rod', price: 5000, emoji: '🎣', description: 'Better rod. Unlocks rarer fisher encounters.' },
  { id: 'super_rod', name: 'Super Rod', price: 15000, emoji: '🎣', description: 'Top-tier rod. Max fisher rewards.' },
  { id: 'research_kit', name: 'Research Kit', price: 3000, emoji: '🔬', description: 'Improves researcher rewards and XP.' },
  { id: 'field_scanner', name: 'Field Scanner', price: 8000, emoji: '📡', description: 'Boosts ranger rare encounter rates.' },
  { id: 'incubator', name: 'Incubator', price: 4000, emoji: '🥚', description: 'Improves breeder egg rewards.' },
  { id: 'pickaxe', name: 'Pickaxe', price: 2000, emoji: '⛏️', description: 'Basic mining tool. Required for /miner.' },
  { id: 'drill', name: 'Drill', price: 10000, emoji: '🔩', description: 'Advanced drill. Unlocks fossil rewards.' },
];

// Normalized lookup: strip spaces/accents, lowercase
function normalizeItemName(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item from the PokéShop')
    .addStringOption((o) =>
      o.setName('item').setDescription('Name of the item to buy (e.g. Ultra Ball, Pickaxe)').setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName('quantity').setDescription('How many to buy (default 1)').setMinValue(1).setMaxValue(99)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const itemInput = interaction.options.getString('item', true);
    const qty = interaction.options.getInteger('quantity') ?? 1;

    const item = SHOP_ITEMS.find(
      (i) =>
        normalizeItemName(i.name) === normalizeItemName(itemInput) ||
        i.id === itemInput.toLowerCase().replace(/\s/g, '_')
    );

    if (!item) {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle('❌ Item Not Found')
          .setDescription(`No item called **${itemInput}** in the PokéShop.\nUse \`/shop\` to see all items.`)],
        ephemeral: true,
      });
      return;
    }

    const totalCost = item.price * qty;
    const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });

    if (!user || user.balance < totalCost) {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle('❌ Insufficient Funds')
          .setDescription(
            `You need **${formatNumber(totalCost)} PokéCoins** but only have **${formatNumber(user?.balance ?? 0)}**.`
          )],
        ephemeral: true,
      });
      return;
    }

    try {
      await addBalance(client.prisma, interaction.user.id, -totalCost);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Purchase Successful!')
          .setDescription(`You bought **${qty}x ${item.emoji} ${item.name}** for **${formatNumber(totalCost)} PokéCoins**.`)
          .addFields(
            { name: '💰 Spent', value: `${formatNumber(totalCost)} PokéCoins`, inline: true },
            { name: '💳 Remaining', value: `${formatNumber(user.balance - totalCost)} PokéCoins`, inline: true },
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
