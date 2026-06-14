import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { addXp } from '../../services/userService.js';

const COOLDOWN = 3600;

type Encounter = { name: string; reward: number; chance: number; emoji: string };

const ENCOUNTERS: Encounter[] = [
  { name: 'Rattata nest cleared', reward: 250, chance: 0.28, emoji: '🐭' },
  { name: 'Lost trainer found', reward: 400, chance: 0.22, emoji: '🧭' },
  { name: 'Rare Pokémon tracked', reward: 700, chance: 0.18, emoji: '🦶' },
  { name: 'Poacher stopped', reward: 1200, chance: 0.12, emoji: '🚫' },
  { name: 'Safari Zone patrol', reward: 1800, chance: 0.09, emoji: '🌿' },
  { name: 'Legendary sighting', reward: 3000, chance: 0.06, emoji: '⚡' },
  { name: 'Safari ticket earned', reward: 4500, chance: 0.03, emoji: '🎟️' },
  { name: 'Rare encounter report', reward: 6000, chance: 0.02, emoji: '📋' },
];

function getGearTier(level: number): { name: string; xpMult: number; rewardMult: number; rarePct: number } {
  if (level >= 15) return { name: 'Ranger Gear', xpMult: 1.5, rewardMult: 2.0, rarePct: 0.20 };
  if (level >= 10) return { name: 'Field Scanner', xpMult: 1.3, rewardMult: 1.5, rarePct: 0.12 };
  if (level >= 5) return { name: 'Tracking Kit', xpMult: 1.15, rewardMult: 1.25, rarePct: 0.08 };
  return { name: 'Net', xpMult: 1.0, rewardMult: 1.0, rarePct: 0.05 };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ranger')
    .setDescription('Patrol the wild as a Pokémon Ranger — better gear unlocks rare encounters and safari tickets'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'career:ranger', COOLDOWN);
    if (onCooldown) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Ranger Cooldown')
          .setDescription(`Return to patrol in **${formatDuration(remaining!)}**.`)],
        ephemeral: true,
      });
      return;
    }

    const jobRecord = await client.prisma.userJob.findUnique({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Ranger' } },
    });
    const jobLevel = jobRecord?.level ?? 1;
    const gear = getGearTier(jobLevel);

    // Rare encounter bonus
    const isRare = Math.random() < gear.rarePct;
    const pool = isRare ? ENCOUNTERS.slice(4) : ENCOUNTERS.slice(0, 5);

    let roll = Math.random();
    let enc = pool[0];
    for (const e of pool) { roll -= e.chance; if (roll <= 0) { enc = e; break; } }

    const reward = Math.floor(enc.reward * gear.rewardMult);
    const xpGain = Math.floor(Math.max(25, reward / 30) * gear.xpMult);

    await setCooldown(client, interaction.user.id, 'career:ranger', COOLDOWN);
    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { increment: reward }, totalEarned: { increment: reward } },
    });

    const newRecord = await client.prisma.userJob.upsert({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Ranger' } },
      update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } },
      create: { userId: interaction.user.id, jobName: 'Ranger', lastWorked: new Date(), totalEarned: reward, timesWorked: 1 },
    });

    let jobLeveledUp = false;
    if ((newRecord.timesWorked + 1) % 10 === 0) {
      await client.prisma.userJob.update({
        where: { userId_jobName: { userId: interaction.user.id, jobName: 'Ranger' } },
        data: { level: { increment: 1 } },
      });
      jobLeveledUp = true;
    }

    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`🌿 Ranger Report${isRare ? ' — Rare Encounter!' : ''}`)
      .setDescription(`${enc.emoji} **${enc.name}** — earned **${formatNumber(reward)} PokéCoins**!`)
      .addFields(
        { name: '🎽 Gear', value: gear.name, inline: true },
        { name: '💼 Ranger Level', value: `${jobLevel}${jobLeveledUp ? ' → **Level Up!**' : ''}`, inline: true },
        { name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true },
        { name: '⏰ Next Patrol', value: formatDuration(COOLDOWN), inline: true },
      )
      .setFooter({ text: 'Use /buy <gear name> to upgrade your ranger equipment' })
      .setTimestamp();

    if (leveledUp) embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Level ${newLevel}**!`, inline: false });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
