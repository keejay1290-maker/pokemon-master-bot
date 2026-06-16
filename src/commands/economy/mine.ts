import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { CooldownService } from '../../services/CooldownService.js';
import { addXp } from '../../services/userService.js';

const MINER_TABLE = [
  { name: 'Stone chunks', reward: 200, chance: 0.30, emoji: '🪨' },
  { name: 'Fire Stone shard', reward: 500, chance: 0.20, emoji: '🔥' },
  { name: 'Water Stone shard', reward: 500, chance: 0.18, emoji: '💧' },
  { name: 'Rare gem', reward: 900, chance: 0.12, emoji: '💎' },
  { name: 'Thunder Stone', reward: 1500, chance: 0.09, emoji: '⚡' },
  { name: 'Old Amber fossil', reward: 2500, chance: 0.06, emoji: '🦕' },
  { name: 'Moon Stone vein', reward: 5000, chance: 0.03, emoji: '🌙' },
  { name: 'Mega Stone discovered!', reward: 10000, chance: 0.02, emoji: '🌌' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('mine')
    .setDescription('⛏️ Mine for evolution stones, fossils, and gems! Earn £GBP'),

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
    await cooldownService.setCareer(interaction.user.id, 3600);

    const jobRecord = await client.prisma.userJob.findUnique({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Miner' } },
    });
    const jobLevel = jobRecord?.level ?? 1;

    let roll = Math.random();
    let result = MINER_TABLE[0];
    for (const entry of MINER_TABLE) { roll -= entry.chance; if (roll <= 0) { result = entry; break; } }

    const levelScaling = 1.0 + (jobLevel - 1) * 0.05;
    const reward = Math.floor(result.reward * levelScaling);
    const xpGain = Math.floor(Math.max(20, reward / 30));

    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { increment: reward }, totalEarned: { increment: reward } },
    });

    await client.prisma.userJob.upsert({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Miner' } },
      update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } },
      create: { userId: interaction.user.id, jobName: 'Miner', lastWorked: new Date(), totalEarned: reward, timesWorked: 1 },
    });

    let leveledUp = false;
    const updatedJob = await client.prisma.userJob.findUnique({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Miner' } },
    });
    if (updatedJob && updatedJob.timesWorked % 10 === 0) {
      await client.prisma.userJob.update({ where: { userId_jobName: { userId: interaction.user.id, jobName: 'Miner' } }, data: { level: { increment: 1 } } });
      leveledUp = true;
    }

    const { leveledUp: trainerLeveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder()
      .setColor(0x795548)
      .setTitle(`⛏️ Miner — ${result.emoji} ${result.name}`)
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