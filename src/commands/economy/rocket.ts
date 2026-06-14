import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { addXp, addBalance } from '../../services/userService.js';

const COOLDOWN = 7200; // 2-hour cooldown — riskier career
const FAILURE_CHANCE = 0.30; // 30% base fail rate

type Heist = { name: string; reward: number; fine: number; chance: number; emoji: string };

const HEISTS: Heist[] = [
  { name: 'Petty theft', reward: 500, fine: 200, chance: 0.35, emoji: '💰' },
  { name: 'Poké Ball stockpile raid', reward: 900, fine: 400, chance: 0.25, emoji: '🎾' },
  { name: 'TM smuggling run', reward: 1500, fine: 700, chance: 0.18, emoji: '💿' },
  { name: 'Silph Co. intel breach', reward: 2500, fine: 1200, chance: 0.10, emoji: '🏢' },
  { name: 'Legendary transport intercept', reward: 4000, fine: 2000, chance: 0.07, emoji: '⚡' },
  { name: 'Master Ball heist', reward: 7500, fine: 4000, chance: 0.04, emoji: '🟣' },
  { name: 'Rare artifact theft', reward: 12000, fine: 6000, chance: 0.01, emoji: '👑' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rocket')
    .setDescription('Join Team Rocket for high-risk, high-reward operations (30% fail chance — you may be fined)'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'career:rocket', COOLDOWN);
    if (onCooldown) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Laying Low')
          .setDescription(`Stay off the radar for another **${formatDuration(remaining!)}**.`)],
        ephemeral: true,
      });
      return;
    }

    const jobRecord = await client.prisma.userJob.findUnique({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Rocket' } },
    });
    const jobLevel = jobRecord?.level ?? 1;
    // Higher rank = lower failure chance (min 10%)
    const failChance = Math.max(0.10, FAILURE_CHANCE - jobLevel * 0.01);

    let roll = Math.random();
    let heist = HEISTS[0];
    for (const h of HEISTS) { roll -= h.chance; if (roll <= 0) { heist = h; break; } }

    const failed = Math.random() < failChance;

    await setCooldown(client, interaction.user.id, 'career:rocket', COOLDOWN);

    if (failed) {
      const fine = heist.fine;
      try {
        await addBalance(client.prisma, interaction.user.id, -fine);
      } catch {
        // user broke — zero out balance instead of going negative
        await client.prisma.user.update({ where: { id: interaction.user.id }, data: { balance: 0 } });
      }

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🚨 Operation Failed!')
          .setDescription(`You were caught during **${heist.name}** and fined **${formatNumber(fine)} PokéCoins**.`)
          .addFields(
            { name: '💀 Failure Chance', value: `${Math.round(failChance * 100)}%`, inline: true },
            { name: '💸 Fine', value: `${formatNumber(fine)} PokéCoins`, inline: true },
            { name: '⏰ Cooldown', value: formatDuration(COOLDOWN), inline: true },
          )
          .setFooter({ text: 'Higher Rocket rank = lower failure chance' })
          .setTimestamp()],
      });
      return;
    }

    const reward = Math.floor(heist.reward * (1 + jobLevel * 0.05));
    const xpGain = Math.max(30, Math.floor(reward / 25));

    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { increment: reward }, totalEarned: { increment: reward } },
    });

    const newRecord = await client.prisma.userJob.upsert({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Rocket' } },
      update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } },
      create: { userId: interaction.user.id, jobName: 'Rocket', lastWorked: new Date(), totalEarned: reward, timesWorked: 1 },
    });

    let jobLeveledUp = false;
    if ((newRecord.timesWorked + 1) % 10 === 0) {
      await client.prisma.userJob.update({
        where: { userId_jobName: { userId: interaction.user.id, jobName: 'Rocket' } },
        data: { level: { increment: 1 } },
      });
      jobLeveledUp = true;
    }

    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('🚀 Operation Success!')
      .setDescription(`${heist.emoji} **${heist.name}** — you made off with **${formatNumber(reward)} PokéCoins**! Prepare for trouble...`)
      .addFields(
        { name: '🚀 Rocket Rank', value: `${jobLevel}${jobLeveledUp ? ' → **Promoted!**' : ''}`, inline: true },
        { name: '💀 Fail Chance', value: `${Math.round(failChance * 100)}%`, inline: true },
        { name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true },
        { name: '⏰ Next Op', value: formatDuration(COOLDOWN), inline: true },
      )
      .setFooter({ text: 'Higher rank reduces failure chance. Prepare for trouble!' })
      .setTimestamp();

    if (leveledUp) embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Level ${newLevel}**!`, inline: false });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
