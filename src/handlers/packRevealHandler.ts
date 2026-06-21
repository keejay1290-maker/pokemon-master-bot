import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { BotClient } from '../types/index.js';
import { formatNumber } from '../utils/embeds.js';
import { calculateMarketValue } from '../services/cardValueService.js';
import type { Prisma } from '@prisma/client';

// Generic card-back image used when a TCG API card has no artwork (Base Set era, promos, some SV trainers)
const CARD_BACK_PLACEHOLDER_URL = 'https://images.pokemontcg.io/cardback.png';

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
  awardedUpfront?: boolean;
}

export interface ResolvedCard {
  id: string;
  name: string;
  rarity: string;
  imageSmall?: string | null;
  imageLarge?: string | null;
  number: string;
  isNew: boolean;
  // P6 V3 fields:
  hp?: string | null;
  types?: string[];
  subtypes?: string[];
  attacks?: Array<{ name: string; damage: string; cost: string[] }>;
  weaknesses?: Array<{ type: string; value: string }>;
  retreatCost?: number | null;
  marketValue?: number;
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

  // Build type display
  const typeIcons: Record<string, string> = {
    'Colorless': '⬜', 'Darkness': '⬛', 'Dragon': '🐉',
    'Fairy': '🌸', 'Fighting': '💪', 'Fire': '🔥',
    'Grass': '🌿', 'Lightning': '⚡', 'Metal': '⚙️',
    'Psychic': '🔮', 'Water': '💧',
  };
  const typesDisplay = card.types?.map((t) => typeIcons[t] ?? t).join(' ') ?? '';
  const hpDisplay = card.hp ? `HP: ${card.hp}` : '';

  // Build attacks display
  const attacksDisplay = card.attacks?.slice(0, 2).map((a) =>
    `${a.cost.map((c) => typeIcons[c] ?? c).join('')} **${a.name}** — ${a.damage || '?'}`
  ).join('\n') ?? '';

  // Build weakness/retreat
  const weaknessDisplay = card.weaknesses?.map((w) => `${typeIcons[w.type] ?? w.type} ×${w.value}`).join(', ') ?? '';
  const retreatDisplay = card.retreatCost != null ? `${'⬛'.repeat(card.retreatCost)}` : '';
  const valueDisplay = card.marketValue != null ? `💰 **${formatNumber(card.marketValue)}**` : '';

  const embed = new EmbedBuilder()
    .setColor(card.isNew ? 0xffd700 : 0x888888)
    .setTitle(`Card ${cardNum} of ${total}`)
    .setDescription(
      `${badge}  |  ${emoji} ${card.rarity}\n` +
      `**${card.name}** — #${card.number}\n` +
      `${hpDisplay}${hpDisplay && typesDisplay ? ' | ' : ''}${typesDisplay}`
    )
    .addFields(
      { name: 'Set', value: session.setName, inline: true },
      { name: 'Progress', value: progressBar(revealed, total), inline: false },
    );

  if (attacksDisplay) embed.addFields({ name: '⚔️ Attacks', value: attacksDisplay, inline: false });
  if (weaknessDisplay || retreatDisplay) {
    const w = weaknessDisplay ? `Weakness: ${weaknessDisplay}` : '';
    const r = retreatDisplay ? `Retreat: ${retreatDisplay}` : '';
    embed.addFields({ name: '⚖️ Weakness / Retreat', value: [w, r].filter(Boolean).join(' | '), inline: false });
  }
  if (valueDisplay) embed.addFields({ name: '💰 Est. Value', value: valueDisplay, inline: true });
  embed.addFields({ name: 'Cards Remaining', value: `${remaining}`, inline: true });

  embed.setImage(resolveCardImage(card, session.setId));

  embed.setTimestamp();
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

