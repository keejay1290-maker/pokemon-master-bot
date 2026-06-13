import type { BotClient } from '../types/index.js';
import { handleInteractionCreate } from './interactionCreate.js';
import { handleGuildCreate } from './guildCreate.js';
import { handleMessageCreate } from './messageCreate.js';
import { handleGuildMemberAdd } from './guildMemberAdd.js';
import { handleGuildMemberRemove } from './guildMemberRemove.js';
import { handleReady } from './ready.js';

export function registerEvents(client: BotClient) {
  client.on('ready', () => handleReady(client));
  client.on('interactionCreate', (interaction) => handleInteractionCreate(interaction, client));
  client.on('guildCreate', (guild) => handleGuildCreate(guild, client));
  client.on('messageCreate', (message) => handleMessageCreate(message, client));
  client.on('guildMemberAdd', (member) => handleGuildMemberAdd(member, client));
  client.on('guildMemberRemove', (member) => handleGuildMemberRemove(member, client));
}
