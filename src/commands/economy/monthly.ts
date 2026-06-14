import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';
import { addXp } from '../../services/userService.js';

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('monthly')
    .setDescription('Claim your monthly PokéCoin reward (30-day cooldown)'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
    if (!user) { await interaction.reply({ content: 'User not found!', ephemeral: true }); return; }

    const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } });
    const base = guild?.monthlyReward ?? 10000;

    if (user.lastMonthly) {
      const diff = Date.now() - user.lastMonthly.getTime();
      if (diff < COOLDOWN_MS) {
        const remaining = COOLDOWN_MS - diff;
        const d = Math.floor(remaining / 86400000);
        const h = Math.floor((remaining % 86400000) / 3600000);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('⏰ Monthly Cooldown')
            .setDescription(`Come back in **${d}d ${h}h**.`)],
          ephemeral: true,
        });
        return;
      }
    }

    // Streak: still within 60 days = maintain streak
    let streak = user.monthlyStreak;
    if (user.lastMonthly && Date.now() - user.lastMonthly.getTime() < COOLDOWN_MS * 2) streak++;
    else streak = 1;

    const bonus = Math.min(streak * 1000, 10000);
    const total = base + bonus;

    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: {
        balance: { increment: total },
        totalEarned: { increment: total },
        monthlyStreak: streak,
        lastMonthly: new Date(),
      },
    });

    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, 200);

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🗓️ Monthly Reward Claimed!')
      .addFields(
        { name: '💰 Base Reward', value: `${formatNumber(base)} PokéCoins`, inline: true },
        { name: '🔥 Streak Bonus', value: `+${formatNumber(bonus)} PokéCoins`, inline: true },
        { name: '💎 Total', value: `**${formatNumber(total)} PokéCoins**`, inline: true },
        { name: '📅 Monthly Streak', value: `${streak} month${streak !== 1 ? 's' : ''}`, inline: true },
        { name: '⭐ Trainer XP', value: `+200 XP`, inline: true },
      )
      .setTimestamp();

    if (leveledUp) embed.addFields({ name: '🎉 Level Up!', value: `You reached **Level ${newLevel}**!`, inline: true });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
