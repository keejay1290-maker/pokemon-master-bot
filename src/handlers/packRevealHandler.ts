import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { BotClient } from '../types/index.js';
import { formatNumber } from '../utils/embeds.js';

export interface PackSession {
  userId: string;
  setName: string;
  setId: string;
  setLogoUrl?: string;
  cards: ResolvedCard[];
  currentIndex: number;
  newCardIds: string[];
  dupCardIds: string[];
  revealedCardIds: string[];
}

export interface ResolvedCard {
  id: string;
  name: string;
  rarity: string;
  imageSmall?: string | null;
  imageLarge?: string | null;
  number: string;
  isNew: boolean;
}

const RARITY_EMOJI: Record<string, string> = {
  Common: '⚪',
  Uncommon: '🟢',
  Rare: '🔵',
  'Rare Holo': '🔷',
  'Rare Ultra': '🟣',
  'Illustration Rare': '🌟',
  'Special Illustration Rare': '💎',
  'Hyper Rare': '🌈',
  'Amazing Rare': '⭐',
};

const RARITY_RANK: Record<string, number> = {
  'Hyper Rare': 9, 'Special Illustration Rare': 8, 'Amazing Rare': 7,
  'Illustration Rare': 6, 'Rare Ultra': 5, 'Rare Holo': 4,
  Rare: 3, Uncommon: 2, Common: 1,
};

function progressBar(current: number, total: number, width = 10): string {
  const filled = Math.round((current / total) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function buildRevealEmbed(session: PackSession, card: ResolvedCard, cardNum: number): EmbedBuilder {
  const total = session.cards.length;
  const revealed = cardNum;
  const remaining = total - revealed;
  const emoji = RARITY_EMOJI[card.rarity] ?? '⚪';
  const badge = card.isNew ? '✨ **NEW**' : '♻️ **DUPLICATE**';

  const embed = new EmbedBuilder()
    .setColor(card.isNew ? 0xffd700 : 0x888888)
    .setTitle(`Card ${cardNum} of ${total}`)
    .setDescription(`${badge}  |  ${emoji} ${card.rarity}\n**${card.name}** — #${card.number}`)
    .addFields(
      { name: 'Set', value: session.setName, inline: true },
      { name: 'Cards Remaining', value: `${remaining}`, inline: true },
      { name: 'Progress', value: progressBar(revealed, total), inline: false },
    )
    .setTimestamp();

  if (card.imageLarge) embed.setImage(card.imageLarge);
  else if (card.imageSmall) embed.setThumbnail(card.imageSmall);

  return embed;
}

function buildOpeningEmbed(session: PackSession): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`📦 ${session.setName} Pack`)
    .setDescription('Your pack is ready!\nPress **Reveal Next Card** to begin opening.')
    .addFields(
      { name: 'Cards', value: `${session.cards.length}`, inline: true },
      { name: 'Progress', value: progressBar(0, session.cards.length), inline: false },
    )
    .setTimestamp();

  if (session.setLogoUrl) embed.setThumbnail(session.setLogoUrl);
  return embed;
}

function buildSummaryEmbed(session: PackSession): EmbedBuilder {
  const bestCard = [...session.cards].sort(
    (a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0)
  )[0];

  const emoji = bestCard ? (RARITY_EMOJI[bestCard.rarity] ?? '⚪') : '⚪';

  return new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle(`📦 Pack Complete — ${session.setName}`)
    .addFields(
      { name: '🃏 Cards Opened', value: `${session.cards.length}`, inline: true },
      { name: '✨ New Cards', value: `${session.newCardIds.length}`, inline: true },
      { name: '♻️ Duplicates', value: `${session.dupCardIds.length}`, inline: true },
      { name: '⭐ Best Pull', value: bestCard ? `${emoji} ${bestCard.name} (${bestCard.rarity})` : 'None', inline: false },
    )
    .setTimestamp();
}

