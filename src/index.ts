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

  const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  redis.on('error', (err) => logger.error('Redis error:', err));
  await redis.connect();
  logger.info('Redis connected');

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
  client.cooldowns = new Collection<string, Collection<string, number>>();
  client.prisma = prisma;
  client.redis = redis;
  client.logger = logger;
  client.spawnTimers = new Map();
  client.activeSpawns = new Map();
  client.activeBattles = new Map();
  client.activeTrades = new Map();

  // Load commands
  const commandsPath = path.join(__dirname, 'commands');
  loadCommands(client, commandsPath);

  // Register events
  registerEvents(client);

  // Login
  await client.login(process.env.DISCORD_TOKEN);
  logger.info('Bot logged in');

  // Start services after login
  client.once('ready', async () => {
    logger.info(`Bot ready as ${client.user?.tag}`);
    startSpawnService(client);
    startJobService(client);

    if (process.env.NODE_ENV !== 'test') {
      startDashboard(client).catch((err) =>
        logger.error('Dashboard failed to start:', err)
      );
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await prisma.$disconnect();
    await redis.disconnect();
    client.destroy();
    process.exit(0);
  });

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
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
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
