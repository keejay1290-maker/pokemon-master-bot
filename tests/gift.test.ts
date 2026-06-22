import { parseGiftSelection, transferPokemonGift } from '../src/services/giftService';

describe('Pokémon gifting', () => {
  test('parses hidden ownership selections without exposing database IDs in labels', () => {
    expect(parseGiftSelection('caught:owned-pokemon')).toEqual({
      kind: 'caught',
      ownershipId: 'owned-pokemon',
    });
    expect(parseGiftSelection('card:owned-card')).toEqual({
      kind: 'card',
      ownershipId: 'owned-card',
    });
    expect(parseGiftSelection('invalid')).toBeNull();
  });

  test('atomically transfers a caught Pokémon and writes its audit record', async () => {
    const tx = {
      userPokemon: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'owned-pokemon',
          pokemonId: 25,
          nickname: null,
          level: 12,
          isShiny: false,
          isInTeam: false,
          isFavorite: false,
          isLocked: false,
          pokemon: { nameDisplay: 'Pikachu', rarity: 'Rare' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      marketListing: { findFirst: jest.fn().mockResolvedValue(null) },
      battleParticipantLock: { findUnique: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    const result = await transferPokemonGift(
      prisma as never,
      'guild-1',
      'sender-1',
      'recipient-1',
      { kind: 'caught', ownershipId: 'owned-pokemon' },
    );

    expect(tx.userPokemon.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'owned-pokemon', userId: 'sender-1' }),
      data: { userId: 'recipient-1' },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'GIFT_POKEMON', targetId: 'recipient-1' }),
    }));
    expect(result.name).toBe('Pikachu');
  });

  test.each([
    ['favorite', { isFavorite: true, isLocked: false, isInTeam: false }, 'GIFT_FAVORITE'],
    ['locked', { isFavorite: false, isLocked: true, isInTeam: false }, 'GIFT_LOCKED'],
    ['team member', { isFavorite: false, isLocked: false, isInTeam: true }, 'GIFT_IN_TEAM'],
  ])('blocks a protected caught Pokémon: %s', async (_label, protection, errorCode) => {
    const tx = {
      userPokemon: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'owned-pokemon',
          pokemonId: 25,
          nickname: null,
          level: 12,
          isShiny: false,
          pokemon: { nameDisplay: 'Pikachu', rarity: 'Rare' },
          ...protection,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    await expect(transferPokemonGift(
      prisma as never,
      'guild-1',
      'sender-1',
      'recipient-1',
      { kind: 'caught', ownershipId: 'owned-pokemon' },
    )).rejects.toThrow(errorCode);
  });

  test('blocks caught Pokémon gifts while the sender has an active battle', async () => {
    const tx = {
      userPokemon: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'owned-pokemon',
          pokemonId: 25,
          nickname: null,
          level: 12,
          isShiny: false,
          isFavorite: false,
          isLocked: false,
          isInTeam: false,
          pokemon: { nameDisplay: 'Pikachu', rarity: 'Rare' },
        }),
      },
      battleParticipantLock: { findUnique: jest.fn().mockResolvedValue({ battleId: 'battle-1' }) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    await expect(transferPokemonGift(
      prisma as never,
      'guild-1',
      'sender-1',
      'recipient-1',
      { kind: 'caught', ownershipId: 'owned-pokemon' },
    )).rejects.toThrow('GIFT_IN_BATTLE');
  });

  test('moves one card copy and audits the transfer in the same transaction', async () => {
    const tx = {
      userCard: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'owned-card',
          cardId: 'base1-58',
          isFoil: false,
          quantity: 2,
          card: { name: 'Pikachu', rarity: 'Common' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    const result = await transferPokemonGift(
      prisma as never,
      'guild-1',
      'sender-1',
      'recipient-1',
      { kind: 'card', ownershipId: 'owned-card' },
    );

    expect(tx.userCard.updateMany).toHaveBeenCalled();
    expect(tx.userCard.deleteMany).not.toHaveBeenCalled();
    expect(tx.userCard.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_cardId_isFoil: {
          userId: 'recipient-1',
          cardId: 'base1-58',
          isFoil: false,
        },
      },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'GIFT_CARD', targetId: 'recipient-1' }),
    }));
    expect(result.remainingQuantity).toBe(1);
  });
});
