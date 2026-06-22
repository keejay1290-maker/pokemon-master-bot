import {
  createBattleWithParticipantLocks,
  transferRankedBattleStakes,
  validateRankedTeamOwnership,
} from '../src/services/rankedBattleService';
import type { BattlePokemon } from '../src/types/index';
import { saveBattleResult } from '../src/services/battleService';

function battlePokemon(id: string): BattlePokemon {
  return {
    userPokemonId: id,
    pokemonId: 25,
    name: 'Pikachu',
    level: 20,
    isShiny: false,
    nature: 'Hardy',
    types: ['electric'],
    moves: ['thunderbolt'],
    moveData: [{ name: 'thunderbolt', type: 'electric', category: 'Special', power: 90, accuracy: 100, pp: 15 }],
    maxHp: 60,
    currentHp: 60,
    attack: 40,
    defense: 40,
    spAttack: 55,
    spDefense: 50,
    speed: 70,
    statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    volatileStatus: [],
    ability: 'static',
  };
}

describe('Ranked battle stakes', () => {
  test('creates durable unique participant locks with the pending battle', async () => {
    const tx = {
      battleParticipantLock: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      battle: {
        create: jest.fn().mockResolvedValue({ id: 'battle-1' }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    await createBattleWithParticipantLocks(prisma as never, {
      challengerId: 'one',
      opponentId: 'two',
      guildId: 'guild',
      type: 'ranked',
    });

    expect(tx.battle.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'selecting', type: 'ranked' }),
    }));
    expect(tx.battleParticipantLock.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: 'one', battleId: 'battle-1' }),
        expect.objectContaining({ userId: 'two', battleId: 'battle-1' }),
      ]),
    }));
  });

  test('rejects a trainer already locked into another battle', async () => {
    const tx = {
      battleParticipantLock: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ userId: 'one' }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    await expect(createBattleWithParticipantLocks(prisma as never, {
      challengerId: 'one',
      opponentId: 'two',
      guildId: 'guild',
      type: 'ranked',
    })).rejects.toThrow('BATTLE_PARTICIPANT_BUSY');
  });

  test('only validates eligible caught UserPokemon ownership', async () => {
    const tx = {
      userPokemon: {
        findMany: jest.fn().mockResolvedValue([{ id: 'poke-1' }, { id: 'poke-2' }]),
      },
      marketListing: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const ids = await validateRankedTeamOwnership(
      tx as never,
      'loser',
      [battlePokemon('poke-1'), battlePokemon('poke-2')],
    );
    expect(ids).toEqual(['poke-1', 'poke-2']);
    expect(tx.userPokemon.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'loser',
        isLocked: false,
        isFavorite: false,
      }),
    }));
    expect((tx as Record<string, unknown>).userCard).toBeUndefined();
  });

  test('atomically transfers every losing Pokémon and writes ownership ledger rows', async () => {
    const tx = {
      userPokemon: {
        count: jest.fn().mockResolvedValue(2),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      marketListing: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ownershipLedger: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const transferred = await transferRankedBattleStakes(
      tx as never,
      'battle-1',
      'loser',
      'winner',
      [battlePokemon('poke-1'), battlePokemon('poke-2')],
    );

    expect(transferred).toEqual(['poke-1', 'poke-2']);
    expect(tx.userPokemon.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.ownershipLedger.create).toHaveBeenCalledTimes(2);
    expect(tx.ownershipLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'RANKED_BATTLE_STAKE',
        assetType: 'USER_POKEMON',
        fromUserId: 'loser',
        toUserId: 'winner',
      }),
    }));
  });

  test('fails the whole stake operation if any selected ownership changed', async () => {
    const tx = {
      userPokemon: { count: jest.fn().mockResolvedValue(1) },
    };
    await expect(transferRankedBattleStakes(
      tx as never,
      'battle-1',
      'loser',
      'winner',
      [battlePokemon('poke-1'), battlePokemon('poke-2')],
    )).rejects.toThrow('RANKED_STAKE_OWNERSHIP_CHANGED');
  });

  test('finalizes ranked result, stakes, rewards, and lock release through one transaction', async () => {
    const tx = {
      battle: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      userPokemon: {
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      marketListing: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ownershipLedger: { create: jest.fn().mockResolvedValue(undefined) },
      user: { update: jest.fn().mockResolvedValue(undefined) },
      economyLedger: { create: jest.fn().mockResolvedValue(undefined) },
      battleParticipantLock: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
      user: {
        update: jest.fn().mockResolvedValue({ trainerXp: 0, trainerLevel: 1 }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      userAchievement: { findMany: jest.fn().mockResolvedValue([]) },
      achievement: { findMany: jest.fn().mockResolvedValue([]) },
      userQuest: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const state = {
      id: 'battle-1',
      challengerId: 'winner',
      opponentId: 'loser',
      guildId: 'guild',
      type: 'ranked' as const,
      status: 'finished' as const,
      turn: 5,
      currentTurnUserId: 'winner',
      challengerTeam: [battlePokemon('winner-poke')],
      opponentTeam: [battlePokemon('loser-poke')],
      challengerActivePokemonIndex: 0,
      opponentActivePokemonIndex: 0,
      weather: 'clear',
      weatherTurns: 0,
      battleLog: ['finished'],
      channelId: 'channel',
    };

    const rewards = await saveBattleResult({
      prisma,
      redis: { isReady: false },
    } as never, state, 'winner');

    expect(rewards?.transferredPokemon).toBe(1);
    expect(tx.battle.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'active',
        challengerConfirmed: true,
        opponentConfirmed: true,
        stakesTransferredAt: null,
      }),
    }));
    expect(tx.ownershipLedger.create).toHaveBeenCalledTimes(1);
    expect(tx.economyLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'BATTLE_REWARD', toUserId: 'winner' }),
    }));
    expect(tx.battleParticipantLock.deleteMany).toHaveBeenCalledWith({
      where: { battleId: 'battle-1' },
    });
  });
});
