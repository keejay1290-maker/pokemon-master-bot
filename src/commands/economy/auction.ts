import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';
import { transferBalance } from '../../services/userService.js';

type Bid = { userId: string; username: string; amount: number; at: string };

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('auction')
    .setDescription('Place items up for timed auction or bid on existing auctions')
    .addSubcommand((sub) =>
      sub.setName('place')
        .setDescription('Start an auction for a Pokémon, card, or item')
        .addStringOption((o) =>
          o.setName('type').setDescription('What are you auctioning?').setRequired(true).addChoices(
            { name: 'Pokémon', value: 'pokemon' },
            { name: 'Card', value: 'card' },
            { name: 'Item', value: 'item' },
          )
        )
        .addStringOption((o) => o.setName('name').setDescription('Name of item/pokemon/card').setRequired(true))
        .addIntegerOption((o) => o.setName('start_bid').setDescription('Starting bid in PokéCoins').setRequired(true).setMinValue(1))
        .addIntegerOption((o) => o.setName('hours').setDescription('Auction duration in hours (1-72)').setRequired(true).setMinValue(1).setMaxValue(72))
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
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'place') await handlePlace(interaction, client);
    else if (sub === 'bid') await handleBid(interaction, client);
    else if (sub === 'view') await handleView(interaction, client);
    else if (sub === 'browse') await handleBrowse(interaction, client);
  },
};

async function handlePlace(interaction: ChatInputCommandInteraction, client: BotClient) {
  const type = interaction.options.getString('type', true);
  const name = interaction.options.getString('name', true);
  const startBid = interaction.options.getInteger('start_bid', true);
  const hours = interaction.options.getInteger('hours', true);
  const buyout = interaction.options.getInteger('buyout');

  if (!interaction.guild) { await interaction.reply({ content: 'Must be used in a server.', ephemeral: true }); return; }

  const auctionEndsAt = new Date(Date.now() + hours * 3600000);

  const listing = await client.prisma.marketListing.create({
    data: {
      sellerId: interaction.user.id,
      guildId: interaction.guild.id,
      type,
      itemData: { name },
      price: startBid,
      currentBid: startBid,
      buyoutPrice: buyout ?? null,
      isAuction: true,
      auctionEndsAt,
      bids: [],
      status: 'active',
    },
  });

  const shortId = listing.id.slice(-6).toUpperCase();

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🔨 Auction Created!')
      .setDescription(`**${name}** (${type}) is now up for auction!`)
      .addFields(
        { name: '🆔 Auction ID', value: shortId, inline: true },
        { name: '💰 Starting Bid', value: `${formatNumber(startBid)} PokéCoins`, inline: true },
        { name: '⏰ Ends In', value: `${hours}h`, inline: true },
        ...(buyout ? [{ name: '⚡ Buyout', value: `${formatNumber(buyout)} PokéCoins`, inline: true }] : []),
      )
      .setFooter({ text: 'Use /auction bid <ID> <amount> to place a bid' })
      .setTimestamp()],
  });
}

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
  bids.push({ userId: interaction.user.id, username: interaction.user.username, amount, at: new Date().toISOString() });

  // Instant buyout
  const isBuyout = listing.buyoutPrice !== null && amount >= (listing.buyoutPrice ?? Infinity);

  await client.prisma.marketListing.update({
    where: { id: listing.id },
    data: {
      currentBid: amount,
      bids,
      ...(isBuyout ? { status: 'sold' } : {}),
    },
  });

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
    ? listing.auctionEndsAt < new Date()
      ? 'Ended'
      : `~${Math.floor((listing.auctionEndsAt.getTime() - Date.now()) / 60000)}m`
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
      embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle('🔨 Auctions').setDescription('No active auctions. Start one with `/auction place`!')],
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
      return `**[${shortId}]** **${name}** — ${formatNumber(a.currentBid ?? a.price)} PokéCoins | ${bids} bids | ⏰ ${timeLeft} | ${a.seller.username}`;
    }).join('\n'))
    .setFooter({ text: 'Use /auction bid <ID> <amount> to bid | /auction view <ID> for details' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export default command;
