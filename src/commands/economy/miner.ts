import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { addXp } from '../../services/userService.js';

const COOLDOWN = 3600;

type Find = { name: string; reward: number; chance: number; emoji: string; minTool: number };

const FINDS: Find[] = [
  { name: 'Stone chunks', reward: 200, chance: 0.30, emoji: '🪨', minTool: 1 },
  { name: 'Fire Stone shard', reward: 500, chance: 0.20, emoji: '🔥', minTool: 1 },
  { name: 'Water Stone shard', reward: 500, chance: 0.18, emoji: '💧', minTool: 1 },
  { name: 'Rare gem', reward: 900, chance: 0.12, emoji: '💎', minTool: 2 },
  { name: 'Thunder Stone', reward: 1500, chance: 0.09, emoji: '⚡', minTool: 2 },
  { name: 'Old Amber fossil', reward: 2500, chance: 0.06, emoji: '🦕', minTool: 3 },
  { name: 'Dome Fossil', reward: 3500, chance: 0.03, emoji: '🐢', minTool: 3 },
  { name: 'Moon Stone vein', reward: 5000, chance: 0.02, emoji: '🌙', minTool: 4 },
];

function getToolTier(level: number): { name: string; tier: number; xpMult: number; rewardMult: number } {
  if (level >= 15) return { name: 'Excavation Gear', tier: 4, xpMult: 1.6, rewardMult: 2.2 };
  if (level >= 10) return { name: 'Drill', tier: 3, xpMult: 1.3, rewardMult: 1.6 };
  if (level >= 5) return { name: 'Steel Pickaxe', tier: 2, xpMult: 1.15, rewardMult: 1.3 };
  return { name: 'Pickaxe', tier: 1, xpMult: 1.0, rewardMult: 1.0 };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('miner')
    .setDescription('Mine for evolution stones, fossils, and gems — better tools unlock deeper finds'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'career:miner', COOLDOWN);
    if (onCooldown) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Mining Cooldown')
          .setDescription(`Your tools need sharpening — back in **${formatDuration(remaining!)}**.`)],
        ephemeral: true,
      });
      return;
    }

    const jobRecord = await client.prisma.userJob.findUnique({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Miner' } },
    });
    const jobLevel = jobRecord?.level ?? 1;
    const tool = getToolTier(jobLevel);

    const available = FINDS.filter((f) => f.minTool <= tool.tier);

    let roll = Math.random();
    let found = available[0];
    for (const f of available) { roll -= f.chance; if (roll <= 0) { found = f; break; } }

    const reward = Math.floor(found.reward * tool.rewardMult);
    const xpGain = Math.floor(Math.max(25, reward / 30) * tool.xpMult);

    await setCooldown(client, interaction.user.id, 'career:miner', COOLDOWN);
    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { increment: reward }, totalEarned: { increment: reward } },
    });

    const newRecord = await client.prisma.userJob.upsert({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Miner' } },
      update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } },
      create: { userId: interaction.user.id, jobName: 'Miner', lastWorked: new Date(), totalEarned: reward, timesWorked: 1 },
    });

    let jobLeveledUp = false;
    if ((newRecord.timesWorked + 1) % 10 === 0) {
      await client.prisma.userJob.update({
        where: { userId_jobName: { userId: interaction.user.id, jobName: 'Miner' } },
        data: { level: { increment: 1 } },
      });
      jobLeveledUp = true;
    }

    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder()
      .setColor(0x8b4513)
      .setTitle('⛏️ Mining Haul!')
      .setDescription(`${found.emoji} **${found.name}** — sold for **${formatNumber(reward)} PokéCoins**!`)
      .addFields(
        { name: '⛏️ Tool', value: tool.name, inline: true },
        { name: '💼 Miner Level', value: `${jobLevel}${jobLeveledUp ? ' → **Level Up!**' : ''}`, inline: true },
        { name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true },
        { name: '⏰ Next Dig', value: formatDuration(COOLDOWN), inline: true },
      )
      .setFooter({ text: 'Use /buy pickaxe or /buy drill to upgrade your tools' })
      .setTimestamp();

    if (leveledUp) embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Level ${newLevel}**!`, inline: false });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
