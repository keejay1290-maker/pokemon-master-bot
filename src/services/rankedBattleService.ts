import type { Prisma, PrismaClient } from '@prisma/client';
import type { BattlePokemon } from '../types/index.js';

export const RANKED_TEAM_MIN = 1;
export const RANKED_TEAM_MAX = 3;
export const BATTLE_SETUP_TTL_MS = 10 * 60 * 1000;

export function getTeamOwnershipIds(team: BattlePokemon[]): string[] {
  return [...new Set(team.map((pokemon) => pokemon.userPokemonId))];
}

export async function createBattleWithParticipantLocks(
  prisma: PrismaClient,
  data: {
    challengerId: string;
    opponentId: string;
    guildId: string;
    type: 'ranked' | 'unranked';
  },
) {
  if (data.challengerId === data.opponentId) throw new Error('INVALID_OPPONENT');
  const expiresAt = new Date(Date.now() + BATTLE_SETUP_TTL_MS);

  return prisma.$transaction(async (tx) => {
    await tx.battleParticipantLock.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    const locked = await tx.battleParticipantLock.findFirst({
      where: { userId: { in: [data.challengerId, data.opponentId] } },
    });
    if (locked) throw new Error('BATTLE_PARTICIPANT_BUSY');

    const battle = await tx.battle.create({
      data: {
        ...data,
        status: 'selecting',
        expiresAt,
      },
    });
    await tx.battleParticipantLock.createMany({
      data: [
        { userId: data.challengerId, battleId: battle.id, expiresAt },
        { userId: data.opponentId, battleId: battle.id, expiresAt },
      ],
    });
    return battle;
  });
}

export async function releaseBattleParticipantLocks(
  prisma: PrismaClient,
  battleId: string,
): Promise<void> {
  await prisma.battleParticipantLock.deleteMany({ where: { battleId } });
}

function teamJson(team: BattlePokemon[]): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(team)) as Prisma.InputJsonValue;
}

export async function confirmRankedBattleRisk(
  prisma: PrismaClient,
  battleId: string,
  userId: string,
) {
  const battle = await prisma.battle.findUnique({ where: { id: battleId } });
  if (!battle || battle.type !== 'ranked' || battle.status !== 'confirming') {
    throw new Error('RANKED_CONFIRMATION_CLOSED');
  }
  if (userId === battle.challengerId) {
    return prisma.battle.update({
      where: { id: battleId },
      data: { challengerConfirmed: true },
    });
  }
  if (userId === battle.opponentId) {
    return prisma.battle.update({
      where: { id: battleId },
      data: { opponentConfirmed: true },
    });
  }
  throw new Error('NOT_BATTLE_PARTICIPANT');
}

export async function activateBattleWithTeams(
  prisma: PrismaClient,
  battleId: string,
  challengerTeam: BattlePokemon[],
  opponentTeam: BattlePokemon[],
) {
  return prisma.$transaction(async (tx) => {
    const battle = await tx.battle.findUnique({ where: { id: battleId } });
    if (!battle || !['selecting', 'confirming'].includes(battle.status)) {
      throw new Error('BATTLE_SETUP_CLOSED');
    }

    if (battle.type === 'ranked') {
      if (!battle.challengerConfirmed || !battle.opponentConfirmed) {
        throw new Error('RANKED_CONFIRMATION_REQUIRED');
      }
      await validateRankedTeamOwnership(tx, battle.challengerId, challengerTeam);
      await validateRankedTeamOwnership(tx, battle.opponentId, opponentTeam);
    } else {
      for (const [userId, team] of [
        [battle.challengerId, challengerTeam],
        [battle.opponentId, opponentTeam],
      ] as const) {
        const ids = getTeamOwnershipIds(team);
        if (ids.length < 1 || ids.length > 6 || ids.length !== team.length) {
          throw new Error('INVALID_BATTLE_TEAM');
        }
        const owned = await tx.userPokemon.count({ where: { id: { in: ids }, userId } });
        if (owned !== ids.length) throw new Error('BATTLE_TEAM_OWNERSHIP_CHANGED');
      }
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await tx.battleParticipantLock.updateMany({
      where: { battleId },
      data: { expiresAt },
    });
    return tx.battle.update({
      where: { id: battleId },
      data: {
        status: 'active',
        challengerTeam: teamJson(challengerTeam),
        opponentTeam: teamJson(opponentTeam),
        startedAt: new Date(),
        expiresAt,
      },
    });
  });
}

export async function validateRankedTeamOwnership(
  tx: Prisma.TransactionClient,
  userId: string,
  team: BattlePokemon[],
): Promise<string[]> {
  const ownershipIds = getTeamOwnershipIds(team);
  if (ownershipIds.length < RANKED_TEAM_MIN || ownershipIds.length > RANKED_TEAM_MAX ||
    ownershipIds.length !== team.length) {
    throw new Error('INVALID_RANKED_TEAM_SIZE');
  }

  const owned = await tx.userPokemon.findMany({
    where: {
      id: { in: ownershipIds },
      userId,
      isLocked: false,
      isFavorite: false,
      OR: [{ currentHp: null }, { currentHp: { gt: 0 } }],
    },
    select: { id: true },
  });
  if (owned.length !== ownershipIds.length) throw new Error('RANKED_TEAM_OWNERSHIP_CHANGED');

  const listing = await tx.marketListing.findFirst({
    where: {
      status: 'active',
      OR: ownershipIds.map((id) => ({
        itemData: { path: ['userPokemonId'], equals: id },
      })),
    },
    select: { id: true },
  });
  if (listing) throw new Error('RANKED_TEAM_LISTED');
  return ownershipIds;
}

export async function transferRankedBattleStakes(
  tx: Prisma.TransactionClient,
  battleId: string,
  loserId: string,
  winnerId: string,
  losingTeam: BattlePokemon[],
): Promise<string[]> {
  const ownershipIds = getTeamOwnershipIds(losingTeam);
  if (ownershipIds.length < RANKED_TEAM_MIN || ownershipIds.length > RANKED_TEAM_MAX ||
    ownershipIds.length !== losingTeam.length) {
    throw new Error('INVALID_RANKED_TEAM_SIZE');
  }
  const stillOwned = await tx.userPokemon.count({
    where: { id: { in: ownershipIds }, userId: loserId },
  });
  if (stillOwned !== ownershipIds.length) throw new Error('RANKED_STAKE_OWNERSHIP_CHANGED');

  await tx.marketListing.updateMany({
    where: {
      status: 'active',
      OR: ownershipIds.map((id) => ({
        itemData: { path: ['userPokemonId'], equals: id },
      })),
    },
    data: { status: 'cancelled' },
  });
  for (const assetId of ownershipIds) {
    const transferred = await tx.userPokemon.updateMany({
      where: { id: assetId, userId: loserId },
      data: {
        userId: winnerId,
        isInTeam: false,
        teamSlot: null,
        isFavorite: false,
        isLocked: false,
      },
    });
    if (transferred.count !== 1) throw new Error('RANKED_STAKE_TRANSFER_FAILED');

    await tx.ownershipLedger.create({
      data: {
        type: 'RANKED_BATTLE_STAKE',
        assetType: 'USER_POKEMON',
        assetId,
        fromUserId: loserId,
        toUserId: winnerId,
        battleId,
        metadata: { irreversible: true },
      },
    });
  }

  return ownershipIds;
}
