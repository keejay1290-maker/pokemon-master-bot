import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';

const CAREERS = [
  { name: 'Fisher',     emoji: '🎣', description: 'Fishing for rare catches',       cooldownKey: 'career:fisher',     nextMilestone: (level: number) => `Level ${Math.ceil(level / 5) * 5}` },
  { name: 'Researcher', emoji: '🔬', description: 'Pokémon research & academia',    cooldownKey: 'career:researcher',  nextMilestone: (level: number) => `Level ${Math.ceil(level / 5) * 5}` },
  { name: 'Ranger',     emoji: '🌲', description: 'Protecting wild Pokémon',        cooldownKey: 'career:ranger',      nextMilestone: (level: number) => `Level ${Math.ceil(level / 5) * 5}` },
  { name: 'Breeder',    emoji: '🥚', description: 'Caring for eggs & hatching',     cooldownKey: 'career:breeder',     nextMilestone: (level: number) => `Level ${Math.ceil(level / 5) * 5}` },
  { name: 'Miner',      emoji: '⛏️', description: 'Mining for fossils & stones',    cooldownKey: 'career:miner',       nextMilestone: (level: number) => `Level ${Math.ceil(level / 5) * 5}` },
  { name: 'Rocket',     emoji: '🚀', description: 'High-risk, high-reward missions', cooldownKey: 'career:rocket',     nextMilestone: (level: number) => `Level ${Math.ceil(level / 5) * 5}` },
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
    .setDescription('View your career overview — levels, earnings, and progress across all 6 careers')
    .addUserOption((o) => o.setName('user').setDescription('Check another trainer\'s careers')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();

    const target = interaction.options.getUser('user') ?? interaction.user;

    const jobs = await client.prisma.userJob.findMany({
      where: { userId: target.id },
    });

    const jobMap = new Map(jobs.map((j) => [j.jobName, j]));

    const now = Date.now();
    const lines = await Promise.all(
      CAREERS.map(async (career) => {
        const job = jobMap.get(career.name);
        const level = job?.level ?? 1;
        const timesWorked = job?.timesWorked ?? 0;
        const totalEarned = job?.totalEarned ?? 0;
        const tier = getEquipmentTier(career.name, level);

        // Check Redis cooldown
        const cdKey = `cooldown:${target.id}:${career.cooldownKey}`;
        const cdTtl = await client.redis.ttl(cdKey);
        const cdStatus = cdTtl > 0
          ? `⏰ ${Math.ceil(cdTtl / 60)}m`
          : '✅ Ready';

        const usesToNextLevel = 10 - (timesWorked % 10);
        const progressBar = '█'.repeat(10 - usesToNextLevel) + '░'.repeat(usesToNextLevel);

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
  },
};

export default command;
