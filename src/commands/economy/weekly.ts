import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('weekly').setDescription('Claim your weekly PokéCoin reward'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
    if (!user) { await interaction.reply({ content: 'User not found!', ephemeral: true }); return; }

    const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } });
    const base = guild?.weeklyReward ?? 2500;

    if (user.lastWeekly) {
      const diff = Date.now() - user.lastWeekly.getTime();
      if (diff < 604800000) {
        const remaining = 604800000 - diff;
        const d = Math.floor(remaining / 86400000);
        const h = Math.floor((remaining % 86400000) / 3600000);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Weekly Cooldown').setDescription(`Come back in **${d}d ${h}h**.`)], ephemeral: true });
        return;
      }
    }

    let streak = user.weeklyStreak;
    if (user.lastWeekly && Date.now() - user.lastWeekly.getTime() < 1209600000) streak++;
    else streak = 1;

    const bonus = Math.min(streak * 200, 2000);
    const total = base + bonus;

    await client.prisma.user.update({ where: { id: interaction.user.id }, data: { balance: { increment: total }, totalEarned: { increment: total }, weeklyStreak: streak, lastWeekly: new Date() } });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Weekly Reward Claimed!').addFields({ name: '💰 Reward', value: `+${formatNumber(total)} PokéCoins`, inline: true }, { name: '🔥 Streak', value: `${streak} week${streak !== 1 ? 's' : ''}`, inline: true }).setTimestamp()] });
  },
};
export default command;
