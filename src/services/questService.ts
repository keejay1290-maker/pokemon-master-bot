import { PrismaClient } from '@prisma/client';
import { addXp } from './userService.js';

function getNextReset(period: string): Date {
  const d = new Date();
  if (period === 'daily') {
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
  } else if (period === 'weekly') {
    const daysUntilMonday = ((8 - d.getDay()) % 7) || 7;
    d.setDate(d.getDate() + daysUntilMonday);
    d.setHours(0, 0, 0, 0);
  } else {
    d.setMonth(d.getMonth() + 1, 1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

/**
 * Increments progress on all active quests of the given type for a user.
 * Creates UserQuest rows on first encounter. Auto-grants XP + coin rewards on completion.
 * @param questType matches Quest.type in the database (e.g. 'catch', 'battle_win', 'open_pack', 'earn_coins')
 * @param amount how much progress to add (default 1)
 */
export async function incrementQuestProgress(
  prisma: PrismaClient,
  userId: string,
  questType: string,
  amount = 1,
): Promise<void> {
  const quests = await prisma.quest.findMany({ where: { type: questType } });
  if (quests.length === 0) return;

  const now = new Date();

  for (const quest of quests) {
    const req = quest.requirement as { count?: number; amount?: number };
    const target = req.count ?? req.amount ?? 1;
    const nextReset = getNextReset(quest.resetPeriod);

    // Get or create the user's quest record
    let uq = await prisma.userQuest.upsert({
      where: { userId_questId: { userId, questId: quest.id } },
      create: { userId, questId: quest.id, progress: 0, completed: false, claimed: false, resetAt: nextReset },
      update: {},
    });

    // Reset if the period has expired (handles incomplete quests the job misses)
    if (uq.resetAt < now) {
      uq = await prisma.userQuest.update({
        where: { id: uq.id },
        data: { progress: 0, completed: false, claimed: false, resetAt: nextReset },
      });
    }

    if (uq.completed) continue;

    const newProgress = Math.min(uq.progress + amount, target);

    if (newProgress >= target) {
      await prisma.userQuest.update({
        where: { id: uq.id },
        data: { progress: newProgress, completed: true },
      });

      // Auto-grant rewards
      if (quest.coinReward > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { balance: { increment: quest.coinReward }, totalEarned: { increment: quest.coinReward } },
        });
      }
      if (quest.xpReward > 0) {
        await addXp(prisma, userId, quest.xpReward);
      }
    } else {
      await prisma.userQuest.update({
        where: { id: uq.id },
        data: { progress: newProgress },
      });
    }
  }
}
