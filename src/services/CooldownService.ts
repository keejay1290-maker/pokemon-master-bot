import type { BotClient } from '../types/index.js';

export class CooldownService {
  private client: BotClient;

  constructor(client: BotClient) {
    this.client = client;
  }

  /**
   * Check if a user is on cooldown for a specific key
   */
  async check(userId: string, key: string): Promise<{ onCooldown: boolean; remaining?: number }> {
    const redisKey = `cooldown:${userId}:${key}`;
    const cached = await this.client.redis.get(redisKey);

    if (cached) {
      const expiresAt = parseInt(cached, 10);
      const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
      if (remaining > 0) return { onCooldown: true, remaining };
    }

    return { onCooldown: false };
  }

  /**
   * Set a cooldown for a user on a specific key
   */
  async set(userId: string, key: string, cooldownSeconds: number): Promise<void> {
    const redisKey = `cooldown:${userId}:${key}`;
    const expiresAt = Date.now() + cooldownSeconds * 1000;
    await this.client.redis.set(redisKey, expiresAt.toString(), { EX: cooldownSeconds });
  }

  /**
   * Career work cooldown - shared across ALL career commands
   */
  async checkCareer(userId: string): Promise<{ onCooldown: boolean; remaining?: number }> {
    return this.check(userId, 'career:work');
  }

  async setCareer(userId: string, cooldownSeconds: number): Promise<void> {
    await this.set(userId, 'career:work', cooldownSeconds);
  }

  /**
   * Format cooldown seconds into human-readable string
   */
  static formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return s > 0 ? `${m}m ${s}s` : `${m} minute${m !== 1 ? 's' : ''}`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h} hour${h !== 1 ? 's' : ''}`;
  }
}