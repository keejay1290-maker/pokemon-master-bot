import type { ChatInputCommandInteraction } from 'discord.js';

export async function safeReply(interaction: ChatInputCommandInteraction, options: any) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.followUp(options).catch(() => {});
    }
    return await interaction.reply(options).catch(() => {});
  } catch {
    // swallow
    return null;
  }
}

export async function safeEditReply(interaction: ChatInputCommandInteraction, options: any) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(options).catch(() => {});
    }
    // If not deferred/replied, use reply
    return await interaction.reply(options).catch(() => {});
  } catch {
    return null;
  }
}
