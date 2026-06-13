import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import path from 'path';
import fs from 'fs';
import type { Command } from './types/index.js';

const commands: unknown[] = [];

function loadCommands(dirPath: string) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const cmd = require(fullPath);
        const command: Command = cmd.default || cmd;
        if (command?.data) commands.push(command.data.toJSON());
      } catch (err) {
        console.error(`Failed to load ${fullPath}:`, err);
      }
    }
  }
}

const commandsPath = path.join(__dirname, 'commands');
loadCommands(commandsPath);

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
  console.log(`Deploying ${commands.length} commands...`);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands });
  console.log('✅ Commands deployed globally!');
})().catch(console.error);
