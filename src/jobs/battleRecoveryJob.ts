import type { BotClient, BattleState } from '../types/index.js';
import { saveBattleResult } from '../services/battleService.js';

export async function recoverExpiredBattles(client: BotClient): Promise<void> {
  const now = new Date();
  const expired = await client.prisma.battle.findMany({
    where: {
      status: { in: ['selecting', 'confirming', 'active'] },
      expiresAt: { lte: now },
    },
    take: 25,
  });

  for (const battle of expired) {
    if (battle.status !== 'active') {
      await client.prisma.$transaction([
        client.prisma.battle.updateMany({
          where: { id: battle.id, status: { in: ['selecting', 'confirming'] } },
          data: { status: 'cancelled', endedAt: now },
        }),
        client.prisma.battleParticipantLock.deleteMany({ where: { battleId: battle.id } }),
      ]);
      continue;
    }

    const state = battle.state as unknown as BattleState | null;
    if (!state?.currentTurnUserId || !state.challengerTeam || !state.opponentTeam) {
      client.logger.error(`Cannot recover battle ${battle.id}: canonical state is missing`);
      continue;
    }
    state.status = 'finished';
    state.battleLog.push(`⏰ <@${state.currentTurnUserId}> timed out while the battle was recovering.`);
    const winnerId = state.currentTurnUserId === state.challengerId
      ? state.opponentId
      : state.challengerId;
    await saveBattleResult(client, state, winnerId);
    if (client.redis?.isReady) {
      await client.redis.del([
        `battle:${battle.id}`,
        `battle:user:${battle.challengerId}`,
        `battle:user:${battle.opponentId}`,
      ]).catch(() => {});
    }
  }
}
