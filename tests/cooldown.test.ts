import { CooldownService } from '../src/services/CooldownService';
import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client';

describe('CooldownService', () => {
  it('shrinks redis TTL when configured cooldown reduced', async () => {
    // This is a lightweight integration-style test that requires a running Redis + Test DB.
    const prisma = new PrismaClient();
    const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    await redis.connect().catch(() => null);
    const cs: any = new CooldownService({ redis, prisma } as any);

    // Create a test user & guild config
    const user = await prisma.user.upsert({ where: { id: 'test-user' }, create: { id: 'test-user', username: 't' }, update: {} });
    const guild = await prisma.guild.upsert({ where: { id: 'test-g' }, create: { id: 'test-g', name: 'g', ownerId: 'u' }, update: {} });

    // set a long configured cooldown in DB
    await prisma.guild.update({ where: { id: guild.id }, data: { workCooldown: 3600 } });
    // write a career DB timestamp 30 seconds ago (so shrinking cooldown still leaves some remaining)
    const past = new Date(Date.now() - 30 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { lastWork: past } });

    const res1 = await cs.checkCareerForGuild(user.id, guild.id);
    expect(res1.onCooldown).toBe(true);
    // reduce guild cooldown to 1 minute
    await prisma.guild.update({ where: { id: guild.id }, data: { workCooldown: 60 } });
    const res2 = await cs.checkCareerForGuild(user.id, guild.id);
    expect(res2.onCooldown).toBe(true);
    expect(res2.remaining! <= 60).toBe(true);

    await redis.disconnect().catch(() => {});
    await prisma.$disconnect();
  }, 30000);
});
