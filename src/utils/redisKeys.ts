import { ActiveSpawn, BattleState } from '../types/index.js';

export const REDIS_KEYS = {
  spawn: (messageId: string) => `spawn:active:${messageId}`,
  guildSpawn: (guildId: string) => `spawn:guild:${guildId}`,
  spawnCooldown: (guildId: string) => `spawn:cooldown:${guildId}`,
  battle: (battleId: string) => `battle:${battleId}`,
  battleLock: (userId: string) => `battle:user:${userId}`,
  cooldown: (userId: string, command: string) => `cooldown:${userId}:${command}`,
};

export const REDIS_TTLS = {
  SPAWN: 300, // 5 minutes
  BATTLE: 1800, // 30 minutes
};

export function serializeSpawn(spawn: ActiveSpawn): string {
  return JSON.stringify(spawn);
}

export function deserializeSpawn(data: string | null): ActiveSpawn | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && parsed.spawnId) {
      // Restore Date objects
      parsed.expiresAt = new Date(parsed.expiresAt);
      return parsed as ActiveSpawn;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function serializeBattle(battle: BattleState): string {
  return JSON.stringify(battle);
}

export function deserializeBattle(data: string | null): BattleState | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && parsed.id) {
      return parsed as BattleState;
    }
    return null;
  } catch (e) {
    return null;
  }
}
