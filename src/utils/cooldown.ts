import type { BotClient } from '../types/index.js';

export async function checkCooldown(
  client: BotClient,
  userId: string,
  command: string,
  cooldownSeconds: number
): Promise<{ onCooldown: boolean; remaining?: number }> {
  const key = `cooldown:${userId}:${command}`;
  const cached = await client.redis.get(key);

  if (cached) {
    const expiresAt = parseInt(cached, 10);
    const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
    if (remaining > 0) return { onCooldown: true, remaining };
  }

  return { onCooldown: false };
}

export async function setCooldown(
  client: BotClient,
  userId: string,
  command: string,
  cooldownSeconds: number
): Promise<void> {
  const key = `cooldown:${userId}:${command}`;
  const expiresAt = Date.now() + cooldownSeconds * 1000;
  await client.redis.set(key, expiresAt.toString(), { EX: cooldownSeconds });
}

export function formatCooldown(seconds: number): string {
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
