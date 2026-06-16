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
    // Backwards compatible simple check — prefer using the guild-aware variant below
    return this.check(userId, 'career:work');
  }

  /**
   * Guild-aware career cooldown check.
   * Reads canonical last-action timestamps from the database (lastWork/lastBeg/lastRob)
   * and applies the guild-configured workCooldown so admin changes apply immediately.
   * Falls back to Redis-only check if no DB timestamp is available.
   */
  async checkCareerForGuild(userId: string, guildId?: string): Promise<{ onCooldown: boolean; remaining?: number }> {
    const redisKey = `cooldown:${userId}:career:work`;

    // Determine configured cooldown from guild (fallback to 3600s)
    let configured = 3600;
    if (guildId) {
      try {
        const guild = await this.client.prisma.guild.findUnique({ where: { id: guildId } });
        if (guild?.workCooldown) configured = guild.workCooldown;
      } catch (e) {
        // ignore DB errors and use default configured value
      }
    }

    // Read DB canonical timestamps (if available)
    try {
      const user = await this.client.prisma.user.findUnique({ where: { id: userId }, select: { lastWork: true, lastBeg: true, lastRob: true } });
      const lastTimes: number[] = [];
      if (user?.lastWork) lastTimes.push(user.lastWork.getTime());
      if (user?.lastBeg) lastTimes.push(user.lastBeg.getTime());
      if (user?.lastRob) lastTimes.push(user.lastRob.getTime());

      const lastAction = lastTimes.length > 0 ? Math.max(...lastTimes) : null;
      if (lastAction) {
        const expiresAt = lastAction + configured * 1000;
        const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
        if (remaining > 0) {
          // Ensure Redis cache matches DB-derived expiry so subsequent checks are fast
          try {
            if (this.client.redis?.isReady) {
              await this.client.redis.set(redisKey, expiresAt.toString(), { EX: remaining });
            }
          } catch { /* non-fatal */ }
          return { onCooldown: true, remaining };
        }

        // DB indicates cooldown expired. Clear any stale Redis key and return not on cooldown.
        try { if (this.client.redis?.isReady) await this.client.redis.del(redisKey); } catch { /* non-fatal */ }
        return { onCooldown: false };
      }
    } catch (e) {
      // DB lookup failed — fall back to Redis-only below
    }

    // Fallback: read Redis cached expiry if present
    const cached = await this.client.redis.get(redisKey).catch(() => null);
    if (cached) {
      const expiresAt = parseInt(cached, 10);
      const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
      if (remaining > 0) {
        // If the configured cooldown has been reduced since the key was set,
        // shrink the cached expiry to honour the new configuration immediately.
        if (remaining > configured) {
          try {
            const newExpiresAt = Date.now() + configured * 1000;
            if (this.client.redis?.isReady) {
              await this.client.redis.set(redisKey, newExpiresAt.toString(), { EX: configured });
            }
          } catch { /* non-fatal */ }
          return { onCooldown: true, remaining: configured };
        }
        return { onCooldown: true, remaining };
      }
      // Expired key — try to clean up
      try { if (this.client.redis?.isReady) await this.client.redis.del(redisKey); } catch { /* non-fatal */ }
    }

    return { onCooldown: false };
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