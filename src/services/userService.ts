import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { User as DiscordUser } from 'discord.js';

export async function ensureUser(prisma: PrismaClient, user: DiscordUser) {
  return prisma.user.upsert({
    where: { id: user.id },
    update: { username: user.username, avatarUrl: user.displayAvatarURL() },
    create: {
      id: user.id,
      username: user.username,
      avatarUrl: user.displayAvatarURL(),
    },
  });
}

export async function getOrCreateUser(prisma: PrismaClient, userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

function validateCoinAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw new Error('INVALID_AMOUNT');
  }
}

export async function addBalance(
  prisma: PrismaClient,
  userId: string,
  amount: number,
  type = 'BALANCE_ADJUSTMENT',
  metadata?: Prisma.InputJsonValue
) {
  validateCoinAmount(amount);

  if (amount < 0) {
    const absAmount = Math.abs(amount);
    return prisma.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: userId, balance: { gte: absAmount } },
        data: {
          balance: { decrement: absAmount },
          totalSpent: { increment: absAmount },
        },
      });
      if (debited.count !== 1) throw new Error('INSUFFICIENT_FUNDS');

      await tx.economyLedger.create({
        data: { type, fromUserId: userId, amount: absAmount, metadata },
      });
      return tx.user.findUniqueOrThrow({ where: { id: userId } });
    });
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: amount }, totalEarned: { increment: amount } },
    });
    await tx.economyLedger.create({
      data: { type, toUserId: userId, amount, metadata },
    });
    return user;
  });
}

export async function transferBalance(
  prisma: PrismaClient,
  fromId: string,
  toId: string,
  amount: number,
  type = 'USER_TRANSFER',
  metadata?: Prisma.InputJsonValue
) {
  validateCoinAmount(amount);
  if (amount < 0 || fromId === toId) throw new Error('INVALID_TRANSFER');

  return prisma.$transaction(async (tx) => {
    const debited = await tx.user.updateMany({
      where: { id: fromId, balance: { gte: amount } },
      data: { balance: { decrement: amount }, totalSpent: { increment: amount } },
    });
    if (debited.count !== 1) throw new Error('INSUFFICIENT_FUNDS');

    const recipient = await tx.user.update({
      where: { id: toId },
      data: { balance: { increment: amount }, totalEarned: { increment: amount } },
    });
    await tx.economyLedger.create({
      data: { type, fromUserId: fromId, toUserId: toId, amount, metadata },
    });
    return recipient;
  });
}

export async function addXp(prisma: PrismaClient, userId: string, xp: number) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { trainerXp: { increment: xp } },
  });

  const newLevel = Math.floor(Math.sqrt(user.trainerXp / 100)) + 1;
  if (newLevel > user.trainerLevel) {
    await prisma.user.update({
      where: { id: userId },
      data: { trainerLevel: newLevel },
    });
    return { leveledUp: true, newLevel, user };
  }
  return { leveledUp: false, newLevel: user.trainerLevel, user };
}

export function getTrainerTitle(level: number): string {
  if (level >= 150) return 'Champion';
  if (level >= 100) return 'Elite Four';
  if (level >= 75) return 'Gym Leader';
  if (level >= 50) return 'Gym Challenger';
  if (level >= 25) return 'Ace Trainer';
  if (level >= 10) return 'Youngster';
  return 'Rookie Trainer';
}

export function getRankedTier(points: number): string {
  if (points >= 2800) return 'Master';
  if (points >= 2400) return 'Diamond';
  if (points >= 2000) return 'Platinum';
  if (points >= 1600) return 'Gold';
  if (points >= 1200) return 'Silver';
  return 'Bronze';
}
