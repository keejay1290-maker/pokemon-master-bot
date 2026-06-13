import type { BotClient } from '../types/index.js';

export async function resetDailyQuests(client: BotClient) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  await client.prisma.userQuest.updateMany({
    where: { quest: { resetPeriod: 'daily' }, completed: true },
    data: { progress: 0, completed: false, claimed: false, resetAt: tomorrow },
  });

  client.logger.info('Daily quests reset');
}
