import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { addXp } from '../../services/userService.js';

const COOLDOWN = 3600;

type Outcome = { name: string; reward: number; chance: number; emoji: string };

const OUTCOMES: Outcome[] = [
  { name: 'Common Egg hatched', reward: 300, chance: 0.30, emoji: '🥚' },
  { name: 'Nature Mint found', reward: 500, chance: 0.22, emoji: '🌿' },
  { name: 'IV Boost item', reward: 800, chance: 0.18, emoji: '💊' },
  { name: 'Rare Egg hatched', reward: 1500, chance: 0.12, emoji: '🥚✨' },
  { name: 'Shiny Egg possibility', reward: 2500, chance: 0.08, emoji: '✨🥚' },
  { name: 'Perfect IV Pokémon', reward: 4000, chance: 0.06, emoji: '💎' },
  { name: 'Nursery Pass', reward: 5500, chance: 0.03, emoji: '🎫' },
  { name: 'Legendary Egg sighting', reward: 8000, chance: 0.01, emoji: '👑🥚' },
];

function getEquipmentTier(level: number): { name: string; xpMult: number; rewardMult: number } {
  if (level >= 15) return { name: 'Breeding Kit', xpMult: 1.6, rewardMult: 2.0 };
  if (level >= 10) return { name: 'Nursery Pass', xpMult: 1.3, rewardMult: 1.5 };
  if (level >= 5) return { name: 'Incubator+', xpMult: 1.15, rewardMult: 1.25 };
  return { name: 'Incubator', xpMult: 1.0, rewardMult: 1.0 };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('breeder')
    .setDescription('Work at the Pokémon Day Care — hatch eggs, find nature items, and discover IV bonuses'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'career:breeder', COOLDOWN);
    if (onCooldown) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Breeder Cooldown')
          .setDescription(`Eggs need more time — check back in **${formatDuration(remaining!)}**.`)],
        ephemeral: true,
      });
      return;
    }

    const jobRecord = await client.prisma.userJob.findUnique({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Breeder' } },
    });
    const jobLevel = jobRecord?.level ?? 1;
    const equipment = getEquipmentTier(jobLevel);

    let roll = Math.random();
    let outcome = OUTCOMES[0];
    for (const o of OUTCOMES) { roll -= o.chance; if (roll <= 0) { outcome = o; break; } }

    const reward = Math.floor(outcome.reward * equipment.rewardMult);
    const xpGain = Math.floor(Math.max(25, reward / 30) * equipment.xpMult);

    await setCooldown(client, interaction.user.id, 'career:breeder', COOLDOWN);
    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { increment: reward }, totalEarned: { increment: reward } },
    });

    const newRecord = await client.prisma.userJob.upsert({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Breeder' } },
      update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } },
      create: { userId: interaction.user.id, jobName: 'Breeder', lastWorked: new Date(), totalEarned: reward, timesWorked: 1 },
    });

    let jobLeveledUp = false;
    if ((newRecord.timesWorked + 1) % 10 === 0) {
      await client.prisma.userJob.update({
        where: { userId_jobName: { userId: interaction.user.id, jobName: 'Breeder' } },
        data: { level: { increment: 1 } },
      });
      jobLeveledUp = true;
    }

    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setTitle('🥚 Day Care Report!')
      .setDescription(`${outcome.emoji} **${outcome.name}** — earned **${formatNumber(reward)} PokéCoins**!`)
      .addFields(
        { name: '🛠️ Equipment', value: equipment.name, inline: true },
        { name: '💼 Breeder Level', value: `${jobLevel}${jobLeveledUp ? ' → **Level Up!**' : ''}`, inline: true },
        { name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true },
        { name: '⏰ Next Shift', value: formatDuration(COOLDOWN), inline: true },
      )
      .setFooter({ text: 'Use /buy incubator or /buy nursery-pass to upgrade' })
      .setTimestamp();

    if (leveledUp) embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Level ${newLevel}**!`, inline: false });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
