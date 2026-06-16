import type { BotClient } from '../types/index.js';

/**
 * Shared economy service for all financial transactions.
 * All economy operations should go through this service.
 * Currency: PokéCoins (integer amounts)
 */
export class EconomyService {
  private client: BotClient;

  constructor(client: BotClient) {
    this.client = client;
  }

  /**
   * Get a user's balance in PokéCoins
   */
  async getBalance(userId: string): Promise<number> {
    const user = await this.client.prisma.user.findUnique({ where: { id: userId } });
    return user?.balance ?? 0;
  }

  /**
   * Add PokéCoins to a user's balance
   */
  async addBalance(userId: string, amount: number): Promise<number> {
    const user = await this.client.prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount }, totalEarned: { increment: amount } },
    });
    return user.balance;
  }

  /**
   * Remove PokéCoins from a user's balance
   */
  async removeBalance(userId: string, amount: number): Promise<{ success: boolean; balance: number }> {
    const user = await this.client.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.balance < amount) {
      return { success: false, balance: user?.balance ?? 0 };
    }
    const updated = await this.client.prisma.user.update({
      where: { id: userId },
      data: { balance: { decrement: amount }, totalSpent: { increment: amount } },
    });
    return { success: true, balance: updated.balance };
  }

  /**
   * Transfer PokéCoins between users
   */
  async transferBalance(fromUserId: string, toUserId: string, amount: number): Promise<boolean> {
    try {
      await this.client.prisma.$transaction(async (tx) => {
        const from = await tx.user.findUnique({ where: { id: fromUserId } });
        if (!from || from.balance < amount) throw new Error('INSUFFICIENT_FUNDS');

        await tx.user.update({
          where: { id: fromUserId },
          data: { balance: { decrement: amount }, totalSpent: { increment: amount } },
        });
        await tx.user.update({
          where: { id: toUserId },
          data: { balance: { increment: amount }, totalEarned: { increment: amount } },
        });
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format a PokéCoin amount for display
   */
  static formatCoins(amount: number): string {
    return `${amount.toLocaleString()} PokéCoins`;
  }

  /**
   * Format a number for display (backwards compatible)
   */
  static formatNumber(amount: number): string {
    return amount.toLocaleString();
  }
}