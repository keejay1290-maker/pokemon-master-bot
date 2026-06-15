import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';

interface ShopItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  description: string;
}

const ALL_ITEMS: ShopItem[] = [
  // Poké Balls
  { id: 'poke_ball',     name: 'Poké Ball',     price: 200,    emoji: '🎾', description: 'Basic ball for catching Pokémon.' },
  { id: 'great_ball',    name: 'Great Ball',    price: 600,    emoji: '🔵', description: 'Better catch rate than Poké Ball.' },
  { id: 'ultra_ball',    name: 'Ultra Ball',    price: 1200,   emoji: '⚫', description: 'Excellent catch rate.' },
  { id: 'master_ball',   name: 'Master Ball',   price: 100000, emoji: '🟣', description: 'Catches any Pokémon without fail.' },
  // Utility
  { id: 'repel',         name: 'Repel',         price: 350,    emoji: '🧴', description: 'Prevents weak wild Pokémon appearing.' },
  { id: 'lure',          name: 'Lure',          price: 500,    emoji: '🎣', description: 'Increases spawn rate for 30 min.' },
  { id: 'shiny_charm',   name: 'Shiny Charm',   price: 50000,  emoji: '✨', description: 'Increases Shiny encounter rate (3×).' },
  { id: 'coin_case',     name: 'Coin Case',     price: 5000,   emoji: '💰', description: 'Slightly increases daily reward.' },
  { id: 'amulet_coin',   name: 'Amulet Coin',   price: 25000,  emoji: '🪙', description: 'Doubles coins from /work shifts.' },
  // Exp Candy
  { id: 'exp_candy_s',   name: 'Exp. Candy S',  price: 1000,   emoji: '🍬', description: 'Gives your Pokémon experience points.' },
  { id: 'exp_candy_m',   name: 'Exp. Candy M',  price: 3000,   emoji: '🍭', description: 'Gives more experience points.' },
  { id: 'exp_candy_xl',  name: 'Exp. Candy XL', price: 10000,  emoji: '🍫', description: 'Gives a large amount of experience.' },
  // Career Tools
  { id: 'old_rod',       name: 'Old Rod',       price: 1500,   emoji: '🎣', description: 'Basic fishing rod for /fisher.' },
  { id: 'good_rod',      name: 'Good Rod',      price: 5000,   emoji: '🎣', description: 'Better rod, rarer encounters.' },
  { id: 'super_rod',     name: 'Super Rod',     price: 15000,  emoji: '🎣', description: 'Top-tier rod, max fisher rewards.' },
  { id: 'research_kit',  name: 'Research Kit',  price: 3000,   emoji: '🔬', description: 'Improves researcher rewards + XP.' },
  { id: 'field_scanner', name: 'Field Scanner', price: 8000,   emoji: '📡', description: 'Boosts ranger rare encounter rates.' },
  { id: 'incubator',     name: 'Incubator',     price: 4000,   emoji: '🥚', description: 'Improves breeder egg rewards.' },
  { id: 'pickaxe',       name: 'Pickaxe',       price: 2000,   emoji: '⛏️', description: 'Required for /miner career.' },
  { id: 'drill',         name: 'Drill',         price: 10000,  emoji: '🔩', description: 'Advanced drill, unlocks fossils.' },
];

const CATEGORIES = [
  { id: 'balls',   label: 'Poké Balls',   emoji: '🎾', ids: ['poke_ball', 'great_ball', 'ultra_ball', 'master_ball'] },
  { id: 'utility', label: 'Utility',      emoji: '🧪', ids: ['repel', 'lure', 'shiny_charm', 'coin_case', 'amulet_coin'] },
  { id: 'candy',   label: 'Exp. Candy',   emoji: '🍬', ids: ['exp_candy_s', 'exp_candy_m', 'exp_candy_xl'] },
  { id: 'career',  label: 'Career Tools', emoji: '⛏️', ids: ['old_rod', 'good_rod', 'super_rod', 'research_kit', 'field_scanner', 'incubator', 'pickaxe', 'drill'] },
];

