import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { addXp } from '../../services/userService.js';

const COOLDOWN = 3600; // 1 hour

type Catch = { name: string; reward: number; chance: number; emoji: string; minLevel: number };

const CATCHES: Catch[] = [
  { name: 'Magikarp', reward: 150, chance: 0.30, emoji: '🐟', minLevel: 1 },
  { name: 'Goldeen', reward: 200, chance: 0.20, emoji: '🐠', minLevel: 1 },
  { name: 'Tentacool', reward: 250, chance: 0.18, emoji: '🪼', minLevel: 1 },
  { name: 'Horsea', reward: 400, chance: 0.12, emoji: '🐴', minLevel: 2 },
  { name: 'Psyduck', reward: 600, chance: 0.09, emoji: '🦆', minLevel: 2 },
  { name: 'Gyarados', reward: 1500, chance: 0.05, emoji: '🐉', minLevel: 3 },
  { name: 'Lapras', reward: 2500, chance: 0.03, emoji: '🦕', minLevel: 4 },
  { name: 'Feebas', reward: 3500, chance: 0.02, emoji: '🐡', minLevel: 4 },
  { name: 'Dratini', reward: 5000, chance: 0.01, emoji: '🐲', minLevel: 5 },
];

// Equipment tiers by job level
function getEquipmentTier(level: number): { name: string; xpBonus: number; rewardMult: number } {
  if (level >= 15) return { name: 'Master Rod', xpBonus: 1.5, rewardMult: 2.0 };
  if (level >= 10) return { name: 'Super Rod', xpBonus: 1.3, rewardMult: 1.5 };
  if (level >= 5) return { name: 'Good Rod', xpBonus: 1.1, rewardMult: 1.2 };
  return { name: 'Old Rod', xpBonus: 1.0, rewardMult: 1.0 };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('fisher')
    .setDescription('Go fishing as a career — better rods unlock rarer catches and higher rewards'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'career:fisher', COOLDOWN);
    if (onCooldown) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Fisher Cooldown')
          .setDescription(`Cast your line again in **${formatDuration(remaining!)}**.`)],
        ephemeral: true,
      });
      return;
    }

    const jobRecord = await client.prisma.userJob.findUnique({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Fisher' } },
    });
    const jobLevel = jobRecord?.level ?? 1;
    const equipment = getEquipmentTier(jobLevel);

    // Filter available catches by job level
    const available = CATCHES.filter((c) => c.minLevel <= Math.ceil(jobLevel / 3));
    const pool = available.length > 0 ? available : CATCHES.slice(0, 3);

    const isFail = Math.random() < 0.08;
    if (isFail) {
      await setCooldown(client, interaction.user.id, 'career:fisher', COOLDOWN);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff8c00).setTitle('🎣 No Bite!')
          .setDescription('You cast your line but nothing bit. Better luck next time!')
          .addFields({ name: '🎣 Equipment', value: equipment.name, inline: true })],
      });
      return;
    }

    let roll = Math.random();
    let caught = pool[0];
    for (const c of pool) { roll -= c.chance; if (roll <= 0) { caught = c; break; } }

    const reward = Math.floor(caught.reward * equipment.rewardMult);
    const xpGain = Math.floor(Math.max(20, reward / 30) * equipment.xpBonus);

    await setCooldown(client, interaction.user.id, 'career:fisher', COOLDOWN);
    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { increment: reward }, totalEarned: { increment: reward } },
    });

    const newRecord = await client.prisma.userJob.upsert({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Fisher' } },
      update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } },
      create: { userId: interaction.user.id, jobName: 'Fisher', lastWorked: new Date(), totalEarned: reward, timesWorked: 1 },
    });

    let jobLeveledUp = false;
    if ((newRecord.timesWorked + 1) % 10 === 0) {
      await client.prisma.userJob.update({
        where: { userId_jobName: { userId: interaction.user.id, jobName: 'Fisher' } },
        data: { level: { increment: 1 } },
      });
      jobLeveledUp = true;
    }

    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🎣 Caught a ${caught.name}!`)
      .setDescription(`${caught.emoji} Sold for **${formatNumber(reward)} PokéCoins**`)
      .addFields(
        { name: '🎣 Equipment', value: equipment.name, inline: true },
        { name: '💼 Fisher Level', value: `${jobLevel}${jobLeveledUp ? ' → **Level Up!**' : ''}`, inline: true },
        { name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true },
        { name: '⏰ Next Cast', value: formatDuration(COOLDOWN), inline: true },
      )
      .setFooter({ text: 'Use /buy <rod name> to upgrade your equipment' })
      .setTimestamp();

    if (leveledUp) embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Level ${newLevel}**!`, inline: false });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
