import { Router, Request, Response } from 'express';
import type { BotClient } from '../../types/index.js';

export const apiRouter = Router();

function getClient(req: Request): BotClient {
  return (req as Request & { botClient: BotClient }).botClient;
}

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Bot stats
apiRouter.get('/stats', async (req: Request, res: Response) => {
  const client = getClient(req);
  try {
    const [totalUsers, totalGuilds, totalPokemon, totalBattles] = await Promise.all([
      client.prisma.user.count(),
      client.prisma.guild.count(),
      client.prisma.userPokemon.count(),
      client.prisma.battle.count(),
    ]);
    res.json({
      guilds: client.guilds.cache.size,
      users: totalUsers,
      totalGuilds,
      totalPokemon,
      totalBattles,
      uptime: process.uptime(),
      ping: client.ws.ping,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leaderboard
apiRouter.get('/leaderboard', async (req: Request, res: Response) => {
  const client = getClient(req);
  const type = (req.query.type as string) ?? 'balance';
  const orderBy: Record<string, unknown> = {};

  switch (type) {
    case 'balance': orderBy.balance = 'desc'; break;
    case 'pokemon': orderBy.pokemonCaught = 'desc'; break;
    case 'battles': orderBy.battlesWon = 'desc'; break;
    case 'ranked': orderBy.rankedPoints = 'desc'; break;
    case 'level': orderBy.trainerLevel = 'desc'; break;
    default: orderBy.balance = 'desc';
  }

  const users = await client.prisma.user.findMany({
    orderBy,
    take: 20,
    select: { id: true, username: true, balance: true, pokemonCaught: true, battlesWon: true, rankedPoints: true, trainerLevel: true, shinyCaught: true, avatarUrl: true },
  });
  res.json(users);
});

// Guild info (auth required)
apiRouter.get('/guild/:guildId', requireAuth, async (req: Request, res: Response) => {
  const client = getClient(req);
  const { guildId } = req.params;

  const user = req.user as { id: string; guilds?: Array<{ id: string; permissions: string }> };
  const userGuild = user.guilds?.find((g) => g.id === guildId);
  if (!userGuild || !(parseInt(userGuild.permissions) & 0x20)) {
    return res.status(403).json({ error: 'Missing permissions' });
  }

  const guild = await client.prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  res.json(guild);
});

// Update guild settings (auth required)
apiRouter.patch('/guild/:guildId', requireAuth, async (req: Request, res: Response) => {
  const client = getClient(req);
  const { guildId } = req.params;

  const user = req.user as { id: string; guilds?: Array<{ id: string; permissions: string }> };
  const userGuild = user.guilds?.find((g) => g.id === guildId);
  if (!userGuild || !(parseInt(userGuild.permissions) & 0x20)) {
    return res.status(403).json({ error: 'Missing permissions' });
  }

  const allowedFields = [
    'dailyReward', 'weeklyReward', 'workCooldown', 'fishCooldown', 'huntCooldown',
    'spawnEnabled', 'spawnCooldown', 'shinyRate', 'legendaryRate',
    'robEnabled', 'robSuccessRate', 'robCooldown', 'robMaxLoss',
    'antiSpamEnabled', 'scamDetectionEnabled', 'antiRaidEnabled', 'autoModEnabled',
    'welcomeEnabled', 'welcomeMessage',
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }

  const updated = await client.prisma.guild.update({ where: { id: guildId }, data });
  res.json(updated);
});

// Guild analytics
apiRouter.get('/guild/:guildId/analytics', requireAuth, async (req: Request, res: Response) => {
  const client = getClient(req);
  const { guildId } = req.params;

  const [memberCount, totalPokemonCaught, totalBattles, totalCards, recentWarnings] = await Promise.all([
    client.prisma.guildUser.count({ where: { guildId } }),
    client.prisma.userPokemon.count(),
    client.prisma.battle.count({ where: { guildId } }),
    client.prisma.userCard.count(),
    client.prisma.warning.count({ where: { guildId, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
  ]);

  res.json({ memberCount, totalPokemonCaught, totalBattles, totalCards, recentWarnings });
});

// Recent audit log
apiRouter.get('/guild/:guildId/auditlog', requireAuth, async (req: Request, res: Response) => {
  const client = getClient(req);
  const { guildId } = req.params;
  const logs = await client.prisma.auditLog.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(logs);
});

// Global Pokemon list
apiRouter.get('/pokemon', async (req: Request, res: Response) => {
  const client = getClient(req);
  const page = parseInt(req.query.page as string ?? '1');
  const limit = 50;
  const pokemon = await client.prisma.pokemon.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { id: 'asc' } });
  const total = await client.prisma.pokemon.count();
  res.json({ pokemon, total, page, pages: Math.ceil(total / limit) });
});

// Active events
apiRouter.get('/events', async (req: Request, res: Response) => {
  const client = getClient(req);
  const events = await client.prisma.event.findMany({ where: { isActive: true } });
  res.json(events);
});

// Active giveaways
apiRouter.get('/giveaways', async (req: Request, res: Response) => {
  const client = getClient(req);
  const guildId = req.query.guildId as string;
  const where = guildId ? { guildId, status: 'active' } : { status: 'active' };
  const giveaways = await client.prisma.giveaway.findMany({
    where,
    include: { _count: { select: { entries: true } } },
    orderBy: { endsAt: 'asc' },
  });
  res.json(giveaways);
});