  // Find best value card
  const bestValue = [...session.cards].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0))[0];

  // Calculate total value
  const totalValue = session.cards.reduce((sum, c) => sum + (c.marketValue ?? 0), 0);

  const emoji = bestCard ? (RARITY_EMOJI[bestCard.rarity] ?? '⚪') : '⚪';
  const valueEmoji = bestValue ? (RARITY_EMOJI[bestValue.rarity] ?? '⚪') : '⚪';

  const embed = new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle(`📦 Pack Complete — ${session.setName}`)
    .addFields(
      { name: '🃏 Cards Opened', value: `${session.cards.length}`, inline: true },
      { name: '✨ New Cards', value: `${session.newCardIds.length}`, inline: true },
      { name: '♻️ Duplicates', value: `${session.dupCardIds.length}`, inline: true },
      { name: '⭐ Best Pull', value: bestCard ? `${emoji} ${bestCard.name} (${bestCard.rarity})` : 'None', inline: false },
      { name: '💰 Total Value', value: totalValue > 0 ? `**${formatNumber(totalValue)} PokéCoins**` : 'N/A', inline: true },
      { name: '🏆 Best Value', value: bestValue && bestValue.marketValue ? `${valueEmoji} ${bestValue.name} — **${formatNumber(bestValue.marketValue)}**` : 'N/A', inline: true },
    )
    .setTimestamp();

  return embed;
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

function finishButton(sessionId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pack_finish:${sessionId}`)
      .setLabel('✨ View Pack Results')
      .setStyle(ButtonStyle.Success)
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

const PACK_SESSION_TTL_SECONDS = 900;

export function resolveCardImage(card: ResolvedCard, setId: string): string {
  const candidates = [card.imageLarge, card.imageSmall];
  for (const candidate of candidates) {
    if (candidate && /^https?:\/\//i.test(candidate)) {
      return candidate.replace(/^http:\/\//i, 'https://');
    }
  }
  const number = encodeURIComponent(card.number);
  return number && number !== '0'
    ? `https://images.pokemontcg.io/${encodeURIComponent(setId)}/${number}_hires.png`
    : CARD_BACK_PLACEHOLDER_URL;
}

function packSessionRedisKey(sessionId: string): string {
  return `pack:session:${sessionId}`;
}

function serializePackSession(session: PackSession): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(session)) as Prisma.InputJsonValue;
}

function parsePackSession(raw: unknown): PackSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const session = raw as Partial<PackSession>;
  if (
    typeof session.userId !== 'string' ||
    typeof session.setName !== 'string' ||
    typeof session.setId !== 'string' ||
    !Array.isArray(session.cards) ||
    typeof session.currentIndex !== 'number'
  ) {
    return null;
  }

  return {
    userId: session.userId,
    setName: session.setName,
    setId: session.setId,
    setLogoUrl: session.setLogoUrl,
    cards: session.cards as ResolvedCard[],
    currentIndex: session.currentIndex,
    newCardIds: Array.isArray(session.newCardIds) ? session.newCardIds : [],
    dupCardIds: Array.isArray(session.dupCardIds) ? session.dupCardIds : [],
    revealedCardIds: Array.isArray(session.revealedCardIds) ? session.revealedCardIds : [],
    awardedUpfront: session.awardedUpfront === true,
  };
}

async function cachePackSession(client: BotClient, sessionId: string, session: PackSession): Promise<void> {
  if (!client.redis?.isReady) return;
  await client.redis.set(packSessionRedisKey(sessionId), JSON.stringify(session), { EX: PACK_SESSION_TTL_SECONDS }).catch(() => {});
}

async function deletePackSession(client: BotClient, sessionId: string): Promise<void> {
  await client.prisma.packSession.delete({ where: { sessionId } }).catch(() => {});
  if (client.redis?.isReady) await client.redis.del(packSessionRedisKey(sessionId)).catch(() => {});
}

async function getPackSession(client: BotClient, sessionId: string): Promise<PackSession | null> {
  const dbSession = await client.prisma.packSession.findUnique({ where: { sessionId } });
  if (!dbSession) return null;
  if (dbSession.expiresAt.getTime() <= Date.now()) {
    await deletePackSession(client, sessionId);
    return null;
  }

  const session = parsePackSession(dbSession.cards);
  if (!session) return null;

  if (session.currentIndex !== dbSession.currentIndex) {
    session.currentIndex = dbSession.currentIndex;
  }

  await cachePackSession(client, sessionId, session);
  return session;
}

