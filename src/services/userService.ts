import { PrismaClient } from '@prisma/client';
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

export async function addBalance(prisma: PrismaClient, userId: string, amount: number) {
  if (amount < 0) {
    const absAmount = Math.abs(amount);
    return prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: userId } });
      if (!u || u.balance < absAmount) throw new Error('INSUFFICIENT_FUNDS');
      return tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: absAmount },
          totalSpent: { increment: absAmount },
        },
      });
    });
  } else {
    return prisma.user.update({
      where: { id: userId },
      data: {
        balance: { increment: amount },
        totalEarned: amount > 0 ? { increment: amount } : undefined,
      },
    });
  }
}

export async function transferBalance(
  prisma: PrismaClient,
  fromId: string,
  toId: string,
  amount: number
) {
  return prisma.$transaction(async (tx) => {
    const fromUser = await tx.user.findUnique({ where: { id: fromId } });
    if (!fromUser || fromUser.balance < amount) throw new Error('INSUFFICIENT_FUNDS');
    
    await tx.user.update({ where: { id: fromId }, data: { balance: { decrement: amount }, totalSpent: { increment: amount } } });
    return tx.user.update({ where: { id: toId }, data: { balance: { increment: amount }, totalEarned: { increment: amount } } });
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
  if (level >= 100) return 'Pokemon Master';
  if (level >= 80) return 'Elite Four Member';
  if (level >= 60) return 'Gym Leader';
  if (level >= 40) return 'Ace Trainer';
  if (level >= 20) return 'Pokemon Trainer';
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