function revealButton(sessionId: string, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pack_reveal:${sessionId}`)
      .setLabel('🃏 Reveal Next Card')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );
}

function summaryButtons(userId: string, hasMorePacks: boolean) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`pack_open_another:${userId}`)
      .setLabel('📦 Open Another Pack')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasMorePacks),
    new ButtonBuilder()
      .setCustomId(`pack_view_collection:${userId}`)
      .setLabel('📖 View Collection')
      .setStyle(ButtonStyle.Secondary)
  );
  return row;
}

// Called from interactionCreate for pack_reveal:* buttons
export async function handlePackReveal(interaction: ButtonInteraction, client: BotClient, sessionId: string) {
  if (!client.redis.isReady) {
    await interaction.reply({ content: '❌ Pack reveal is temporarily unavailable (cache service offline). Please try again in a moment.', ephemeral: true });
    return;
  }

  const lockKey = `pack:lock:${sessionId}`;
  const sessionKey = `pack:session:${sessionId}`;

  // Atomic lock — prevents double-click race conditions
  const locked = await client.redis.set(lockKey, '1', { NX: true, EX: 5 });
  if (!locked) {
    await interaction.reply({ content: '⏳ Already revealing, please wait...', ephemeral: true });
    return;
  }

  try {
    const raw = await client.redis.get(sessionKey);
    if (!raw) {
      await interaction.update({ content: '❌ Session expired. Use `/pack open` to start again.', embeds: [], components: [] });
      return;
    }

    const session: PackSession = JSON.parse(raw);

    // Ownership check
    if (interaction.user.id !== session.userId) {
      await interaction.reply({ content: '❌ This is not your pack.', ephemeral: true });
      return;
    }

    const card = session.cards[session.currentIndex];
    if (!card) {
      await interaction.update({ content: '❌ Session corrupted.', embeds: [], components: [] });
      return;
    }

    const cardNum = session.currentIndex + 1;

    // Write this card to the user's collection NOW (one card per reveal)
    await client.prisma.card.upsert({
      where: { id: card.id },
      update: {},
      create: {
        id: card.id,
        name: card.name,
        supertype: 'Pokémon',
        subtypes: [],
        types: [],
        setId: session.setId,
        setName: session.setName,
        number: card.number,
        rarity: card.rarity,
        imageSmall: card.imageSmall ?? null,
        imageLarge: card.imageLarge ?? null,
      },
    });

    await client.prisma.userCard.upsert({
      where: { userId_cardId_isFoil: { userId: session.userId, cardId: card.id, isFoil: false } },
      update: { quantity: { increment: 1 } },
      create: { userId: session.userId, cardId: card.id, quantity: 1, isFoil: false },
    });

    await client.prisma.user.update({
      where: { id: session.userId },
      data: { cardsCollected: { increment: 1 } },
    });

    // Advance session state
    session.revealedCardIds.push(card.id);
    session.currentIndex += 1;

    const isLastCard = session.currentIndex >= session.cards.length;

    if (isLastCard) {
      // Delete session — pack is done
      await client.redis.del(sessionKey);

      // Check if user has more packs
      const hasMore = await client.prisma.userInventory.findFirst({
        where: { userId: session.userId, itemId: { startsWith: 'pack:' }, quantity: { gt: 0 } },
      });

      await interaction.update({
        embeds: [buildSummaryEmbed(session)],
        components: [summaryButtons(session.userId, !!hasMore)],
      });
    } else {
      // Update session in Redis
      await client.redis.set(sessionKey, JSON.stringify(session), { EX: 600 });

      const embed = buildRevealEmbed(session, card, cardNum);
      await interaction.update({
        embeds: [embed],
        components: [revealButton(sessionId)],
      });
    }
  } finally {
    await client.redis.del(lockKey);
  }
}

// Called from interactionCreate for pack_open_another:* buttons
export async function handlePackOpenAnother(interaction: ButtonInteraction, client: BotClient) {
  if (interaction.user.id !== interaction.customId.split(':')[1]) {
    await interaction.reply({ content: '❌ Not your session.', ephemeral: true });
    return;
  }
  // Redirect user to /pack open — we can't invoke slash commands, so just inform
  await interaction.reply({
    content: '📦 Use `/pack open` to pick your next pack!',
    ephemeral: true,
  });
}

// Called from interactionCreate for pack_view_collection:* buttons
export async function handlePackViewCollection(interaction: ButtonInteraction, client: BotClient) {
  if (interaction.user.id !== interaction.customId.split(':')[1]) {
    await interaction.reply({ content: '❌ Not your session.', ephemeral: true });
    return;
  }
  await interaction.reply({
    content: '📖 Use `/collection` to view your card collection!',
    ephemeral: true,
  });
}

// Creates a new pack session in Redis and returns the opening embed + button
export async function createPackSession(
  client: BotClient,
  userId: string,
  setId: string,
  setName: string,
  setLogoUrl: string | undefined,
  cards: ResolvedCard[]
): Promise<{ sessionId: string; embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> }> {
  if (!client.redis.isReady) {
    throw new Error('REDIS_UNAVAILABLE');
  }

  const sessionId = `${userId}-${Date.now()}`;

  const session: PackSession = {
    userId,
    setName,
    setId,
    setLogoUrl,
    cards,
    currentIndex: 0,
    newCardIds: cards.filter((c) => c.isNew).map((c) => c.id),
    dupCardIds: cards.filter((c) => !c.isNew).map((c) => c.id),
    revealedCardIds: [],
  };

  await client.redis.set(`pack:session:${sessionId}`, JSON.stringify(session), { EX: 600 });

  return {
    sessionId,
    embed: buildOpeningEmbed(session),
    row: revealButton(sessionId),
  };
}
