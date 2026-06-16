import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { PricingService } from '../../services/PricingService.js';

// ── Category definitions ──────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'balls',   label: 'Poké Balls',   emoji: '🎾', ids: ['poke_ball', 'great_ball', 'ultra_ball', 'master_ball'] },
  { id: 'utility', label: 'Utility',      emoji: '🧪', ids: ['repel', 'lure', 'shiny_charm', 'coin_case', 'amulet_coin', 'oran_berry', 'exp_shard'] },
  { id: 'candy',   label: 'Exp. Candy',   emoji: '🍬', ids: ['exp_candy_s', 'exp_candy_m', 'exp_candy_xl'] },
  { id: 'career',  label: 'Career Tools', emoji: '⛏️', ids: ['old_rod', 'good_rod', 'super_rod', 'research_kit', 'field_scanner', 'incubator', 'pickaxe', 'drill',
    'iron_pickaxe', 'steel_pickaxe', 'diamond_drill', 'tracking_kit', 'ranger_gear', 'pokedex_pro', 'data_analyzer',
    'gadget_kit', 'hacking_tools', 'master_plan', 'improved_incubator', 'advanced_incubator', 'perfect_incubator'] },
];

function formatGamePrice(price: number): string {
  return `${price.toLocaleString()} PokéCoins`;
}

function formatBalance(balance: number): string {
  return `${balance.toLocaleString()} PokéCoins`;
}

// ── UI Builders ──────────────────────────────────────────────────────────────

