import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const RARITY_ORDER = ['Hyper Rare', 'Special Illustration Rare', 'Illustration Rare', 'Amazing Rare', 'Rare Ultra', 'Rare Holo', 'Rare', 'Uncommon', 'Common'];

export async function buildCardCollectionView(
  client: BotClient,
  userId: string,
  username: string,
  avatarUrl: string,
  includePackButton = false,
) {
  const [recentCards, uniqueCards, allCards] = await Promise.all([
    client.prisma.userCard.findMany({
      where: { userId },
      include: { card: true },
      orderBy: { obtainedAt: 'desc' },
      take: 15,
    }),
    client.prisma.userCard.count({ where: { userId } }),
    client.prisma.userCard.findMany({
      where: { userId },
      include: { card: { select: { rarity: true, marketValue: true } } },
    }),
  ]);
  const totalCopies = allCards.reduce((sum, card) => sum + card.quantity, 0);
  const collectionValue = allCards.reduce(
    (sum, card) => sum + card.quantity * (card.card.marketValue ?? 0),
    0,
  );
  const rarityBreakdown: Record<string, number> = {};
  for (const userCard of allCards) {
    rarityBreakdown[userCard.card.rarity] =
      (rarityBreakdown[userCard.card.rarity] ?? 0) + userCard.quantity;
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🃏 ${username}'s Card Collection`)
    .setThumbnail(avatarUrl);
  if (recentCards.length === 0) {
    embed.setDescription('No cards yet! Open a pack to begin your collection.');
  } else {
    embed.setDescription(recentCards.map((userCard) => {
      const value = userCard.card.marketValue != null
        ? ` — ${userCard.card.marketValue.toLocaleString()} coins`
        : '';
      return `**${userCard.card.name}** — ${userCard.card.rarity} (x${userCard.quantity})${value}`;
    }).join('\n'));
    const featured = recentCards[0].card.imageLarge ?? recentCards[0].card.imageSmall;
    if (featured) embed.setImage(featured);
  }
  embed.addFields(
    { name: '🗂️ Unique Cards', value: uniqueCards.toLocaleString(), inline: true },
    { name: '📦 Total Copies', value: totalCopies.toLocaleString(), inline: true },
    { name: '💰 Collection Value', value: `${collectionValue.toLocaleString()} PokéCoins`, inline: true },
  );
  const breakdown = RARITY_ORDER
    .filter((rarity) => rarityBreakdown[rarity])
    .map((rarity) => `${rarity}: ${rarityBreakdown[rarity]}`)
    .join(' | ');
  if (breakdown) embed.addFields({ name: '📊 Rarity Breakdown', value: breakdown });
  embed.setFooter({ text: 'Most recently obtained cards are shown first.' });

  const components = includePackButton
    ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`pack_open_another:${userId}`)
        .setLabel('Open Another Pack')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Success),
    )]
    : [];
  return { embeds: [embed], components };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('View your Pokémon card collection and estimated market value')
    .addUserOption((o) => o.setName('user').setDescription("View another trainer's collection")),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') ?? interaction.user;

    const view = await buildCardCollectionView(
      client,
      target.id,
      target.username,
      target.displayAvatarURL(),
      target.id === interaction.user.id,
    );
    await interaction.editReply(view);
  },
};
export default command;
