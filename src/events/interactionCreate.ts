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
      const { Collection: DiscordCollection } = await import('discord.js');
      if (!client.cooldowns.has(command.data.name)) {
        client.cooldowns.set(command.data.name, new Collection<string, number>());
      }
      const now = Date.now();
      const timestamps = client.cooldowns.get(command.data.name)!;
      const cooldownMs = (command.cooldown ?? 3) * 1000;

      if (timestamps.has(interaction.user.id)) {
        const expiry = timestamps.get(interaction.user.id)! + cooldownMs;
        if (now < expiry) {
          const remaining = ((expiry - now) / 1000).toFixed(1);
          await interaction.reply({
            embeds: [errorEmbed('Cooldown', `Please wait **${remaining}s** before using \`/${command.data.name}\` again.`)],
            ephemeral: true,
          });
          return;
        }
      }

      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownMs);
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
