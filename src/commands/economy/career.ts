import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';

const CAREERS = [
  { name: 'Fisher',     emoji: '🎣', description: 'Fishing for rare catches',        cooldownKey: 'career:fisher' },
  { name: 'Researcher', emoji: '🔬', description: 'Pokémon research & academia',     cooldownKey: 'career:researcher' },
  { name: 'Ranger',     emoji: '🌲', description: 'Protecting wild Pokémon',         cooldownKey: 'career:ranger' },
  { name: 'Breeder',    emoji: '🥚', description: 'Caring for eggs & hatching',      cooldownKey: 'career:breeder' },
  { name: 'Miner',      emoji: '⛏️', description: 'Mining for fossils & stones',     cooldownKey: 'career:miner' },
  { name: 'Rocket',     emoji: '🚀', description: 'High-risk, high-reward missions', cooldownKey: 'career:rocket' },
];

function getEquipmentTier(career: string, level: number): string {
  const tiers: Record<string, string[]> = {
    Fisher:     ['Old Rod', 'Good Rod', 'Super Rod', 'Master Rod'],
    Researcher: ['Lab Intern', 'Associate', 'Senior Researcher', 'Professor'],
    Ranger:     ['Recruit', 'Ranger', 'Senior Ranger', 'Ace Ranger'],
    Breeder:    ['Apprentice', 'Breeder', 'Expert Breeder', 'Master Breeder'],
    Miner:      ['Pickaxe', 'Steel Pick', 'Diamond Pick', 'Legendary Pick'],
    Rocket:     ['Grunt', 'Agent', 'Elite', 'Executive'],
  };
  const list = tiers[career] ?? ['Novice'];
  const idx = level >= 15 ? 3 : level >= 10 ? 2 : level >= 5 ? 1 : 0;
  return list[idx];
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('career')
    .setDescription('Career system — view progress or check leaderboards across all 6 careers')
    .addSubcommand((sub) =>
      sub.setName('view')
        .setDescription('View career overview — levels, earnings, and progress')
        .addUserOption((o) => o.setName('user').setDescription("View another trainer's careers"))
    )
    .addSubcommand((sub) =>
      sub.setName('leaderboard')
        .setDescription('Top 10 trainers by career earnings')
        .addStringOption((o) =>
          o.setName('career')
            .setDescription('Career to rank (default: all combined)')
            .addChoices(
              { name: 'Fisher', value: 'Fisher' },
              { name: 'Researcher', value: 'Researcher' },
              { name: 'Ranger', value: 'Ranger' },
              { name: 'Breeder', value: 'Breeder' },
              { name: 'Miner', value: 'Miner' },
              { name: 'Rocket', value: 'Rocket' },
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'view') await handleView(interaction, client);
    else if (sub === 'leaderboard') await handleLeaderboard(interaction, client);
  },
};

async function handleView(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const target = interaction.options.getUser('user') ?? interaction.user;

  const jobs = await client.prisma.userJob.findMany({ where: { userId: target.id } });
  const jobMap = new Map(jobs.map((j) => [j.jobName, j]));

  const lines = await Promise.all(
    CAREERS.map(async (career) => {
      const job = jobMap.get(career.name);
      const level = job?.level ?? 1;
      const timesWorked = job?.timesWorked ?? 0;
      const totalEarned = job?.totalEarned ?? 0;
      const tier = getEquipmentTier(career.name, level);

      const cdKey = `cooldown:${target.id}:${career.cooldownKey}`;
      const cdTtl = await client.redis.ttl(cdKey);
      const cdStatus = cdTtl > 0 ? `⏰ ${Math.ceil(cdTtl / 60)}m` : '✅ Ready';

      const usesToNextLevel = 10 - (timesWorked % 10);
      const filled = 10 - usesToNextLevel;
      const progressBar = '█'.repeat(filled) + '░'.repeat(usesToNextLevel);

      return {
        name: `${career.emoji} ${career.name} — Level ${level} (${tier})`,
        value: `${career.description}\n` +
          `**Used:** ${timesWorked}x | **Earned:** ${formatNumber(totalEarned)} PokéCoins\n` +
          `**Progress:** ${progressBar} (${usesToNextLevel} uses to Level ${level + 1})\n` +
          `**Status:** ${cdStatus}`,
        inline: false,
      };
    })
  );

  const totalEarned = jobs.reduce((sum, j) => sum + j.totalEarned, 0);
  const totalWorked = jobs.reduce((sum, j) => sum + j.timesWorked, 0);

  const embed = new EmbedBuilder()
    .setColor(0xffcb05)
    .setTitle(`${target.id === interaction.user.id ? 'Your' : `${target.username}'s`} Career Overview`)
    .setThumbnail(target.displayAvatarURL())
    .addFields(...lines)
    .setFooter({ text: `Total: ${totalWorked} shifts | ${formatNumber(totalEarned)} PokéCoins earned | Use /fisher, /researcher etc. to work` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const careerFilter = interaction.options.getString('career') ?? null;

  if (careerFilter) {
    const career = CAREERS.find((c) => c.name === careerFilter);
    const emoji = career?.emoji ?? '⭐';

    const top = await client.prisma.userJob.findMany({
      where: { jobName: careerFilter },
      orderBy: { totalEarned: 'desc' },
      take: 10,
      include: { user: { select: { username: true } } },
    });

    if (top.length === 0) {
      await interaction.editReply({ content: `No ${careerFilter} career data found yet.` });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffcb05)
      .setTitle(`${emoji} Top ${careerFilter}s`)
      .setDescription(
        top.map((j, i) =>
          `**${i + 1}.** ${j.user.username} — Level ${j.level} — ${formatNumber(j.totalEarned)} PokéCoins (${j.timesWorked} shifts)`
        ).join('\n')
      )
      .setFooter({ text: 'Ranked by total PokéCoins earned in this career' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } else {
    // All-careers combined: group by userId, sum totalEarned
    const allJobs = await client.prisma.userJob.findMany({
      include: { user: { select: { username: true } } },
    });

    const userTotals = new Map<string, { username: string; totalEarned: number; totalShifts: number }>();
    for (const j of allJobs) {
      const existing = userTotals.get(j.userId);
      if (existing) {
        existing.totalEarned += j.totalEarned;
        existing.totalShifts += j.timesWorked;
      } else {
        userTotals.set(j.userId, { username: j.user.username, totalEarned: j.totalEarned, totalShifts: j.timesWorked });
      }
    }

    const sorted = [...userTotals.values()]
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, 10);

    if (sorted.length === 0) {
      await interaction.editReply({ content: 'No career data found yet.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffcb05)
      .setTitle('🏆 Career Leaderboard — All Careers')
      .setDescription(
        sorted.map((u, i) =>
          `**${i + 1}.** ${u.username} — ${formatNumber(u.totalEarned)} PokéCoins (${u.totalShifts} shifts)`
        ).join('\n')
      )
      .setFooter({ text: 'Total PokéCoins earned across all careers. Use /career leaderboard <career> to filter.' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

export default command;