// Called from interactionCreate for pack_reveal:* buttons
export async function handlePackReveal(interaction: ButtonInteraction, client: BotClient, sessionId: string) {
  // Acknowledge the click before any database/cache work. PostgreSQL's guarded
  // currentIndex update below is the canonical reveal lock, so Redis must never
  // be able to strand a valid pack behind a stale "already revealing" key.
  await interaction.deferUpdate();

  try {
    const session = await getPackSession(client, sessionId);
    if (!session) {
      await interaction.editReply({ content: '❌ Session expired. Use `/pack open` to start again.', embeds: [], components: [] }).catch(() => {});
      return;
    }

    // Ownership check
    if (interaction.user.id !== session.userId) {
      await interaction.followUp({ content: '❌ This is not your pack.', ephemeral: true }).catch(() => {});
      return;
    }

    const card = session.cards[session.currentIndex];
    if (!card) {
      await interaction.editReply({ content: '❌ Session corrupted.', embeds: [], components: [] }).catch(() => {});
      return;
    }

    const cardNum = session.currentIndex + 1;

    // Calculate market value for this card
    const marketValue = card.marketValue ?? calculateMarketValue(card.rarity, session.setId, card.name);

    // Process reveal with internal error handling — if something fails (Discord context limit, Redis issue),
    // persist remaining cards and close the session to avoid leaving users stuck.
    try {
      // Advance session state
      session.revealedCardIds.push(card.id);
      session.currentIndex += 1;

      const isLastCard = session.currentIndex >= session.cards.length;

      // Write this card and advance the session in one transaction. The
      // updateMany guard prevents duplicate card grants on double-clicks.
      await client.prisma.$transaction(async (tx) => {
        const advanced = await tx.packSession.updateMany({
          where: { sessionId, currentIndex: cardNum - 1 },
          data: {
            currentIndex: session.currentIndex,
            cards: serializePackSession(session),
          },
        });
        if (advanced.count !== 1) throw new Error('PACK_ALREADY_ADVANCED');

        // Legacy sessions created before upfront awarding still grant on reveal.
        if (!session.awardedUpfront) {
          await tx.card.upsert({
            where: { id: card.id },
            update: {
              imageSmall: card.imageSmall ?? undefined,
              imageLarge: card.imageLarge ?? undefined,
              marketValue,
            },
            create: {
              id: card.id,
              name: card.name,
              supertype: 'Pokémon',
              subtypes: card.subtypes ?? [],
              types: card.types ?? [],
              setId: session.setId,
              setName: session.setName,
              number: card.number,
              rarity: card.rarity,
              imageSmall: card.imageSmall ?? null,
              imageLarge: card.imageLarge ?? null,
              marketValue,
            },
          });
          await tx.userCard.upsert({
            where: { userId_cardId_isFoil: { userId: session.userId, cardId: card.id, isFoil: false } },
            update: { quantity: { increment: 1 } },
            create: { userId: session.userId, cardId: card.id, quantity: 1, isFoil: false },
          });
          await tx.user.update({
            where: { id: session.userId },
            data: { cardsCollected: { increment: 1 } },
          });
        }
      });

      if (isLastCard) {
        // Keep the final card visible. The player explicitly advances to the
        // summary, avoiding the appearance that the rare pull "vanished".
        await cachePackSession(client, sessionId, session);
        await interaction.editReply({
          embeds: [buildRevealEmbed(session, card, cardNum)],
          components: [finishButton(sessionId)],
        }).catch(() => {});
      } else {
        // Update cache after the canonical DB transaction succeeds.
        await cachePackSession(client, sessionId, session);

        const embed = buildRevealEmbed(session, card, cardNum);
        await interaction.editReply({
          embeds: [embed],
          components: [revealButton(sessionId)],
        }).catch(() => { throw new Error('UPDATE_FAILED'); });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'PACK_ALREADY_ADVANCED') {
        await interaction.followUp({ content: '⏳ This card was already revealed. Please use the latest pack message.', ephemeral: true }).catch(() => {});
        return;
      }

      client.logger.error('Pack reveal processing error — falling back to close session', err);

      // Persist remaining cards (those not yet revealed) to the user's collection to avoid data loss
      const remaining = session.cards.slice(session.currentIndex);
      try {
        if (!session.awardedUpfront) await client.prisma.$transaction(async (tx) => {
          for (const c of remaining) {
            await tx.card.upsert({
              where: { id: c.id },
              update: { marketValue: c.marketValue ?? undefined },
              create: {
                id: c.id,
                name: c.name,
                supertype: 'Pokémon',
                subtypes: [],
                types: c.types ?? [],
                setId: session.setId,
                setName: session.setName,
                number: c.number,
                rarity: c.rarity,
                imageSmall: c.imageSmall ?? null,
                imageLarge: c.imageLarge ?? null,
                marketValue: c.marketValue ?? null,
              },
            });

            await tx.userCard.upsert({
              where: { userId_cardId_isFoil: { userId: session.userId, cardId: c.id, isFoil: false } },
              update: { quantity: { increment: 1 } },
              create: { userId: session.userId, cardId: c.id, quantity: 1, isFoil: false },
            });
          }

          // Increment collected count
          await tx.user.update({ where: { id: session.userId }, data: { cardsCollected: { increment: remaining.length } } });
        });
      } catch (persistErr) {
        client.logger.error('Failed to persist remaining pack cards during fallback', persistErr);
        // As a last resort, refund the pack to user's inventory
        await client.prisma.userInventory.upsert({
          where: { userId_itemId: { userId: session.userId, itemId: `pack:${session.setId}` } },
          update: { quantity: { increment: 1 } },
          create: { userId: session.userId, itemId: `pack:${session.setId}`, itemName: `${session.setName} Pack`, quantity: 1 },
        }).catch(() => {});
      }

      // Close the session
      await deletePackSession(client, sessionId);

      // Notify user
      try {
        const ownershipMessage = session.awardedUpfront
          ? 'All cards from this pack are already safe in your collection.'
          : `Remaining ${remaining.length} card(s) were added to your collection.`;
        await interaction.followUp({ content: `⚠️ Pack session closed due to an error. ${ownershipMessage}`, ephemeral: true }).catch(() => {});
      } catch { /* ignore */ }
    }
  } catch (err) {
    client.logger.error('Pack reveal outer error', err);
    await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
  }
}

