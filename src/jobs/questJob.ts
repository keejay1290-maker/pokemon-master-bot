import type { BotClient } from '../types/index.js';

export async function resetDailyQuests(client: BotClient) {
  const now = new Date();

  // Reset all daily quest records whose period has expired (completed or not)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const resetCount = await client.prisma.userQuest.updateMany({
    where: { quest: { resetPeriod: 'daily' }, resetAt: { lte: now } },
    data: { progress: 0, completed: false, claimed: false, resetAt: tomorrow },
  });

  // Reset weekly quests whose period has expired
  const nextMonday = new Date();
  const daysUntilMonday = ((8 - nextMonday.getDay()) % 7) || 7;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);

  const weeklyCount = await client.prisma.userQuest.updateMany({
    where: { quest: { resetPeriod: 'weekly' }, resetAt: { lte: now } },
    data: { progress: 0, completed: false, claimed: false, resetAt: nextMonday },
  });

  client.logger.info(`Quest reset: ${resetCount.count} daily, ${weeklyCount.count} weekly`);
}
