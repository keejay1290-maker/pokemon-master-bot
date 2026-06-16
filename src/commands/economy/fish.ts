import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { CooldownService } from '../../services/CooldownService.js';
import { addXp } from '../../services/userService.js';

const CAREER_NAME = 'Fisher';
const CAREER_EMOJI = '🎣';
const CAREER_COOLDOWN = 3600; // 1 hour shared cooldown

const FISH_TABLE = [
  { name: 'Magikarp', reward: 150, chance: 0.30, emoji: '🐟' },
  { name: 'Goldeen', reward: 200, chance: 0.20, emoji: '🐠' },
  { name: 'Tentacool', reward: 250, chance: 0.18, emoji: '🪼' },
  { name: 'Horsea', reward: 400, chance: 0.12, emoji: '🐴' },
  { name: 'Psyduck', reward: 600, chance: 0.09, emoji: '🦆' },
  { name: 'Gyarados', reward: 1500, chance: 0.05, emoji: '🐉' },
  { name: 'Lapras', reward: 2500, chance: 0.03, emoji: '🦕' },
  { name: 'Dratini', reward: 5000, chance: 0.01, emoji: '🐲' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription(`${CAREER_EMOJI} Cast your line and see what bites! Earn PokéCoins`),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const cooldownService = new CooldownService(client);

    const { onCooldown, remaining } = await cooldownService.checkCareer(interaction.user.id);
    if (onCooldown) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Career Cooldown')
          .setDescription(`All careers are on cooldown. Come back in **${CooldownService.formatDuration(remaining!)}**.`)],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    await cooldownService.setCareer(interaction.user.id, CAREER_COOLDOWN);

    const jobRecord = await client.prisma.userJob.findUnique({
      where: { userId_jobName: { userId: interaction.user.id, jobName: CAREER_NAME } },
    });
    const jobLevel = jobRecord?.level ?? 1;

    // Weighted roll
    let roll = Math.random();
    let result = FISH_TABLE[0];
    for (const entry of FISH_TABLE) {
      roll -= entry.chance;
      if (roll <= 0) { result = entry; break; }
    }

    const levelScaling = 1.0 + (jobLevel - 1) * 0.05;
    const reward = Math.floor(result.reward * levelScaling);
    const xpGain = Math.floor(Math.max(20, reward / 30));

    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { increment: reward }, totalEarned: { increment: reward } },
    });

    await client.prisma.userJob.upsert({
      where: { userId_jobName: { userId: interaction.user.id, jobName: CAREER_NAME } },
      update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } },
      create: { userId: interaction.user.id, jobName: CAREER_NAME, lastWorked: new Date(), totalEarned: reward, timesWorked: 1 },
    });

    let leveledUp = false;
    const updatedJob = await client.prisma.userJob.findUnique({
      where: { userId_jobName: { userId: interaction.user.id, jobName: CAREER_NAME } },
    });
    if (updatedJob && updatedJob.timesWorked % 10 === 0) {
      await client.prisma.userJob.update({
        where: { userId_jobName: { userId: interaction.user.id, jobName: CAREER_NAME } },
        data: { level: { increment: 1 } },
      });
      leveledUp = true;
    }

    const { leveledUp: trainerLeveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`${CAREER_EMOJI} ${CAREER_NAME} — ${result.emoji} ${result.name}`)
      .setDescription(`**+${reward.toLocaleString()} PokéCoins**`)
      .addFields(
        { name: '📊 Career Level', value: `${jobLevel}${leveledUp ? ' → **Level Up!** 🎉' : ''}`, inline: true },
        { name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true },
        { name: '⏰ Next Shift', value: CooldownService.formatDuration(CAREER_COOLDOWN), inline: true },
      );

    if (trainerLeveledUp) {
      embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Trainer Level ${newLevel}**!`, inline: false });
    }
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;