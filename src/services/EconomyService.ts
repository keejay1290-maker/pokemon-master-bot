import type { BotClient } from '../types/index.js';
import { addBalance, transferBalance } from './userService.js';

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
    if (amount <= 0) throw new Error('INVALID_AMOUNT');
    const user = await addBalance(this.client.prisma, userId, amount);
    return user.balance;
  }

  /**
   * Remove PokéCoins from a user's balance
   */
  async removeBalance(userId: string, amount: number): Promise<{ success: boolean; balance: number }> {
    if (amount <= 0) return { success: false, balance: await this.getBalance(userId) };
    try {
      const user = await addBalance(this.client.prisma, userId, -amount);
      return { success: true, balance: user.balance };
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_FUNDS') {
        return { success: false, balance: await this.getBalance(userId) };
      }
      throw error;
    }
  }

  /**
   * Transfer PokéCoins between users
   */
  async transferBalance(fromUserId: string, toUserId: string, amount: number): Promise<boolean> {
    try {
      await transferBalance(this.client.prisma, fromUserId, toUserId, amount);
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