const ITEM_MAP = new Map<string, ShopItem>(ALL_ITEMS.map((i) => [i.id, i]));

// ── Builders ──────────────────────────────────────────────────────────────────

function catMenuRow() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('s_cat')
      .setPlaceholder('📂 Choose a category...')
      .addOptions(CATEGORIES.map((c) => ({
        label: `${c.emoji} ${c.label}`,
        value: c.id,
        description: `${c.ids.length} items available`,
      })))
  );
}

function itemMenuRow(catId: string) {
  const cat = CATEGORIES.find((c) => c.id === catId)!;
  const items = cat.ids.map((id) => ITEM_MAP.get(id)!).filter(Boolean);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`s_item:${catId}`)
      .setPlaceholder('🛒 Select an item to buy...')
      .addOptions(items.map((it) => ({
        label: `${it.emoji} ${it.name}`,
        value: it.id,
        description: `${formatNumber(it.price)} coins — ${it.description.slice(0, 50)}`,
      })))
  );
}

function qtyRow(itemId: string, qty: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    [1, 5, 10, 25].map((q) =>
      new ButtonBuilder()
        .setCustomId(`s_qty:${itemId}:${q}`)
        .setLabel(`×${q}`)
        .setStyle(q === qty ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );
}

function actionRow(itemId: string, qty: number, catId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`s_buy:${itemId}:${qty}`)
      .setLabel(`✅ Buy ×${qty}`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`s_back:${catId}`)
      .setLabel('◀ Back')
      .setStyle(ButtonStyle.Secondary),
  );
}

function backRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('s_main')
      .setLabel('◀ All Categories')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ── Embeds ────────────────────────────────────────────────────────────────────

function catEmbed(balance: number) {
  return new EmbedBuilder()
    .setColor(0xffcb05)
    .setTitle('🏪 PokéMart')
    .setDescription(`**Balance:** ${formatNumber(balance)} PokéCoins\n\nSelect a category to browse items and buy directly — no typing needed.`)
    .setFooter({ text: 'PokéMart • Select a category to get started' });
}

function itemsEmbed(catId: string, balance: number) {
  const cat = CATEGORIES.find((c) => c.id === catId)!;
  const items = cat.ids.map((id) => ITEM_MAP.get(id)!).filter(Boolean);
  const lines = items.map((it) => `${it.emoji} **${it.name}** — ${formatNumber(it.price)} coins\n${it.description}`);
  return new EmbedBuilder()
    .setColor(0xffcb05)
    .setTitle(`🏪 ${cat.emoji} ${cat.label}`)
    .setDescription(`**Balance:** ${formatNumber(balance)} PokéCoins\n\n${lines.join('\n\n')}`)
    .setFooter({ text: 'Select an item from the menu below' });
}

function buyEmbed(item: ShopItem, qty: number, balance: number) {
  const total = item.price * qty;
  const canAfford = balance >= total;
  return new EmbedBuilder()
    .setColor(canAfford ? 0x00cc44 : 0xff4444)
    .setTitle(`${item.emoji} ${item.name}`)
    .setDescription(item.description)
    .addFields(
      { name: '💰 Unit Price', value: `${formatNumber(item.price)} PokéCoins`, inline: true },
      { name: '🔢 Quantity',   value: `×${qty}`, inline: true },
      { name: '🧾 Total',      value: `${formatNumber(total)} PokéCoins`, inline: true },
      { name: '💳 Balance',    value: `${formatNumber(balance)} PokéCoins${canAfford ? '' : ' ❌'}`, inline: true },
    )
    .setFooter({ text: canAfford ? 'Pick a quantity then click Buy' : 'Not enough coins — try a smaller quantity' });
}

