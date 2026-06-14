import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';
import { transferBalance } from '../../services/userService.js';

type Bid = { userId: string; username: string; amount: number; at: string };

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('auction')
    .setDescription('List, bid on, or browse timed auctions')
    .addSubcommand((sub) =>
      sub.setName('create')
        .setDescription('Start an auction for something you own')
        .addStringOption((o) =>
          o.setName('type').setDescription('What are you auctioning?').setRequired(true).addChoices(
            { name: 'Pokémon', value: 'pokemon' },
            { name: 'Item', value: 'item' },
            { name: 'Pack', value: 'pack' },
          )
        )
        .addIntegerOption((o) => o.setName('start_bid').setDescription('Starting bid in PokéCoins').setRequired(true).setMinValue(1))
        .addIntegerOption((o) => o.setName('hours').setDescription('Auction duration in hours (1–72)').setRequired(true).setMinValue(1).setMaxValue(72))
        .addIntegerOption((o) => o.setName('buyout').setDescription('Optional instant buyout price'))
    )
    .addSubcommand((sub) =>
      sub.setName('bid')
        .setDescription('Place a bid on an active auction')
        .addStringOption((o) => o.setName('auction_id').setDescription('Auction ID from /auction browse').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('Your bid amount in PokéCoins').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('view')
        .setDescription('View an auction\'s current state')
        .addStringOption((o) => o.setName('auction_id').setDescription('Auction ID').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('browse')
        .setDescription('Browse all active auctions')
    )
    .addSubcommand((sub) =>
      sub.setName('cancel')
        .setDescription('Cancel your own active auction listing')
        .addStringOption((o) => o.setName('auction_id').setDescription('Auction ID to cancel').setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') await handleCreate(interaction, client);
    else if (sub === 'bid') await handleBid(interaction, client);
    else if (sub === 'view') await handleView(interaction, client);
    else if (sub === 'browse') await handleBrowse(interaction, client);
    else if (sub === 'cancel') await handleCancel(interaction, client);
  },
};

// ── CREATE ────────────────────────────────────────────────────────────────────

async function handleCreate(interaction: ChatInputCommandInteraction, client: BotClient) {
  if (!interaction.guild) { await interaction.reply({ content: 'Must be used in a server.', ephemeral: true }); return; }

  const type = interaction.options.getString('type', true);
  const startBid = interaction.options.getInteger('start_bid', true);
  const hours = interaction.options.getInteger('hours', true);
  const buyout = interaction.options.getInteger('buyout');

  // Load owned assets of the chosen type
  let options: Array<{ label: string; description: string; value: string }> = [];
  let itemData: Record<string, unknown> = {};

  if (type === 'pokemon') {
    const owned = await client.prisma.userPokemon.findMany({
      where: { userId: interaction.user.id },
      include: { pokemon: { select: { name: true } } },
      take: 25,
    });
    if (owned.length === 0) {
      await interaction.reply({ content: '❌ You have no Pokémon to auction.', ephemeral: true });
      return;
    }
    options = owned.map((up) => ({
      label: up.nickname ?? up.pokemon.name,
      description: `Level ${up.level}${up.isShiny ? ' ✨ Shiny' : ''} | ID: ${up.id.slice(-6).toUpperCase()}`,
      value: up.id,
    }));
  } else if (type === 'item') {
    const owned = await client.prisma.userInventory.findMany({
      where: { userId: interaction.user.id, quantity: { gt: 0 }, itemId: { not: { startsWith: 'pack:' } } },
      take: 25,
    });
    if (owned.length === 0) {
      await interaction.reply({ content: '❌ You have no items to auction.', ephemeral: true });
      return;
    }
    options = owned.map((inv) => ({
      label: inv.itemName,
      description: `×${inv.quantity} owned`,
      value: inv.itemId,
    }));
  } else if (type === 'pack') {
    const owned = await client.prisma.userInventory.findMany({
      where: { userId: interaction.user.id, quantity: { gt: 0 }, itemId: { startsWith: 'pack:' } },
      take: 25,
    });
    if (owned.length === 0) {
      await interaction.reply({ content: '❌ You have no packs to auction.', ephemeral: true });
      return;
    }
    options = owned.map((inv) => ({
      label: inv.itemName,
      description: `×${inv.quantity} owned`,
      value: inv.itemId,
    }));
  }

  await interaction.deferReply({ ephemeral: true });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`auction_create_select:${interaction.user.id}`)
    .setPlaceholder(`Select a ${type} to auction...`)
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const reply = await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🔨 Create Auction')
      .setDescription(`Select the **${type}** you want to auction.\nStarting bid: **${formatNumber(startBid)} PokéCoins** | Duration: **${hours}h**`)],
    components: [row],
  });

  try {
    const selection = await reply.awaitMessageComponent({
      filter: (i): i is StringSelectMenuInteraction => i.isStringSelectMenu() && i.user.id === interaction.user.id,
      time: 30_000,
    }) as StringSelectMenuInteraction;

    const selectedValue = selection.values[0];

    // Ownership re-validation at listing time
    if (type === 'pokemon') {
      const pokemon = await client.prisma.userPokemon.findUnique({ where: { id: selectedValue } });
      if (!pokemon || pokemon.userId !== interaction.user.id) {
        await selection.update({ content: '❌ You do not own this Pokémon.', embeds: [], components: [] });
        return;
      }
      itemData = { name: options.find((o) => o.value === selectedValue)?.label ?? 'Pokémon', userPokemonId: selectedValue, type: 'pokemon' };
    } else if (type === 'item') {
      const inv = await client.prisma.userInventory.findUnique({
        where: { userId_itemId: { userId: interaction.user.id, itemId: selectedValue } },
      });
      if (!inv || inv.quantity < 1) {
        await selection.update({ content: '❌ You do not own this item.', embeds: [], components: [] });
        return;
      }
      // Escrow: deduct 1 from inventory while listed
      await client.prisma.userInventory.update({
        where: { userId_itemId: { userId: interaction.user.id, itemId: selectedValue } },
        data: { quantity: { decrement: 1 } },
      });
      itemData = { name: inv.itemName, itemId: selectedValue, type: 'item' };
    } else if (type === 'pack') {
      const inv = await client.prisma.userInventory.findUnique({
        where: { userId_itemId: { userId: interaction.user.id, itemId: selectedValue } },
      });
      if (!inv || inv.quantity < 1) {
        await selection.update({ content: '❌ You do not own this pack.', embeds: [], components: [] });
        return;
      }
      // Escrow: deduct 1 pack while listed
      if (inv.quantity === 1) {
        await client.prisma.userInventory.delete({
          where: { userId_itemId: { userId: interaction.user.id, itemId: selectedValue } },
        });
      } else {
        await client.prisma.userInventory.update({
          where: { userId_itemId: { userId: interaction.user.id, itemId: selectedValue } },
          data: { quantity: { decrement: 1 } },
        });
      }
      itemData = { name: inv.itemName, itemId: selectedValue, type: 'pack' };
    }

    const auctionEndsAt = new Date(Date.now() + hours * 3600000);
    const listing = await client.prisma.marketListing.create({
      data: {
        sellerId: interaction.user.id,
        guildId: interaction.guild!.id,
        type,
        itemData: itemData as any,
        price: startBid,
        currentBid: startBid,
        buyoutPrice: buyout ?? null,
        isAuction: true,
        auctionEndsAt,
        bids: [] as any,
        status: 'active',
      },
    });

    const shortId = listing.id.slice(-6).toUpperCase();

    await selection.update({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🔨 Auction Created!')
        .setDescription(`**${(itemData.name as string)}** is now up for auction.`)
        .addFields(
          { name: '🆔 Auction ID', value: shortId, inline: true },
          { name: '💰 Starting Bid', value: `${formatNumber(startBid)} PokéCoins`, inline: true },
          { name: '⏰ Ends In', value: `${hours}h`, inline: true },
          ...(buyout ? [{ name: '⚡ Buyout', value: `${formatNumber(buyout)} PokéCoins`, inline: true }] : []),
        )
        .setFooter({ text: 'Use /auction bid <ID> <amount> to bid' })
        .setTimestamp()],
      components: [],
    });
  } catch {
    await interaction.editReply({ components: [] }).catch(() => {});
  }
}

