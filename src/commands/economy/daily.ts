import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';
import { checkAndAwardAchievements } from '../../services/achievementService.js';
import { addXp } from '../../services/userService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily PokeCoin reward'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
    if (!user) { await interaction.reply({ content: 'User not found!', ephemeral: true }); return; }

    const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } });
    const baseReward = guild?.dailyReward ?? 500;

    if (user.lastDaily) {
      const diff = Date.now() - user.lastDaily.getTime();
      if (diff < 86400000) {
        const remaining = 86400000 - diff;
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        await interaction.reply({
          embeds: [
            new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Cooldown')
              .setDescription(`You already claimed your daily! Come back in **${h}h ${m}m**.`),
          ],
          ephemeral: true,
        });
        return;
      }
    }

    // Streak calculation
    let streak = user.dailyStreak;
    if (user.lastDaily) {
      const diff = Date.now() - user.lastDaily.getTime();
      if (diff < 172800000) streak += 1; // within 48h
      else streak = 1;
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
        { name: '💰 Base Reward', value: `${formatNumber(baseReward)} PokéCoins`, inline: true },
        { name: '🔥 Streak Bonus', value: `+${formatNumber(streakBonus)} PokéCoins`, inline: true },
        { name: '💎 Total', value: `**${formatNumber(total)} PokéCoins**`, inline: true },
        { name: '📅 Streak', value: `${streak} day${streak !== 1 ? 's' : ''}`, inline: true },
      )
      .setTimestamp();

    if (streak >= 7) embed.setDescription(`🔥 **${streak} day streak!** Keep it up!`);

    const xpGain = 50 + Math.min(streak * 5, 100);
    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);
    if (leveledUp) embed.addFields({ name: '🎉 Level Up!', value: `You reached **Level ${newLevel}**!`, inline: true });
    embed.addFields({ name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true });

    await interaction.reply({ embeds: [embed] });
    await checkAndAwardAchievements(client, interaction.user.id, interaction.channelId, interaction.guild?.id);
  },
};

export default command;