// ── Command ───────────────────────────────────────────────────────────────────

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse and buy items from the PokéMart — select, pick quantity, and buy with buttons'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();

    let balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
    let currentCat: string | null = null;
    let currentItem: ShopItem | null = null;
    let currentQty = 1;

    const reply = await interaction.editReply({
      embeds: [catEmbed(balance)],
      components: [catMenuRow()],
    });

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 120_000,
    });

    collector.on('collect', async (i) => {
      await i.deferUpdate();

      // Back to main category list
      if (i.customId === 's_main') {
        balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
        currentCat = null; currentItem = null; currentQty = 1;
        await interaction.editReply({ embeds: [catEmbed(balance)], components: [catMenuRow()] });
        return;
      }

      // Category chosen from select menu
      if (i.isStringSelectMenu() && i.customId === 's_cat') {
        currentCat = i.values[0];
        currentItem = null; currentQty = 1;
        balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
        await interaction.editReply({ embeds: [itemsEmbed(currentCat, balance)], components: [itemMenuRow(currentCat), backRow()] });
        return;
      }

      // Item chosen from select menu
      if (i.isStringSelectMenu() && i.customId.startsWith('s_item:')) {
        currentCat = i.customId.split(':')[1];
        currentItem = ITEM_MAP.get(i.values[0]) ?? null;
        currentQty = 1;
        if (!currentItem) return;
        balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
        await interaction.editReply({ embeds: [buyEmbed(currentItem, currentQty, balance)], components: [qtyRow(currentItem.id, currentQty), actionRow(currentItem.id, currentQty, currentCat)] });
        return;
      }

      // Quantity button
      if (i.isButton() && i.customId.startsWith('s_qty:')) {
        const [, itemId, qtyStr] = i.customId.split(':');
        currentQty = parseInt(qtyStr, 10);
        currentItem = ITEM_MAP.get(itemId) ?? currentItem;
        if (!currentItem || !currentCat) return;
        await interaction.editReply({ embeds: [buyEmbed(currentItem, currentQty, balance)], components: [qtyRow(currentItem.id, currentQty), actionRow(currentItem.id, currentQty, currentCat)] });
        return;
      }

      // Back to category from buy view
      if (i.isButton() && i.customId.startsWith('s_back:')) {
        currentCat = i.customId.split(':')[1];
        currentItem = null; currentQty = 1;
        balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
        await interaction.editReply({ embeds: [itemsEmbed(currentCat, balance)], components: [itemMenuRow(currentCat), backRow()] });
        return;
      }

      // Execute purchase
      if (i.isButton() && i.customId.startsWith('s_buy:')) {
        const [, itemId, qtyStr] = i.customId.split(':');
        const item = ITEM_MAP.get(itemId);
        const qty = parseInt(qtyStr, 10);
        if (!item) return;
        const total = item.price * qty;

        try {
          await client.prisma.$transaction(async (tx) => {
            const u = await tx.user.findUnique({ where: { id: interaction.user.id } });
            if (!u || u.balance < total) throw new Error('INSUFFICIENT_FUNDS');
            await tx.user.update({
              where: { id: interaction.user.id },
              data: { balance: { decrement: total }, totalSpent: { increment: total } },
            });
            await tx.userInventory.upsert({
              where: { userId_itemId: { userId: interaction.user.id, itemId: item.id } },
              update: { quantity: { increment: qty } },
              create: { userId: interaction.user.id, itemId: item.id, itemName: item.name, quantity: qty },
            });
          });

          balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;

          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0x00cc44)
              .setTitle('✅ Purchase Complete!')
              .setDescription(`You bought **${qty}× ${item.emoji} ${item.name}**!`)
              .addFields(
                { name: '💰 Spent',   value: `${formatNumber(total)} PokéCoins`, inline: true },
                { name: '💳 Balance', value: `${formatNumber(balance)} PokéCoins`, inline: true },
              )
              .setFooter({ text: 'Select another category to keep shopping' })],
            components: [catMenuRow()],
          });
        } catch (e: any) {
          if (e.message === 'INSUFFICIENT_FUNDS') {
            balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
            await interaction.editReply({
              embeds: [buyEmbed(item, qty, balance)],
              components: [qtyRow(item.id, qty), actionRow(item.id, qty, currentCat ?? 'balls')],
            });
          }
        }
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};

export default command;
