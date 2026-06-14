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

// Synchronous boot logger. process.stdout is an ASYNC pipe in containers, so
// winston/console output can be lost if the process exits before libuv flushes.
// fs.writeSync(fd) is synchronous and survives process.exit — this is the only
// reliable way to capture a crash that happens during early startup on Railway.
const boot = (msg: string) => {
  try { fs.writeSync(1, `[boot] ${msg}\n`); } catch { /* ignore */ }
};
const bootErr = (msg: string) => {
  try { fs.writeSync(2, `[boot-error] ${msg}\n`); } catch { /* ignore */ }
};

// Register crash handlers BEFORE anything else so nothing is ever swallowed.
process.on('uncaughtException', (err) => {
  bootErr(`uncaughtException: ${err?.stack || err}`);
  process.exitCode = 1;
});
process.on('unhandledRejection', (err) => {
  bootErr(`unhandledRejection: ${(err as Error)?.stack || err}`);
});

boot('index.js evaluating');

const logger = createLogger();
boot('logger created');

async function main() {
  boot('main() entered');
  logger.info('Starting Pokemon Master Bot...');

  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });

  boot('connecting to database...');
  await prisma.$connect();
  boot('database connected');
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
  boot('loading commands...');
  const commandsPath = path.join(__dirname, 'commands');
  loadCommands(client, commandsPath);
  boot(`commands loaded: ${client.commands.size}`);

  // Register events
  registerEvents(client);
  boot('events registered');

  // Start dashboard before login so /health responds immediately to Railway healthcheck
  if (process.env.NODE_ENV !== 'test') {
    boot('starting dashboard...');
    startDashboard(client)
      .then(() => boot('dashboard started'))
      .catch((err) => {
        bootErr(`dashboard failed: ${err?.stack || err}`);
        logger.error('Dashboard failed to start:', err);
      });
  }

  // Login. Do not crash the process on login failure — keep the dashboard alive
  // so /health passes and the real auth error is visible in logs.
  boot('logging in to Discord...');
  if (!process.env.DISCORD_TOKEN) {
    bootErr('DISCORD_TOKEN is missing — bot cannot log in');
  }
  client
    .login(process.env.DISCORD_TOKEN)
    .then(() => {
      boot('discord login resolved');
      logger.info('Bot logged in');
    })
    .catch((err) => {
      bootErr(`discord login failed: ${err?.message || err}`);
      logger.error('Discord login failed:', err);
    });

  // Start services after login
  client.once('ready', async () => {
    boot(`ready as ${client.user?.tag}`);
    logger.info(`Bot ready as ${client.user?.tag}`);
    startSpawnService(client);
    startJobService(client);
  });

  // Keep the event loop alive even if Discord login fails, so the health
  // endpoint stays up and Railway keeps the container RUNNING.
  setInterval(() => { /* heartbeat */ }, 1 << 30);

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
  boot('main() setup complete — process staying alive');
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
  // Synchronous write so the error survives even immediate exit on a piped stdout.
  bootErr(`FATAL in main(): ${err?.stack || err}`);
  process.exitCode = 1;
});
