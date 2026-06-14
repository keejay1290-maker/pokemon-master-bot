import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';
import { transferBalance } from '../../services/userService.js';

const PAGE_SIZE = 8;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Browse, list, and buy Pokémon and cards on the marketplace')
    .addSubcommand((sub) =>
      sub.setName('browse')
        .setDescription('Browse active market listings')
        .addStringOption((o) =>
          o.setName('type').setDescription('Filter by type').addChoices(
            { name: 'All', value: 'all' },
            { name: 'Pokémon', value: 'pokemon' },
            { name: 'Cards', value: 'card' },
            { name: 'Items', value: 'item' },
          )
        )
        .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('list')
        .setDescription('List an item for sale on the marketplace')
        .addStringOption((o) =>
          o.setName('type').setDescription('What are you selling?').setRequired(true).addChoices(
            { name: 'Pokémon', value: 'pokemon' },
            { name: 'Card', value: 'card' },
            { name: 'Item', value: 'item' },
          )
        )
        .addStringOption((o) => o.setName('name').setDescription('Name of item/pokemon/card').setRequired(true))
        .addIntegerOption((o) => o.setName('price').setDescription('Price in PokéCoins').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy a listing instantly')
        .addStringOption((o) => o.setName('listing_id').setDescription('Listing ID from /market browse').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('cancel')
        .setDescription('Cancel your own listing')
        .addStringOption((o) => o.setName('listing_id').setDescription('Your listing ID to cancel').setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'browse') {
      await handleBrowse(interaction, client);
    } else if (sub === 'list') {
      await handleList(interaction, client);
    } else if (sub === 'buy') {
      await handleBuy(interaction, client);
    } else if (sub === 'cancel') {
      await handleCancel(interaction, client);
    }
  },
};

async function handleBrowse(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const typeFilter = interaction.options.getString('type') ?? 'all';
  const page = (interaction.options.getInteger('page') ?? 1) - 1;

  const where = {
    status: 'active',
    isAuction: false,
    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
  };

  const [listings, total] = await Promise.all([
    client.prisma.marketListing.findMany({
      where,
      include: { seller: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    client.prisma.marketListing.count({ where }),
  ]);

  if (listings.length === 0) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xffcb05).setTitle('🏪 Marketplace').setDescription('No active listings found. Be the first to list something with `/market list`!')],
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xffcb05)
    .setTitle(`🏪 Marketplace${typeFilter !== 'all' ? ` — ${typeFilter}` : ''}`)
    .setDescription(listings.map((l) => {
      const data = l.itemData as Record<string, unknown>;
      const name = (data.name as string) ?? 'Unknown';
      const shortId = l.id.slice(-6).toUpperCase();
      return `**[${shortId}]** ${l.type === 'pokemon' ? '🎾' : l.type === 'card' ? '🃏' : '📦'} **${name}** — ${formatNumber(l.price)} PokéCoins | by ${l.seller.username}`;
    }).join('\n'))
    .setFooter({ text: `Page ${page + 1} of ${Math.ceil(total / PAGE_SIZE)} | ${total} listings | Use /market buy <ID> to purchase` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction: ChatInputCommandInteraction, client: BotClient) {
  const type = interaction.options.getString('type', true);
  const name = interaction.options.getString('name', true);
  const price = interaction.options.getInteger('price', true);

  if (!interaction.guild) { await interaction.reply({ content: 'Must be used in a server.', ephemeral: true }); return; }

  const existing = await client.prisma.marketListing.count({
    where: { sellerId: interaction.user.id, status: 'active' },
  });
  if (existing >= 10) {
    await interaction.reply({ content: 'You already have 10 active listings. Cancel one first.', ephemeral: true });
    return;
  }

  const listing = await client.prisma.marketListing.create({
    data: {
      sellerId: interaction.user.id,
      guildId: interaction.guild.id,
      type,
      itemData: { name },
      price,
      status: 'active',
    },
  });

  const shortId = listing.id.slice(-6).toUpperCase();

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Listing Created')
      .setDescription(`Your **${name}** (${type}) is listed for **${formatNumber(price)} PokéCoins**.\nListing ID: \`${shortId}\``)
      .setTimestamp()],
  });
}

async function handleBuy(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const shortId = interaction.options.getString('listing_id', true).toUpperCase();

  const listing = await client.prisma.marketListing.findFirst({
    where: { id: { endsWith: shortId.toLowerCase() }, status: 'active', isAuction: false },
    include: { seller: { select: { username: true } } },
  });

  if (!listing) {
    await interaction.editReply({ content: 'Listing not found or already sold.' });
    return;
  }
  if (listing.sellerId === interaction.user.id) {
    await interaction.editReply({ content: "You can't buy your own listing." });
    return;
  }

  const buyer = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
  if (!buyer || buyer.balance < listing.price) {
    await interaction.editReply({ content: `Not enough PokéCoins. Need **${formatNumber(listing.price)}**, have **${formatNumber(buyer?.balance ?? 0)}**.` });
    return;
  }

  try {
    await transferBalance(client.prisma, interaction.user.id, listing.sellerId, listing.price);

    await client.prisma.marketListing.update({ where: { id: listing.id }, data: { status: 'sold' } });
    await client.prisma.marketPurchase.create({
      data: { listingId: listing.id, buyerId: interaction.user.id, price: listing.price },
    });

    const data = listing.itemData as Record<string, unknown>;
    const name = (data.name as string) ?? 'Item';

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Purchase Complete!')
        .setDescription(`You bought **${name}** from **${listing.seller.username}** for **${formatNumber(listing.price)} PokéCoins**!`)
        .setTimestamp()],
    });
  } catch {
    await interaction.editReply({ content: 'Transaction failed. Please try again.' });
  }
}

async function handleCancel(interaction: ChatInputCommandInteraction, client: BotClient) {
  const shortId = interaction.options.getString('listing_id', true).toUpperCase();

  const listing = await client.prisma.marketListing.findFirst({
    where: { id: { endsWith: shortId.toLowerCase() }, sellerId: interaction.user.id, status: 'active' },
  });

  if (!listing) {
    await interaction.reply({ content: 'Listing not found or not yours.', ephemeral: true });
    return;
  }

  await client.prisma.marketListing.update({ where: { id: listing.id }, data: { status: 'cancelled' } });
  const data = listing.itemData as Record<string, unknown>;

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('🗑️ Listing Cancelled')
      .setDescription(`Your listing for **${(data.name as string) ?? 'item'}** has been removed.`)
      .setTimestamp()],
  });
}

export default command;
