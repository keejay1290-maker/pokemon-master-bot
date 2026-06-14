import 'dotenv/config';
import { GatewayIntentBits, Partials, Collection } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import path from 'path';
import fs from 'fs';
import type { BotClient, Command } from './types/index.js';
import { createLogger } from './utils/logger.js';
import { registerEvents } from './events/index.js';
import { startSpawnService } from './services/spawnService.js';
import { startJobService } from './jobs/index.js';
import { startDashboard } from './dashboard/server.js';

const logger = createLogger();

async function main() {
  logger.info('Starting Pokemon Master Bot...');

  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });

  await prisma.$connect();
  logger.info('Database connected');

  // Redis is OPTIONAL. Never `await` the connect — redis v4's default reconnect
  // strategy keeps connect() pending forever on ECONNREFUSED, which previously
  // blocked the entire startup (dashboard + Discord login) and caused Railway to
  // see no listener (502) and kill the container with zero logs.
  const redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      connectTimeout: 5000,
      // Stop retrying after a few attempts so we don't spam logs forever.
      reconnectStrategy: (retries) => (retries > 5 ? false : Math.min(retries * 250, 2000)),
    },
  });
  let redisErrorLogged = false;
  redis.on('error', (err) => {
    // Log the first error only; the reconnect loop would otherwise flood logs.
    if (!redisErrorLogged) {
      redisErrorLogged = true;
      logger.warn('Redis error (non-fatal, running without cache):', (err as Error)?.message ?? err);
    }
  });
  redis
    .connect()
    .then(() => logger.info('Redis connected'))
    .catch(() => logger.warn('Redis unavailable — running without cache (non-fatal)'));

  const client = new (require('discord.js').Client)({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  }) as BotClient;

  client.commands = new Collection<string, Command>();
  client.prisma = prisma;
  client.redis = redis;
  client.logger = logger;

  // Load commands
  const commandsPath = path.join(__dirname, 'commands');
  loadCommands(client, commandsPath);

  // Register events
  registerEvents(client);

  // Start dashboard before login so /health responds immediately to Railway healthcheck
  if (process.env.NODE_ENV !== 'test') {
    startDashboard(client).catch((err) =>
      logger.error('Dashboard failed to start:', err)
    );
  }

  // Login
  await client.login(process.env.DISCORD_TOKEN);
  logger.info('Bot logged in');

  // Start services after login
  client.once('ready', async () => {
    logger.info(`Bot ready as ${client.user?.tag}`);
    startSpawnService(client);
    startJobService(client);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    try { await prisma.$disconnect(); } catch { /* ignore */ }
    try { if (redis.isOpen) await redis.disconnect(); } catch { /* ignore */ }
    client.destroy();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled rejection:', err);
  });
}

function loadCommands(client: BotClient, dirPath: string) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      loadCommands(client, fullPath);
    } else if (
      // Skip TypeScript declaration files (.d.ts) — in dist/ they end with
      // `.ts` but contain no runtime export and previously logged 42 errors.
      !entry.name.endsWith('.d.ts') &&
      (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) &&
      !entry.name.endsWith('.map')
    ) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const cmd = require(fullPath);
        const command: Command = cmd.default || cmd;
        if (command?.data?.name) {
          client.commands.set(command.data.name, command);
        }
      } catch (err) {
        client.logger.error(`Failed to load command ${fullPath}:`, err);
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