// ── BID ───────────────────────────────────────────────────────────────────────

async function handleBid(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const shortId = interaction.options.getString('auction_id', true).toUpperCase();
  const amount = interaction.options.getInteger('amount', true);

  const listing = await client.prisma.marketListing.findFirst({
    where: { id: { endsWith: shortId.toLowerCase() }, isAuction: true, status: 'active' },
  });

  if (!listing) { await interaction.editReply({ content: 'Auction not found or has ended.' }); return; }
  if (listing.sellerId === interaction.user.id) { await interaction.editReply({ content: "You can't bid on your own auction." }); return; }
  if (listing.auctionEndsAt && listing.auctionEndsAt < new Date()) {
    await interaction.editReply({ content: 'This auction has already ended.' }); return;
  }

  const currentBid = listing.currentBid ?? listing.price;
  if (amount <= currentBid) {
    await interaction.editReply({ content: `Bid must exceed current bid of **${formatNumber(currentBid)} PokéCoins**.` });
    return;
  }

  const bidder = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
  if (!bidder || bidder.balance < amount) {
    await interaction.editReply({ content: `Not enough PokéCoins. Need **${formatNumber(amount)}**.` });
    return;
  }

  const bids = (listing.bids as Bid[] | null) ?? [];
  const previousTopBidder = bids.length > 0 ? bids[bids.length - 1] : null;

  bids.push({ userId: interaction.user.id, username: interaction.user.username, amount, at: new Date().toISOString() });

  const isBuyout = listing.buyoutPrice !== null && amount >= (listing.buyoutPrice ?? Infinity);

  await client.prisma.marketListing.update({
    where: { id: listing.id },
    data: { currentBid: amount, bids, ...(isBuyout ? { status: 'sold' } : {}) },
  });

  // Outbid DM to previous top bidder
  if (previousTopBidder && previousTopBidder.userId !== interaction.user.id) {
    try {
      const prevUser = await client.users.fetch(previousTopBidder.userId).catch(() => null);
      if (prevUser) {
        const data = listing.itemData as Record<string, unknown>;
        await prevUser.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff6b00)
            .setTitle('🔨 You\'ve Been Outbid!')
            .setDescription(`Someone placed a higher bid on **${(data.name as string) ?? 'your auction item'}**.\nNew top bid: **${formatNumber(amount)} PokéCoins**`)
            .setFooter({ text: `Auction ID: ${listing.id.slice(-6).toUpperCase()}` })
            .setTimestamp()],
        }).catch(() => {});
      }
    } catch { /* DMs closed */ }
  }

  if (isBuyout) {
    try {
      await transferBalance(client.prisma, interaction.user.id, listing.sellerId, amount);
      await client.prisma.marketPurchase.create({ data: { listingId: listing.id, buyerId: interaction.user.id, price: amount } });
    } catch {
      await interaction.editReply({ content: 'Buyout failed — balance transfer error.' });
      return;
    }

    const data = listing.itemData as Record<string, unknown>;
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('⚡ Buyout Complete!')
        .setDescription(`You instantly bought **${(data.name as string) ?? 'item'}** for **${formatNumber(amount)} PokéCoins**!`)
        .setTimestamp()],
    });
    return;
  }

  const timeLeft = listing.auctionEndsAt ? Math.max(0, Math.floor((listing.auctionEndsAt.getTime() - Date.now()) / 60000)) : '?';

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🔨 Bid Placed!')
      .setDescription(`You bid **${formatNumber(amount)} PokéCoins** on this auction.`)
      .addFields(
        { name: '🏆 Current High Bid', value: `${formatNumber(amount)} PokéCoins`, inline: true },
        { name: '⏰ Time Left', value: `~${timeLeft}m`, inline: true },
        { name: '📊 Total Bids', value: `${bids.length}`, inline: true },
      )
      .setTimestamp()],
  });
}

