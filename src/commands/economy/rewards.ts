import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';
import { checkAndAwardAchievements } from '../../services/achievementService.js';
import { ensureUser, addXp } from '../../services/userService.js';
import { incrementQuestProgress } from '../../services/questService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rewards')
    .setDescription('Claim your daily, weekly, and monthly rewards')
    .addSubcommand((sub) =>
      sub.setName('daily')
        .setDescription('Claim your daily PokéCoin reward')
    )
    .addSubcommand((sub) =>
      sub.setName('weekly')
        .setDescription('Claim your weekly PokéCoin reward')
    )
    .addSubcommand((sub) =>
      sub.setName('monthly')
        .setDescription('Claim your monthly PokéCoin reward')
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'daily') await handleDaily(interaction, client);
    else if (sub === 'weekly') await handleWeekly(interaction, client);
    else if (sub === 'monthly') await handleMonthly(interaction, client);
  },
};

// ── Daily ──────────────────────────────────────────────────────────────────────

async function handleDaily(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();

  try {
    await ensureUser(client.prisma, interaction.user);

    const [user, guild] = await Promise.all([
      client.prisma.user.findUnique({ where: { id: interaction.user.id } }),
      client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } }),
    ]);

    if (!user) {
      await interaction.editReply({ content: 'Something went wrong. Please try again.' });
      return;
    }

    const baseReward = guild?.dailyReward ?? 500;

    if (user.lastDaily) {
      const diff = Date.now() - user.lastDaily.getTime();
      if (diff < 86400000) {
        const remaining = 86400000 - diff;
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Cooldown')
              .setDescription(`You already claimed your daily! Come back in **${h}h ${m}m**.`),
          ],
        });
        return;
      }
    }

    // Streak calculation
    let streak = user.dailyStreak;
    if (user.lastDaily) {
      const diff = Date.now() - user.lastDaily.getTime();
      streak = diff < 172800000 ? streak + 1 : 1;
    } else {
      streak = 1;
    }

    const streakBonus = Math.min(streak * 50, 1000);
    const total = baseReward + streakBonus;

    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: {
        balance: { increment: total },
        totalEarned: { increment: total },
        dailyStreak: streak,
        lastDaily: new Date(),
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Daily Reward Claimed!')
      .addFields(
        { name: '💰 Base Reward',  value: `${formatNumber(baseReward)} PokéCoins`, inline: true },
        { name: '🔥 Streak Bonus', value: `+${formatNumber(streakBonus)} PokéCoins`, inline: true },
        { name: '💎 Total',        value: `**${formatNumber(total)} PokéCoins**`, inline: true },
        { name: '📅 Streak',       value: `${streak} day${streak !== 1 ? 's' : ''}`, inline: true },
      )
      .setTimestamp();

    if (streak >= 7) embed.setDescription(`🔥 **${streak} day streak!** Keep it up!`);

    const xpGain = 50 + Math.min(streak * 5, 100);
    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);
    if (leveledUp) embed.addFields({ name: '🎉 Level Up!', value: `You reached **Level ${newLevel}**!`, inline: true });
    embed.addFields({ name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true });

    await interaction.editReply({ embeds: [embed] });
    checkAndAwardAchievements(client, interaction.user.id, interaction.channelId, interaction.guild?.id).catch(() => {});
    incrementQuestProgress(client.prisma, interaction.user.id, 'earn_coins', total).catch(() => {});
  } catch (err) {
    console.error('[rewards daily]', err);
    await interaction.editReply({ content: '❌ An error occurred. Please try again.' }).catch(() => {});
  }
}

// ── Weekly ─────────────────────────────────────────────────────────────────────

const WEEKLY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

