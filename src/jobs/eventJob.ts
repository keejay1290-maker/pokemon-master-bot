import type { BotClient } from '../types/index.js';

export async function checkEventSchedule(client: BotClient) {
  const now = new Date();

  await client.prisma.event.updateMany({
    where: { startDate: { lte: now }, endDate: { gte: now }, isActive: false },
    data: { isActive: true },
  });

  await client.prisma.event.updateMany({
    where: { endDate: { lt: now }, isActive: true },
    data: { isActive: false },
  });
}
