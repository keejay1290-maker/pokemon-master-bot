import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { openShop } from './shop.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Browse and buy items — opens the full PokéMart with buttons'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    return openShop(interaction, client);
  },
};

export default command;