export async function handlePackFinish(interaction: ButtonInteraction, client: BotClient, sessionId: string) {
  await interaction.deferUpdate();
  const session = await getPackSession(client, sessionId);
  if (!session || session.currentIndex < session.cards.length) {
    await interaction.editReply({
      content: '❌ This pack is no longer ready for results.',
      embeds: [],
      components: [],
    }).catch(() => {});
    return;
  }
  if (interaction.user.id !== session.userId) {
    await interaction.followUp({ content: '❌ This is not your pack.', ephemeral: true }).catch(() => {});
    return;
  }

  const hasMore = await client.prisma.userInventory.findFirst({
    where: { userId: session.userId, itemId: { startsWith: 'pack:' }, quantity: { gt: 0 } },
  });
  await deletePackSession(client, sessionId);
  await interaction.editReply({
    embeds: [buildSummaryEmbed(session)],
    components: [summaryButtons(session.userId, !!hasMore)],
  });
}

// Called from interactionCreate for pack_open_another:* buttons
export async function handlePackOpenAnother(interaction: ButtonInteraction, client: BotClient) {
  if (interaction.user.id !== interaction.customId.split(':')[1]) {
    await interaction.reply({ content: '❌ Not your session.', ephemeral: true });
    return;
  }
  const { buildPackSelectionView } = await import('../commands/cards/pack.js');
  await interaction.deferUpdate();
  const view = await buildPackSelectionView(client, interaction.user.id, true);
  await interaction.editReply(view);
}

