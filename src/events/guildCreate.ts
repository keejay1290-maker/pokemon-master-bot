import { Guild, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { BotClient } from '../types/index.js';
import { ensureGuild } from '../services/guildService.js';

export async function handleGuildCreate(guild: Guild, client: BotClient) {
  client.logger.info(`Joined guild: ${guild.name} (${guild.id})`);

  await ensureGuild(client.prisma, guild);

  const owner = await guild.fetchOwner().catch(() => null);
  if (!owner) return;

  const embed = new EmbedBuilder()
    .setColor(0xffcb05)
    .setTitle('⚡ Welcome to Pokemon Master!')
    .setDescription(
      `Thanks for adding **Pokemon Master** to **${guild.name}**!\n\n` +
      `Would you like me to automatically configure your server with Pokemon-themed channels and roles?`
    )
    .addFields(
      {
        name: '🏗️ Full Setup',
        value: 'Creates all channels, roles, and configures everything automatically.',
        inline: false,
      },
      {
        name: '⚙️ Custom Setup',
        value: 'Choose which channels and roles to create.',
        inline: false,
      },
      {
        name: '✋ Manual Setup',
        value: 'Skip automatic setup. Use `/setup` anytime.',
        inline: false,
      }
    )
    .setFooter({ text: 'Use /setup anytime to reconfigure your server.' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup:full:${guild.id}`)
      .setLabel('Full Setup')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🏗️'),
    new ButtonBuilder()
      .setCustomId(`setup:custom:${guild.id}`)
      .setLabel('Custom Setup')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚙️'),
    new ButtonBuilder()
      .setCustomId(`setup:manual:${guild.id}`)
      .setLabel('Manual Setup')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✋')
  );

  await owner.send({ embeds: [embed], components: [row] }).catch(() => {
    client.logger.warn(`Could not DM owner of ${guild.name}`);
  });
}
