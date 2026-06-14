import {
  Interaction,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
} from 'discord.js';
import type { BotClient } from '../types/index.js';
import { errorEmbed } from '../utils/embeds.js';
import { ensureUser } from '../services/userService.js';
import { ensureGuild } from '../services/guildService.js';
import {
  handlePackReveal,
  handlePackOpenAnother,
  handlePackViewCollection,
} from '../handlers/packRevealHandler.js';

export async function handleInteractionCreate(interaction: Interaction, client: BotClient) {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction, client);
  } else if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction, client);
  } else if (interaction.isButton()) {
    await handleButton(interaction, client);
  }
}

async function handleButton(interaction: ButtonInteraction, client: BotClient) {
  const id = interaction.customId;

  try {
    if (id.startsWith('pack_reveal:')) {
      const sessionId = id.slice('pack_reveal:'.length);
      await handlePackReveal(interaction, client, sessionId);
    } else if (id.startsWith('pack_open_another:')) {
      await handlePackOpenAnother(interaction, client);
    } else if (id.startsWith('pack_view_collection:')) {
      await handlePackViewCollection(interaction, client);
    }
    // Additional button routers added here as features grow
  } catch (err) {
    client.logger.error('Button handler error:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction, client: BotClient) {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    if (interaction.user) {
      await ensureUser(client.prisma, interaction.user);
    }
    if (interaction.guild) {
      await ensureGuild(client.prisma, interaction.guild);
    }

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