// ── VIEW ──────────────────────────────────────────────────────────────────────

async function handleView(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const shortId = interaction.options.getString('auction_id', true).toUpperCase();

  const listing = await client.prisma.marketListing.findFirst({
    where: { id: { endsWith: shortId.toLowerCase() }, isAuction: true },
    include: { seller: { select: { username: true } } },
  });

  if (!listing) { await interaction.editReply({ content: 'Auction not found.' }); return; }

  const data = listing.itemData as Record<string, unknown>;
  const bids = (listing.bids as Bid[] | null) ?? [];
  const topBid = bids.length > 0 ? bids[bids.length - 1] : null;
  const timeLeft = listing.auctionEndsAt
    ? listing.auctionEndsAt < new Date() ? 'Ended' : `~${Math.floor((listing.auctionEndsAt.getTime() - Date.now()) / 60000)}m`
    : 'Unknown';

  const embed = new EmbedBuilder()
    .setColor(listing.status === 'active' ? 0x9b59b6 : 0x888888)
    .setTitle(`🔨 Auction — ${(data.name as string) ?? 'Item'}`)
    .addFields(
      { name: '📦 Type', value: listing.type, inline: true },
      { name: '💰 Starting Bid', value: `${formatNumber(listing.price)} PokéCoins`, inline: true },
      { name: '🏆 Current Bid', value: `${formatNumber(listing.currentBid ?? listing.price)} PokéCoins`, inline: true },
      { name: '👤 Seller', value: listing.seller.username, inline: true },
      { name: '⏰ Time Left', value: timeLeft, inline: true },
      { name: '📊 Bids', value: `${bids.length}`, inline: true },
    );

  if (topBid) embed.addFields({ name: '🥇 Top Bidder', value: `${topBid.username} — ${formatNumber(topBid.amount)} PokéCoins`, inline: false });
  if (listing.buyoutPrice) embed.addFields({ name: '⚡ Buyout Price', value: `${formatNumber(listing.buyoutPrice)} PokéCoins`, inline: true });

  await interaction.editReply({ embeds: [embed] });
}