async function handleWeekly(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();

  try {
    await ensureUser(client.prisma, interaction.user);

    const [user, guild] = await Promise.all([
      client.prisma.user.findUnique({ where: { id: interaction.user.id } }),
      client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } }),
    ]);

    if (!user) { await interaction.editReply({ content: 'Something went wrong. Please try again.' }); return; }

    const base = guild?.weeklyReward ?? 2500;

    if (user.lastWeekly) {
      const diff = Date.now() - user.lastWeekly.getTime();
      if (diff < WEEKLY_COOLDOWN_MS) {
        const remaining = WEEKLY_COOLDOWN_MS - diff;
        const d = Math.floor(remaining / 86400000);
        const h = Math.floor((remaining % 86400000) / 3600000);
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('⏰ Weekly Cooldown')
            .setDescription(`Come back in **${d}d ${h}h**.`)],
        });
        return;
      }
    }

    let streak = user.weeklyStreak;
    if (user.lastWeekly && Date.now() - user.lastWeekly.getTime() < WEEKLY_COOLDOWN_MS * 2) streak++;
    else streak = 1;

    const bonus = Math.min(streak * 200, 5000);
    const total = base + bonus;

    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { increment: total }, totalEarned: { increment: total }, weeklyStreak: streak, lastWeekly: new Date() },
    });

    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, 100);

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('📅 Weekly Reward Claimed!')
      .addFields(
        { name: '💰 Base Reward',   value: `${formatNumber(base)} PokéCoins`,   inline: true },
        { name: '🔥 Streak Bonus',  value: `+${formatNumber(bonus)} PokéCoins`, inline: true },
        { name: '💎 Total',         value: `**${formatNumber(total)} PokéCoins**`, inline: true },
        { name: '📅 Weekly Streak', value: `${streak} week${streak !== 1 ? 's' : ''}`, inline: true },
        { name: '⭐ Trainer XP',    value: '+100 XP', inline: true },
      )
      .setTimestamp();

    if (leveledUp) embed.addFields({ name: '🎉 Level Up!', value: `You reached **Level ${newLevel}**!`, inline: true });
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[rewards weekly]', err);
    await interaction.editReply({ content: '❌ An error occurred. Please try again.' }).catch(() => {});
  }
}

// ── Monthly ────────────────────────────────────────────────────────────────────

const MONTHLY_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

async function handleMonthly(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();

  try {
    await ensureUser(client.prisma, interaction.user);

    const [user, guild] = await Promise.all([
      client.prisma.user.findUnique({ where: { id: interaction.user.id } }),
      client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } }),
    ]);

    if (!user) { await interaction.editReply({ content: 'Something went wrong. Please try again.' }); return; }

    const base = guild?.monthlyReward ?? 10000;

    if (user.lastMonthly) {
      const diff = Date.now() - user.lastMonthly.getTime();
      if (diff < MONTHLY_COOLDOWN_MS) {
        const remaining = MONTHLY_COOLDOWN_MS - diff;
        const d = Math.floor(remaining / 86400000);
        const h = Math.floor((remaining % 86400000) / 3600000);
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('⏰ Monthly Cooldown')
            .setDescription(`Come back in **${d}d ${h}h**.`)],
        });
        return;
      }
    }

    let streak = user.monthlyStreak;
    if (user.lastMonthly && Date.now() - user.lastMonthly.getTime() < MONTHLY_COOLDOWN_MS * 2) streak++;
    else streak = 1;

    const bonus = Math.min(streak * 1000, 10000);
    const total = base + bonus;

    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { increment: total }, totalEarned: { increment: total }, monthlyStreak: streak, lastMonthly: new Date() },
    });

    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, 200);

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🗓️ Monthly Reward Claimed!')
      .addFields(
        { name: '💰 Base Reward',    value: `${formatNumber(base)} PokéCoins`,   inline: true },
        { name: '🔥 Streak Bonus',   value: `+${formatNumber(bonus)} PokéCoins`, inline: true },
        { name: '💎 Total',          value: `**${formatNumber(total)} PokéCoins**`, inline: true },
        { name: '📅 Monthly Streak', value: `${streak} month${streak !== 1 ? 's' : ''}`, inline: true },
        { name: '⭐ Trainer XP',     value: '+200 XP', inline: true },
      )
      .setTimestamp();

    if (leveledUp) embed.addFields({ name: '🎉 Level Up!', value: `You reached **Level ${newLevel}**!`, inline: true });
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[rewards monthly]', err);
    await interaction.editReply({ content: '❌ An error occurred. Please try again.' }).catch(() => {});
  }
}

export default command;
