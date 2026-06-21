import { NextFunction, Router, Request, Response } from 'express';
import { z } from 'zod';
import type { BotClient } from '../../types/index.js';

export const apiRouter = Router();
const MANAGE_GUILD = 1n << 5n;
const ADMINISTRATOR = 1n << 3n;

type DiscordGuild = { id: string; permissions: string };
type DiscordProfile = { id: string; guilds?: DiscordGuild[] };
type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

function getClient(req: Request): BotClient {
  return (req as Request & { botClient: BotClient }).botClient;
}

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function canManageGuild(req: Request, guildId: string): boolean {
  const user = req.user as DiscordProfile | undefined;
  const guild = user?.guilds?.find((entry) => entry.id === guildId);
  if (!guild) return false;

  return hasManageGuildPermission(guild.permissions);
}

export function hasManageGuildPermission(rawPermissions: string): boolean {
  try {
    const permissions = BigInt(rawPermissions);
    return (permissions & MANAGE_GUILD) === MANAGE_GUILD ||
      (permissions & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}

function requireGuildManager(req: Request, res: Response, next: NextFunction) {
  if (!canManageGuild(req, req.params.guildId)) {
    return res.status(403).json({ error: 'Missing Manage Server permission' });
  }
  next();
}

export const guildSettingsSchema = z.object({
  dailyReward: z.number().int().min(0).max(1_000_000).optional(),
  weeklyReward: z.number().int().min(0).max(5_000_000).optional(),
  workCooldown: z.number().int().min(0).max(604_800).optional(),
  fishCooldown: z.number().int().min(0).max(604_800).optional(),
  huntCooldown: z.number().int().min(0).max(604_800).optional(),
  spawnEnabled: z.boolean().optional(),
  spawnCooldown: z.number().int().min(5).max(86_400).optional(),
  shinyRate: z.number().min(0).max(1).optional(),
  legendaryRate: z.number().min(0).max(1).optional(),
  robEnabled: z.boolean().optional(),
  robSuccessRate: z.number().min(0).max(1).optional(),
  robCooldown: z.number().int().min(0).max(2_592_000).optional(),
  robMaxLoss: z.number().int().min(0).max(10_000_000).optional(),
  antiSpamEnabled: z.boolean().optional(),
  scamDetectionEnabled: z.boolean().optional(),
  antiRaidEnabled: z.boolean().optional(),
  autoModEnabled: z.boolean().optional(),
  welcomeEnabled: z.boolean().optional(),
  welcomeMessage: z.string().trim().max(2_000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one setting is required',
});

// Bot stats
apiRouter.get('/stats', asyncRoute(async (req: Request, res: Response) => {
  const client = getClient(req);
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
}));

// Leaderboard
apiRouter.get('/leaderboard', asyncRoute(async (req: Request, res: Response) => {
  const client = getClient(req);
  const type = z.enum(['balance', 'pokemon', 'battles', 'ranked', 'level'])
    .catch('balance')
    .parse(req.query.type);
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
}));

// Guild info (auth required)
apiRouter.get('/guild/:guildId', requireAuth, requireGuildManager, asyncRoute(async (req: Request, res: Response) => {
  const client = getClient(req);
  const { guildId } = req.params;

  const guild = await client.prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  res.json(guild);
}));

// Update guild settings (auth required)
apiRouter.patch('/guild/:guildId', requireAuth, requireGuildManager, asyncRoute(async (req: Request, res: Response) => {
  const client = getClient(req);
  const { guildId } = req.params;

  const parsed = guildSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid settings',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const updated = await client.prisma.guild.update({ where: { id: guildId }, data: parsed.data });
  res.json(updated);
}));

// Guild analytics
apiRouter.get('/guild/:guildId/analytics', requireAuth, requireGuildManager, asyncRoute(async (req: Request, res: Response) => {
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
}));

// Recent audit log
apiRouter.get('/guild/:guildId/auditlog', requireAuth, requireGuildManager, asyncRoute(async (req: Request, res: Response) => {
  const client = getClient(req);
  const { guildId } = req.params;
  const logs = await client.prisma.auditLog.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(logs);
}));

// Global Pokemon list
apiRouter.get('/pokemon', asyncRoute(async (req: Request, res: Response) => {
  const client = getClient(req);
  const page = z.coerce.number().int().min(1).max(10_000).catch(1).parse(req.query.page);
  const limit = 50;
  const pokemon = await client.prisma.pokemon.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { id: 'asc' } });
  const total = await client.prisma.pokemon.count();
  res.json({ pokemon, total, page, pages: Math.ceil(total / limit) });
}));

// Active events
apiRouter.get('/events', asyncRoute(async (req: Request, res: Response) => {
  const client = getClient(req);
  const events = await client.prisma.event.findMany({ where: { isActive: true } });
  res.json(events);
}));

// Active giveaways
apiRouter.get('/giveaways', asyncRoute(async (req: Request, res: Response) => {
  const client = getClient(req);
  const guildId = z.string().min(1).max(32).optional().catch(undefined).parse(req.query.guildId);
  const where = guildId ? { guildId, status: 'active' } : { status: 'active' };
  const giveaways = await client.prisma.giveaway.findMany({
    where,
    include: { _count: { select: { entries: true } } },
    orderBy: { endsAt: 'asc' },
  });
  res.json(giveaways);
}));

apiRouter.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  getClient(req).logger.error('Dashboard API error', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});
