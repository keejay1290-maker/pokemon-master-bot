import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { getProfile, getLiveStatus, getSocials, getShopUrl } from '../../services/creatorService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('creator')
    .setDescription('View creator info, socials, and shop')
    .addSubcommand((s) => s.setName('info').setDescription('About the creator'))
    .addSubcommand((s) => s.setName('socials').setDescription('Social media links'))
    .addSubcommand((s) => s.setName('shop').setDescription('Visit the creator store'))
    .addSubcommand((s) => s.setName('live').setDescription('Check if creator is live')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'info') await handleInfo(interaction, client);
    else if (sub === 'socials') await handleSocials(interaction, client);
    else if (sub === 'shop') await handleShop(interaction, client);
    else if (sub === 'live') await handleLive(interaction, client);
  },
};

async function handleInfo(interaction: ChatInputCommandInteraction, client: BotClient) {
  const profile = getProfile();

  const embed = new EmbedBuilder()
    .setColor(parseInt(profile.accentColor.replace('#', ''), 16) || 0x8b0000)
    .setTitle(`👤 ${profile.displayName}`)
    .setDescription(profile.tagline)
    .addFields(
      { name: '🌐 Website', value: profile.website ?? 'N/A', inline: true },
      { name: '🏪 Shop', value: profile.shopUrl ?? 'N/A', inline: true },
      { name: '💬', value: profile.aiPersonality.greeting, inline: false },
    )
    .setTimestamp();

  if (profile.avatarUrl) embed.setThumbnail(profile.avatarUrl);
  if (profile.bannerUrl) embed.setImage(profile.bannerUrl);

  await interaction.reply({ embeds: [embed] });
}

async function handleSocials(interaction: ChatInputCommandInteraction, client: BotClient) {
  const socials = getSocials(client);
  const profile = getProfile();

  const lines: string[] = [];
  if (socials.website) lines.push(`🌐 **Website**: ${socials.website}`);
  if (socials.twitter) lines.push(`🐦 **Twitter**: ${socials.twitter}`);
  if (socials.instagram) lines.push(`📸 **Instagram**: ${socials.instagram}`);
  if (socials.twitch) lines.push(`🎮 **Twitch**: ${socials.twitch}`);
  if (socials.youtube) lines.push(`📺 **YouTube**: ${socials.youtube}`);
  if (socials.discord) lines.push(`💬 **Discord**: ${socials.discord}`);
  if (socials.tiktok) lines.push(`🎵 **TikTok**: ${socials.tiktok}`);

  const embed = new EmbedBuilder()
    .setColor(parseInt(profile.accentColor.replace('#', ''), 16) || 0x8b0000)
    .setTitle(`🔗 ${profile.displayName} — Social Links`)
    .setDescription(lines.length > 0 ? lines.join('\n') : 'No social links configured.')
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleShop(interaction: ChatInputCommandInteraction, client: BotClient) {
  const shopUrl = getShopUrl(client);
  const profile = getProfile();

  const embed = new EmbedBuilder()
    .setColor(parseInt(profile.accentColor.replace('#', ''), 16) || 0x8b0000)
    .setTitle(`🏪 ${profile.displayName} — Shop`)
    .setDescription(shopUrl
      ? `Visit the creator's store:\n${shopUrl}`
      : 'No shop URL configured.')
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleLive(interaction: ChatInputCommandInteraction, client: BotClient) {
  const profile = getProfile();
  const status = await getLiveStatus(client);

  const embed = new EmbedBuilder()
    .setColor(status.live ? 0xff4444 : 0x888888)
    .setTitle(status.live ? '🔴 Live Now!' : '⚫ Offline')
    .setDescription(status.live
      ? `${profile.displayName} is LIVE! ${status.title ?? ''}`
      : `${profile.displayName} is currently offline. Check back later!`)
    .setTimestamp();

  if (status.live) {
    embed.addFields(
      { name: '👁️ Viewers', value: `${status.viewers}`, inline: true },
      { name: '📺 Platform', value: status.platform ?? 'N/A', inline: true },
    );
  }

  await interaction.reply({ embeds: [embed] });
}

export default command;