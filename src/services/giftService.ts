import type { PrismaClient } from '@prisma/client';

export type GiftSelection =
  | { kind: 'caught'; ownershipId: string }
  | { kind: 'card'; ownershipId: string };

export interface GiftResult {
  kind: GiftSelection['kind'];
  name: string;
  isShiny?: boolean;
  level?: number;
  rarity?: string;
  remainingQuantity?: number;
}

export function parseGiftSelection(value: string): GiftSelection | null {
  const separator = value.indexOf(':');
  if (separator < 1) return null;
  const kind = value.slice(0, separator);
  const ownershipId = value.slice(separator + 1);
  if (!ownershipId || (kind !== 'caught' && kind !== 'card')) return null;
  return { kind, ownershipId };
}

export async function transferPokemonGift(
  prisma: PrismaClient,
  guildId: string,
  senderId: string,
  recipientId: string,
  selection: GiftSelection,
): Promise<GiftResult> {
  if (senderId === recipientId) throw new Error('SELF_GIFT');

  return prisma.$transaction(async (tx) => {
    if (selection.kind === 'caught') {
      const owned = await tx.userPokemon.findFirst({
        where: { id: selection.ownershipId, userId: senderId },
        include: { pokemon: true },
      });
      if (!owned) throw new Error('GIFT_NOT_OWNED');
      if (owned.isInTeam) throw new Error('GIFT_IN_TEAM');
      if (owned.isFavorite) throw new Error('GIFT_FAVORITE');
      if (owned.isLocked) throw new Error('GIFT_LOCKED');

      const activeBattle = await tx.battle.findFirst({
        where: {
          status: 'active',
          startedAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
          OR: [{ challengerId: senderId }, { opponentId: senderId }],
        },
        select: { id: true },
      });
      if (activeBattle) throw new Error('GIFT_IN_BATTLE');

      const activeListing = await tx.marketListing.findFirst({
        where: {
          status: 'active',
          itemData: { path: ['userPokemonId'], equals: owned.id },
        },
        select: { id: true },
      });
      if (activeListing) throw new Error('GIFT_LISTED');

      const moved = await tx.userPokemon.updateMany({
        where: {
          id: owned.id,
          userId: senderId,
          isInTeam: false,
          isFavorite: false,
          isLocked: false,
        },
        data: { userId: recipientId },
      });
      if (moved.count !== 1) throw new Error('GIFT_NOT_OWNED');

      await tx.auditLog.create({
        data: {
          guildId,
          action: 'GIFT_POKEMON',
          targetId: recipientId,
          moderatorId: senderId,
          metadata: {
            userPokemonId: owned.id,
            pokemonId: owned.pokemonId,
            pokemonName: owned.pokemon.nameDisplay,
            level: owned.level,
            isShiny: owned.isShiny,
          },
        },
      });

      return {
        kind: 'caught',
        name: owned.nickname ?? owned.pokemon.nameDisplay,
        isShiny: owned.isShiny,
        level: owned.level,
        rarity: owned.pokemon.rarity,
      };
    }

    const owned = await tx.userCard.findFirst({
      where: { id: selection.ownershipId, userId: senderId, quantity: { gt: 0 } },
      include: { card: true },
    });
    if (!owned) throw new Error('GIFT_NOT_OWNED');

    const reduced = await tx.userCard.updateMany({
      where: { id: owned.id, userId: senderId, quantity: { gt: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    if (reduced.count === 0) {
      const removed = await tx.userCard.deleteMany({
        where: { id: owned.id, userId: senderId, quantity: 1 },
      });
      if (removed.count !== 1) throw new Error('GIFT_NOT_OWNED');
    }

    await tx.userCard.upsert({
      where: {
        userId_cardId_isFoil: {
          userId: recipientId,
          cardId: owned.cardId,
          isFoil: owned.isFoil,
        },
      },
      update: { quantity: { increment: 1 }, obtainedAt: new Date() },
      create: {
        userId: recipientId,
        cardId: owned.cardId,
        isFoil: owned.isFoil,
        quantity: 1,
      },
    });

    await tx.auditLog.create({
      data: {
        guildId,
        action: 'GIFT_CARD',
        targetId: recipientId,
        moderatorId: senderId,
        metadata: {
          userCardId: owned.id,
          cardId: owned.cardId,
          cardName: owned.card.name,
          rarity: owned.card.rarity,
          isFoil: owned.isFoil,
          quantity: 1,
        },
      },
    });

    return {
      kind: 'card',
      name: owned.card.name,
      rarity: owned.card.rarity,
      remainingQuantity: owned.quantity - 1,
    };
  });
}
