import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { CooldownService } from '../../services/CooldownService.js';
import { addXp } from '../../services/userService.js';

const ROCKET_TABLE = [
  { name: 'Petty theft', reward: 300, chance: 0.25, emoji: '💰' },
  { name: 'Smuggling run', reward: 600, chance: 0.20, emoji: '📦' },
  { name: 'Heist attempt', reward: 1200, chance: 0.18, emoji: '🏦' },
  { name: 'Black market deal', reward: 2000, chance: 0.14, emoji: '🕶️' },
  { name: 'Big score', reward: 3500, chance: 0.10, emoji: '💵' },
  { name: 'Corporate espionage', reward: 6000, chance: 0.07, emoji: '🕵️' },
  { name: 'Silph Co. infiltration', reward: 10000, chance: 0.04, emoji: '⚡' },
  { name: 'Legendary theft!', reward: 15000, chance: 0.02, emoji: '🌑' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rocket')
    .setDescription('🚀 High-risk, high-reward criminal operations! Earn £GBP'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const cooldownService = new CooldownService(client);
    const { onCooldown, remaining } = await cooldownService.checkCareer(interaction.user.id);
    if (onCooldown) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Career Cooldown').setDescription(`All careers are on cooldown. Come back in **${CooldownService.formatDuration(remaining!)}**.`)], ephemeral: true });
      return;
    }

    await interaction.deferReply();
    await cooldownService.setCareer(interaction.user.id, 3600);

    const jobRecord = await client.prisma.userJob.findUnique({ where: { userId_jobName: { userId: interaction.user.id, jobName: 'Rocket' } } });
    const jobLevel = jobRecord?.level ?? 1;

    let roll = Math.random();
    let result = ROCKET_TABLE[0];
    for (const entry of ROCKET_TABLE) { roll -= entry.chance; if (roll <= 0) { result = entry; break; } }

    const reward = Math.floor(result.reward * (1.0 + (jobLevel - 1) * 0.05));
    const xpGain = Math.floor(Math.max(20, reward / 30));

    await client.prisma.user.update({ where: { id: interaction.user.id }, data: { balance: { increment: reward }, totalEarned: { increment: reward } } });
    await client.prisma.userJob.upsert({ where: { userId_jobName: { userId: interaction.user.id, jobName: 'Rocket' } }, update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } }, create: { userId: interaction.user.id, jobName: 'Rocket', lastWorked: new Date(), totalEarned: reward, timesWorked: 1 } });

    let leveledUp = false;
    const updatedJob = await client.prisma.userJob.findUnique({ where: { userId_jobName: { userId: interaction.user.id, jobName: 'Rocket' } } });
    if (updatedJob && updatedJob.timesWorked % 10 === 0) { await client.prisma.userJob.update({ where: { userId_jobName: { userId: interaction.user.id, jobName: 'Rocket' } }, data: { level: { increment: 1 } } }); leveledUp = true; }

    const { leveledUp: trainerLeveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`🚀 Rocket — ${result.emoji} ${result.name}`)
      .setDescription(`**+£${(reward / 100).toFixed(2)}**`)
      .addFields(
        { name: '📊 Career Level', value: `${jobLevel}${leveledUp ? ' → **Level Up!** 🎉' : ''}`, inline: true },
        { name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true },
        { name: '⏰ Next Shift', value: CooldownService.formatDuration(3600), inline: true },
      );
    if (trainerLeveledUp) embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Trainer Level ${newLevel}**!`, inline: false });
    embed.setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;