function catMenuRow(_pricing: PricingService) {
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

function itemMenuRow(catId: string, pricing: PricingService) {
  const cat = CATEGORIES.find((c) => c.id === catId)!;
  const items = cat.ids.map((id) => pricing.getPrice(id)).filter(Boolean);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`s_item:${catId}`)
      .setPlaceholder('🛒 Select an item to buy...')
      .addOptions(items.map((it) => ({
        label: `${it!.emoji} ${it!.name}`,
        value: it!.itemId,
        description: `${formatGamePrice(it!.gamePrice)} — ${it!.description.slice(0, 50)}`,
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
    .setDescription(`**Balance:** ${formatBalance(balance)}\n\nSelect a category to browse items and buy directly — no typing needed.`)
    .setFooter({ text: 'PokéMart • Select a category to get started' });
}

function itemsEmbed(catId: string, balance: number, pricing: PricingService) {
  const cat = CATEGORIES.find((c) => c.id === catId)!;
  const items = cat.ids.map((id) => pricing.getPrice(id)).filter(Boolean);
  const lines = items.map((it) => `${it!.emoji} **${it!.name}** — ${formatGamePrice(it!.gamePrice)}\n${it!.description}`);
  return new EmbedBuilder()
    .setColor(0xffcb05)
    .setTitle(`🏪 ${cat.emoji} ${cat.label}`)
    .setDescription(`**Balance:** ${formatBalance(balance)}\n\n${lines.join('\n\n')}`)
    .setFooter({ text: 'Select an item from the menu below' });
}

function buyEmbed(item: { itemId: string; name: string; gamePrice: number; emoji: string; description: string }, qty: number, balance: number) {
  const totalCost = item.gamePrice * qty;
  const canAfford = balance >= totalCost;
  return new EmbedBuilder()
    .setColor(canAfford ? 0x00cc44 : 0xff4444)
    .setTitle(`${item.emoji} ${item.name}`)
    .setDescription(item.description)
    .addFields(
      { name: '💰 Unit Price', value: formatGamePrice(item.gamePrice), inline: true },
      { name: '🔢 Quantity',   value: `×${qty}`, inline: true },
      { name: '🧾 Total',      value: formatGamePrice(totalCost), inline: true },
      { name: '💳 Balance',    value: `${formatBalance(balance)}${canAfford ? '' : ' ❌'}`, inline: true },
    )
    .setFooter({ text: canAfford ? 'Pick a quantity then click Buy' : 'Not enough PokéCoins — try a smaller quantity' });
}

// ── Shared handler (used by both /shop and /buy) ──────────────────────────────

export async function openShop(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();

    const pricing = new PricingService(client);
    await pricing.init();

    let balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
    let currentCat: string | null = null;
    let currentItem: { itemId: string; name: string; gamePrice: number; emoji: string; description: string } | null = null;
    let currentQty = 1;

    const reply = await interaction.editReply({
      embeds: [catEmbed(balance)],
      components: [catMenuRow(pricing)],
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
        await interaction.editReply({ embeds: [catEmbed(balance)], components: [catMenuRow(pricing)] });
        return;
      }

      // Category chosen from select menu
      if (i.isStringSelectMenu() && i.customId === 's_cat') {
        currentCat = i.values[0];
        currentItem = null; currentQty = 1;
        balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
        await interaction.editReply({ embeds: [itemsEmbed(currentCat, balance, pricing)], components: [itemMenuRow(currentCat, pricing), backRow()] });
        return;
      }

      // Item chosen from select menu
      if (i.isStringSelectMenu() && i.customId.startsWith('s_item:')) {
        currentCat = i.customId.split(':')[1];
        const priceData = pricing.getPrice(i.values[0]);
        currentItem = priceData ? { itemId: priceData.itemId, name: priceData.name, gamePrice: priceData.gamePrice, emoji: priceData.emoji, description: priceData.description } : null;
        currentQty = 1;
        if (!currentItem) return;
        balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
        await interaction.editReply({ embeds: [buyEmbed(currentItem, currentQty, balance)], components: [qtyRow(currentItem.itemId, currentQty), actionRow(currentItem.itemId, currentQty, currentCat)] });
        return;
      }

      // Quantity button
      if (i.isButton() && i.customId.startsWith('s_qty:')) {
        const [, itemId, qtyStr] = i.customId.split(':');
        currentQty = parseInt(qtyStr, 10);
        const priceData = pricing.getPrice(itemId);
        if (priceData) currentItem = { itemId: priceData.itemId, name: priceData.name, gamePrice: priceData.gamePrice, emoji: priceData.emoji, description: priceData.description };
        if (!currentItem || !currentCat) return;
        await interaction.editReply({ embeds: [buyEmbed(currentItem, currentQty, balance)], components: [qtyRow(currentItem.itemId, currentQty), actionRow(currentItem.itemId, currentQty, currentCat)] });
        return;
      }

      // Back to category from buy view
      if (i.isButton() && i.customId.startsWith('s_back:')) {
        currentCat = i.customId.split(':')[1];
        currentItem = null; currentQty = 1;
        balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
        await interaction.editReply({ embeds: [itemsEmbed(currentCat, balance, pricing)], components: [itemMenuRow(currentCat, pricing), backRow()] });
        return;
      }

      // Execute purchase
      if (i.isButton() && i.customId.startsWith('s_buy:')) {
        const [, itemId, qtyStr] = i.customId.split(':');
        const priceData = pricing.getPrice(itemId);
        const qty = parseInt(qtyStr, 10);
        if (!priceData) return;
        const totalCost = priceData.gamePrice * qty;

        try {
          await client.prisma.$transaction(async (tx) => {
            const u = await tx.user.findUnique({ where: { id: interaction.user.id } });
            if (!u || u.balance < totalCost) throw new Error('INSUFFICIENT_FUNDS');
            await tx.user.update({
              where: { id: interaction.user.id },
              data: { balance: { decrement: totalCost }, totalSpent: { increment: totalCost } },
            });
            await tx.userInventory.upsert({
              where: { userId_itemId: { userId: interaction.user.id, itemId: priceData.itemId } },
              update: { quantity: { increment: qty } },
              create: { userId: interaction.user.id, itemId: priceData.itemId, itemName: priceData.name, quantity: qty },
            });
          });

          balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;

          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0x00cc44)
              .setTitle('✅ Purchase Complete!')
              .setDescription(`You bought **${qty}× ${priceData.emoji} ${priceData.name}**!`)
              .addFields(
                { name: '💰 Spent',   value: formatGamePrice(totalCost), inline: true },
                { name: '💳 Balance', value: formatBalance(balance), inline: true },
              )
              .setFooter({ text: 'Select another category to keep shopping' })],
            components: [catMenuRow(pricing)],
          });
        } catch (e: any) {
          if (e.message === 'INSUFFICIENT_FUNDS') {
            balance = (await client.prisma.user.findUnique({ where: { id: interaction.user.id } }))?.balance ?? 0;
            await interaction.editReply({
              embeds: [buyEmbed(currentItem ?? { itemId: priceData.itemId, name: priceData.name, gamePrice: priceData.gamePrice, emoji: priceData.emoji, description: priceData.description }, qty, balance)],
              components: [qtyRow(priceData.itemId, qty), actionRow(priceData.itemId, qty, currentCat ?? 'balls')],
            });
          }
        }
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
}

// ── Command ───────────────────────────────────────────────────────────────────

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse and buy items from the PokéMart'),
  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    return openShop(interaction, client);
  },
};

export default command;