// Called from interactionCreate for pack_view_collection:* buttons
export async function handlePackViewCollection(interaction: ButtonInteraction, client: BotClient) {
  if (interaction.user.id !== interaction.customId.split(':')[1]) {
    await interaction.reply({ content: '❌ Not your session.', ephemeral: true });
    return;
  }
  const { buildCardCollectionView } = await import('../commands/cards/collection.js');
  await interaction.deferUpdate();
  const view = await buildCardCollectionView(
    client,
    interaction.user.id,
    interaction.user.username,
    interaction.user.displayAvatarURL(),
    true,
  );
  await interaction.editReply(view);
}

// Creates a new pack session in Postgres, caches it in Redis when available,
// and returns the opening embed + button.
export async function createPackSession(
  client: BotClient,
  userId: string,
  guildId: string | undefined,
  setId: string,
  setName: string,
  setLogoUrl: string | undefined,
  cards: ResolvedCard[]
): Promise<{ sessionId: string; embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> }> {
  const sessionId = `${userId}-${Date.now()}`;

  const preparedCards = cards.map((card) => ({
    ...card,
    imageLarge: resolveCardImage(card, setId),
    marketValue: card.marketValue ?? calculateMarketValue(card.rarity, setId, card.name),
  }));
  const session: PackSession = {
    userId,
    setName,
    setId,
    setLogoUrl,
    cards: preparedCards,
    currentIndex: 0,
    newCardIds: preparedCards.filter((c) => c.isNew).map((c) => c.id),
    dupCardIds: preparedCards.filter((c) => !c.isNew).map((c) => c.id),
    revealedCardIds: [],
    awardedUpfront: true,
  };

  // Respect server pack cooldown when creating a session (prevent spam opening)
  try {
    const guild = guildId ? await client.prisma.guild.findUnique({ where: { id: guildId } }) : null;
    const cd = guild?.packCooldown ?? 60;
    if (client.redis?.isReady) {
      await client.redis.set(`cooldown:${userId}:pack`, (Date.now() + cd * 1000).toString(), { EX: cd }).catch(() => {});
    }
  } catch { /* non-fatal */ }

  await client.prisma.$transaction(async (tx) => {
    for (const card of preparedCards) {
      await tx.card.upsert({
        where: { id: card.id },
        update: {
          name: card.name,
          subtypes: card.subtypes ?? [],
          types: card.types ?? [],
          setId,
          setName,
          number: card.number,
          rarity: card.rarity,
          imageSmall: card.imageSmall ?? null,
          imageLarge: card.imageLarge ?? null,
          marketValue: card.marketValue,
        },
        create: {
          id: card.id,
          name: card.name,
          supertype: 'Pokémon',
          subtypes: card.subtypes ?? [],
          types: card.types ?? [],
          setId,
          setName,
          number: card.number,
          rarity: card.rarity,
          imageSmall: card.imageSmall ?? null,
          imageLarge: card.imageLarge ?? null,
          marketValue: card.marketValue,
        },
      });
      await tx.userCard.upsert({
        where: { userId_cardId_isFoil: { userId, cardId: card.id, isFoil: false } },
        update: { quantity: { increment: 1 }, obtainedAt: new Date() },
        create: { userId, cardId: card.id, quantity: 1, isFoil: false },
      });
    }
    await tx.user.update({
      where: { id: userId },
      data: { cardsCollected: { increment: preparedCards.length } },
    });
    await tx.packSession.create({
      data: {
        sessionId,
        userId,
        guildId,
        setId,
        setName,
        cards: serializePackSession(session),
        currentIndex: 0,
        expiresAt: new Date(Date.now() + PACK_SESSION_TTL_SECONDS * 1000),
      },
    });
  });
  // Clean up locks left by older deployments. Current reveals rely on the
  // PostgreSQL currentIndex compare-and-swap and do not create this key.
  if (client.redis?.isReady) await client.redis.del(`pack:lock:${sessionId}`).catch(() => {});
  await cachePackSession(client, sessionId, session);

  return {
    sessionId,
    embed: buildOpeningEmbed(session),
    row: revealButton(sessionId),
  };
}
