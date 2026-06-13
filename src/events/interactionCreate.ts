import {
  Interaction,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  Collection,
} from 'discord.js';
import type { BotClient } from '../types/index.js';
import { errorEmbed } from '../utils/embeds.js';
import { ensureUser } from '../services/userService.js';
import { ensureGuild } from '../services/guildService.js';

export async function handleInteractionCreate(interaction: Interaction, client: BotClient) {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction, client);
  } else if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction, client);
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction, client: BotClient) {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    // Ensure user and guild exist in DB
    if (interaction.user) {
      await ensureUser(client.prisma, interaction.user);
    }
    if (interaction.guild) {
      await ensureGuild(client.prisma, interaction.guild);
    }

    // Cooldown check
    if (command.cooldown) {
      const { checkCooldown, setCooldown } = await import('../utils/cooldown.js');
      const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, command.data.name, command.cooldown);
      
      if (onCooldown) {
        await interaction.reply({
          embeds: [errorEmbed('Cooldown', `Please wait **${remaining}s** before using \`/${command.data.name}\` again.`)],
          ephemeral: true,
        });
        return;
      }
      
      await setCooldown(client, interaction.user.id, command.data.name, command.cooldown);
    }

    await command.execute(interaction, client);
  } catch (err) {
    client.logger.error(`Error executing command ${interaction.commandName}:`, err);

    const errEmbed = errorEmbed('Error', 'An unexpected error occurred. Please try again later.');

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
    }
  }
}

async function handleAutocomplete(interaction: AutocompleteInteraction, client: BotClient) {
  const command = client.commands.get(interaction.commandName);
  if (!command?.autocomplete) return;

  try {
    await command.autocomplete(interaction, client);
  } catch (err) {
    client.logger.error(`Autocomplete error for ${interaction.commandName}:`, err);
    await interaction.respond([]).catch(() => {});
  }
}
