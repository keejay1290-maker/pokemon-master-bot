import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { addXp } from '../../services/userService.js';

const COOLDOWN = 3600;

type Discovery = { name: string; reward: number; chance: number; emoji: string };

const DISCOVERIES: Discovery[] = [
  { name: 'Field Notes', reward: 300, chance: 0.30, emoji: '📓' },
  { name: 'Type Analysis', reward: 500, chance: 0.22, emoji: '🔬' },
  { name: 'Rare Candy', reward: 800, chance: 0.18, emoji: '🍬' },
  { name: 'Evolution Data', reward: 1200, chance: 0.12, emoji: '📊' },
  { name: 'Fossil Sample', reward: 1800, chance: 0.08, emoji: '🦴' },
  { name: 'Mythical Sighting', reward: 3000, chance: 0.05, emoji: '✨' },
  { name: 'TCG Pack (Research Edition)', reward: 4000, chance: 0.03, emoji: '🃏' },
  { name: 'Professor Grant', reward: 6000, chance: 0.02, emoji: '🏆' },
];

function getKitTier(level: number): { name: string; xpMult: number; rewardMult: number } {
  if (level >= 15) return { name: 'Professor Kit', xpMult: 1.6, rewardMult: 2.2 };
  if (level >= 10) return { name: 'Lab Kit', xpMult: 1.3, rewardMult: 1.6 };
  if (level >= 5) return { name: 'Pokédex Scanner', xpMult: 1.15, rewardMult: 1.3 };
  return { name: 'Notebook', xpMult: 1.0, rewardMult: 1.0 };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('researcher')
    .setDescription('Conduct Pokémon research — better kits unlock rarer discoveries and bigger grants'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'career:researcher', COOLDOWN);
    if (onCooldown) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Research Cooldown')
          .setDescription(`Your research timer resets in **${formatDuration(remaining!)}**.`)],
        ephemeral: true,
      });
      return;
    }

    const jobRecord = await client.prisma.userJob.findUnique({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Researcher' } },
    });
    const jobLevel = jobRecord?.level ?? 1;
    const kit = getKitTier(jobLevel);

    let roll = Math.random();
    let found = DISCOVERIES[0];
    for (const d of DISCOVERIES) { roll -= d.chance; if (roll <= 0) { found = d; break; } }

    const reward = Math.floor(found.reward * kit.rewardMult);
    const xpGain = Math.floor(Math.max(30, reward / 25) * kit.xpMult);

    await setCooldown(client, interaction.user.id, 'career:researcher', COOLDOWN);
    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { increment: reward }, totalEarned: { increment: reward } },
    });

    const newRecord = await client.prisma.userJob.upsert({
      where: { userId_jobName: { userId: interaction.user.id, jobName: 'Researcher' } },
      update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } },
      create: { userId: interaction.user.id, jobName: 'Researcher', lastWorked: new Date(), totalEarned: reward, timesWorked: 1 },
    });

    let jobLeveledUp = false;
    if ((newRecord.timesWorked + 1) % 10 === 0) {
      await client.prisma.userJob.update({
        where: { userId_jobName: { userId: interaction.user.id, jobName: 'Researcher' } },
        data: { level: { increment: 1 } },
      });
      jobLeveledUp = true;
    }

    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🔬 Research Discovery!`)
      .setDescription(`${found.emoji} You discovered **${found.name}** — worth **${formatNumber(reward)} PokéCoins**!`)
      .addFields(
        { name: '🔬 Equipment', value: kit.name, inline: true },
        { name: '💼 Researcher Level', value: `${jobLevel}${jobLeveledUp ? ' → **Level Up!**' : ''}`, inline: true },
        { name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true },
        { name: '⏰ Next Study', value: formatDuration(COOLDOWN), inline: true },
      )
      .setFooter({ text: 'Use /buy <kit name> to upgrade your research equipment' })
      .setTimestamp();

    if (leveledUp) embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Level ${newLevel}**!`, inline: false });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
