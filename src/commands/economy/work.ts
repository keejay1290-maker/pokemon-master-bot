import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command, JobData } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { addXp } from '../../services/userService.js';

const JOBS: JobData[] = [
  {
    name: 'Pokemon Professor',
    description: 'Research Pokemon in the lab',
    minReward: 400, maxReward: 800,
    failureChance: 0.05, injuryChance: 0.02, rareEncounterChance: 0.1,
    cooldown: 3600,
    events: [
      { chance: 0.1, message: 'You discovered a rare fossil! Extra grant received.', rewardMultiplier: 1.5, type: 'bonus' },
      { chance: 0.05, message: 'Your experiment failed. Lab fees incurred.', rewardMultiplier: 0.5, type: 'penalty' },
      { chance: 0.1, message: 'A wild Pokemon wandered into the lab!', rewardMultiplier: 1.2, type: 'encounter' },
    ],
  },
  {
    name: 'Pokemon Ranger',
    description: 'Patrol the wild and protect Pokemon',
    minReward: 350, maxReward: 700,
    failureChance: 0.08, injuryChance: 0.05, rareEncounterChance: 0.15,
    cooldown: 3600,
    events: [
      { chance: 0.15, message: 'You rescued a rare Pokemon from poachers!', rewardMultiplier: 1.8, type: 'bonus' },
      { chance: 0.08, message: 'A wild Pokemon attacked you while on patrol.', rewardMultiplier: 0.7, type: 'penalty' },
      { chance: 0.15, message: 'You encountered a legendary Pokemon in the wild!', rewardMultiplier: 1.3, type: 'encounter' },
    ],
  },
  {
    name: 'Gym Assistant',
    description: 'Help at the local Pokemon Gym',
    minReward: 300, maxReward: 600,
    failureChance: 0.05, injuryChance: 0.01, rareEncounterChance: 0.08,
    cooldown: 3600,
    events: [
      { chance: 0.12, message: 'The Gym Leader gave you a bonus for your hard work!', rewardMultiplier: 1.4, type: 'bonus' },
      { chance: 0.05, message: 'A trainer\'s Pokemon got out of control.', rewardMultiplier: 0.8, type: 'penalty' },
    ],
  },
  {
    name: 'PokeMart Worker',
    description: 'Work at the local PokeMart',
    minReward: 250, maxReward: 500,
    failureChance: 0.03, injuryChance: 0.005, rareEncounterChance: 0.05,
    cooldown: 3600,
    events: [
      { chance: 0.1, message: 'Rush hour! Extra tips from customers.', rewardMultiplier: 1.3, type: 'bonus' },
    ],
  },
  {
    name: 'Safari Guide',
    description: 'Guide trainers through the Safari Zone',
    minReward: 450, maxReward: 900,
    failureChance: 0.1, injuryChance: 0.06, rareEncounterChance: 0.2,
    cooldown: 3600,
    events: [
      { chance: 0.2, message: 'Rare Pokemon spotted on the tour! Clients tipped generously.', rewardMultiplier: 2.0, type: 'bonus' },
      { chance: 0.1, message: 'A Tauros stampede scared away clients!', rewardMultiplier: 0.5, type: 'penalty' },
      { chance: 0.2, message: 'Legendary Pokemon sighted in the Safari!', rewardMultiplier: 1.5, type: 'encounter' },
    ],
  },
  {
    name: 'Breeder',
    description: 'Take care of Pokemon eggs at the Day Care',
    minReward: 350, maxReward: 700,
    failureChance: 0.04, injuryChance: 0.01, rareEncounterChance: 0.12,
    cooldown: 3600,
    events: [
      { chance: 0.12, message: 'A rare egg hatched today!', rewardMultiplier: 1.6, type: 'bonus' },
    ],
  },
  {
    name: 'Researcher',
    description: 'Conduct Pokemon research for the university',
    minReward: 500, maxReward: 1000,
    failureChance: 0.07, injuryChance: 0.01, rareEncounterChance: 0.08,
    cooldown: 3600,
    events: [
      { chance: 0.08, message: 'Your research paper got published! Bonus funding received.', rewardMultiplier: 2.0, type: 'bonus' },
      { chance: 0.07, message: 'Experiment data was corrupted. Lost time.', rewardMultiplier: 0.6, type: 'penalty' },
    ],
  },
  {
    name: 'Nurse Assistant',
    description: 'Help Nurse Joy at the Pokemon Center',
    minReward: 300, maxReward: 600,
    failureChance: 0.03, injuryChance: 0.005, rareEncounterChance: 0.06,
    cooldown: 3600,
    events: [
      { chance: 0.1, message: 'You helped heal a Champion\'s Pokemon. They rewarded you!', rewardMultiplier: 1.5, type: 'bonus' },
    ],
  },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work a job to earn PokéCoins')
    .addStringOption((opt) =>
      opt.setName('job')
        .setDescription('Choose your job')
        .setRequired(true)
        .addChoices(...JOBS.map((j) => ({ name: j.name, value: j.name })))
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const jobName = interaction.options.getString('job', true);
    const job = JOBS.find((j) => j.name === jobName)!;

    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, `work:${jobName}`, job.cooldown);
    if (onCooldown) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Tired!')
          .setDescription(`You're still recovering from your last shift. Come back in **${formatDuration(remaining!)}**.`)],
        ephemeral: true,
      });
      return;
    }

    const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } });
    const cooldown = guild?.workCooldown ?? job.cooldown;

    // Determine outcome
    const roll = Math.random();
    let reward = Math.floor(Math.random() * (job.maxReward - job.minReward) + job.minReward);
    let eventMessage = '';

    if (roll < job.failureChance) {
      reward = 0;
      eventMessage = '❌ Something went wrong and you earned nothing today.';
    } else {
      for (const event of job.events) {
        if (Math.random() < event.chance) {
          reward = Math.floor(reward * event.rewardMultiplier);
          eventMessage = event.message;
          break;
        }
      }
    }

    await setCooldown(client, interaction.user.id, `work:${jobName}`, cooldown);

    if (reward > 0) {
      await client.prisma.user.update({
        where: { id: interaction.user.id },
        data: { balance: { increment: reward }, totalEarned: { increment: reward } },
      });
    }

    const jobRecord = await client.prisma.userJob.upsert({
      where: { userId_jobName: { userId: interaction.user.id, jobName } },
      update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } },
      create: { userId: interaction.user.id, jobName, lastWorked: new Date(), totalEarned: reward, timesWorked: 1 },
    });

    // Level up every 10 uses
    let jobLeveledUp = false;
    const newTimesWorked = jobRecord.timesWorked + 1;
    if (newTimesWorked % 10 === 0) {
      await client.prisma.userJob.update({
        where: { userId_jobName: { userId: interaction.user.id, jobName } },
        data: { level: { increment: 1 } },
      });
      jobLeveledUp = true;
    }

    // Grant trainer XP
    const xpGain = Math.max(25, Math.floor(reward / 20));
    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder()
      .setColor(reward > 0 ? 0x00ff00 : 0xff4444)
      .setTitle(`💼 Work — ${jobName}`)
      .setDescription(job.description)
      .addFields(
        { name: 'Outcome', value: reward > 0 ? `💰 Earned **${formatNumber(reward)} PokéCoins**` : '❌ Earned nothing', inline: false },
        { name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true },
        { name: '💼 Job Level', value: `Level ${jobRecord.level}${jobLeveledUp ? ' → **Level Up!**' : ''} (${newTimesWorked} shifts)`, inline: true },
      );

    if (eventMessage) embed.addFields({ name: '📝 Event', value: eventMessage, inline: false });
    if (leveledUp) embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Trainer Level ${newLevel}**!`, inline: false });
    embed.addFields({ name: '⏰ Next Shift', value: formatDuration(cooldown), inline: true }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