// ── BROWSE ────────────────────────────────────────────────────────────────────

async function handleBrowse(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();

  const auctions = await client.prisma.marketListing.findMany({
    where: { isAuction: true, status: 'active' },
    include: { seller: { select: { username: true } } },
    orderBy: { auctionEndsAt: 'asc' },
    take: 10,
  });

  if (auctions.length === 0) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle('🔨 Auctions').setDescription('No active auctions. Start one with `/auction create`!')],
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🔨 Active Auctions')
    .setDescription(auctions.map((a) => {
      const d = a.itemData as Record<string, unknown>;
      const name = (d.name as string) ?? 'Item';
      const shortId = a.id.slice(-6).toUpperCase();
      const timeLeft = a.auctionEndsAt ? `${Math.max(0, Math.floor((a.auctionEndsAt.getTime() - Date.now()) / 3600000))}h` : '?';
      const bids = (a.bids as Bid[] | null)?.length ?? 0;
      return `**[${shortId}]** **${name}** (${a.type}) — ${formatNumber(a.currentBid ?? a.price)} PokéCoins | ${bids} bids | ⏰ ${timeLeft} | ${a.seller.username}`;
    }).join('\n'))
    .setFooter({ text: 'Use /auction bid <ID> <amount> to bid | /auction view <ID> for details' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── CANCEL ────────────────────────────────────────────────────────────────────

async function handleCancel(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply({ ephemeral: true });
  const shortId = interaction.options.getString('auction_id', true).toUpperCase();

  const listing = await client.prisma.marketListing.findFirst({
    where: { id: { endsWith: shortId.toLowerCase() }, isAuction: true, status: 'active' },
  });

  if (!listing) { await interaction.editReply('❌ Auction not found or already ended.'); return; }

  const isOwner = listing.sellerId === interaction.user.id;
  const isMod = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (!isOwner && !isMod) {
    await interaction.editReply('❌ Only the listing owner or a moderator can cancel this auction.');
    return;
  }

  const bids = (listing.bids as Bid[] | null) ?? [];
  if (bids.length > 0) {
    await interaction.editReply('❌ Cannot cancel an auction that already has bids.');
    return;
  }

  // Mark cancelled and restore escrowed asset
  await client.prisma.marketListing.update({ where: { id: listing.id }, data: { status: 'cancelled' } });

  const data = listing.itemData as Record<string, unknown>;

  if (listing.type === 'item' || listing.type === 'pack') {
    const itemId = data.itemId as string | undefined;
    const itemName = data.name as string;
    if (itemId) {
      await client.prisma.userInventory.upsert({
        where: { userId_itemId: { userId: listing.sellerId, itemId } },
        update: { quantity: { increment: 1 } },
        create: { userId: listing.sellerId, itemId, itemName, quantity: 1 },
      });
    }
  }
  // Pokemon: ownership was never transferred (still in UserPokemon), nothing to restore

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x888888)
      .setTitle('🔨 Auction Cancelled')
      .setDescription(`Auction **${shortId}** for **${(data.name as string) ?? 'item'}** has been cancelled.${
        (listing.type === 'item' || listing.type === 'pack') ? '\nYour item has been returned to your inventory.' : ''
      }`)
      .setTimestamp()],
  });
}

export default command;
