import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { CooldownService } from '../../services/CooldownService.js';
import { formatNumber } from '../../utils/embeds.js';

// ── Career data from scenario engine ──────────────────────────────────────────
import { CAREERS as SCENARIO_CAREERS, CAREERS_META } from '../../services/career/scenarios.js';

// ── Equipment shop items per career ───────────────────────────────────────────
type ShopItem = { itemId: string; itemName: string; cost: number; tier: number; bonus: string };

const CAREER_SHOPS: Record<string, ShopItem[]> = {
  Fisher: [
    { itemId: 'good_rod', itemName: 'Good Rod', cost: 2000, tier: 2, bonus: '+25% coin reward' },
    { itemId: 'super_rod', itemName: 'Super Rod', cost: 8000, tier: 3, bonus: '+50% coin reward' },
    { itemId: 'master_rod', itemName: 'Master Rod', cost: 25000, tier: 4, bonus: '+100% coin reward' },
  ],
  Ranger: [
    { itemId: 'field_scanner', itemName: 'Field Scanner', cost: 6000, tier: 3, bonus: '+50% reward, +rare encounter chance' },
    { itemId: 'ranger_gear', itemName: 'Ranger Gear', cost: 20000, tier: 4, bonus: '+100% reward, guaranteed rare encounter' },
  ],
  Researcher: [
    { itemId: 'data_analyzer', itemName: 'Data Analyzer', cost: 8000, tier: 3, bonus: '+50% XP & rare data chance' },
    { itemId: 'pokedex_pro', itemName: 'Pokédex Pro', cost: 25000, tier: 4, bonus: '+100% XP & bonus coins' },
  ],
  Miner: [
    { itemId: 'iron_pickaxe', itemName: 'Iron Pickaxe', cost: 2000, tier: 2, bonus: '+evolution stone chance' },
    { itemId: 'steel_pickaxe', itemName: 'Steel Pickaxe', cost: 8000, tier: 3, bonus: '+rare gem chance' },
    { itemId: 'diamond_drill', itemName: 'Diamond Drill', cost: 25000, tier: 4, bonus: '+guaranteed stone per shift' },
  ],
  Rocket: [
    { itemId: 'hacking_tools', itemName: 'Hacking Tools', cost: 15000, tier: 3, bonus: '+big score chance' },
    { itemId: 'master_plan', itemName: 'Master Plan', cost: 40000, tier: 4, bonus: '+extreme risk/reward ×2' },
  ],
};

function getEquipTierName(careerName: string, level: number): string {
  const career = SCENARIO_CAREERS[careerName];
  if (!career) return 'Basic';
  const tiers = [career.baseEquipmentName, career.baseEquipmentName, ...career.tierItems.map((id) =>
    id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  )];
  const idx = level >= 15 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : 1;
  return tiers[Math.min(idx, tiers.length - 1)];
}

// ── Slash command definition ───────────────────────────────────────────────────

const CAREER_CHOICES = Object.keys(SCENARIO_CAREERS).map((c) => ({
  name: `${SCENARIO_CAREERS[c].emoji} ${c}`,
  value: c,
}));

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('career')
    .setDescription('Career system — shop, view progress, or check leaderboards')
    .addSubcommand((sub) =>
      sub.setName('shop')
        .setDescription('Buy career-specific equipment to boost rewards')
        .addStringOption((o) =>
          o.setName('career')
            .setDescription('Which career shop to browse')
            .setRequired(true)
            .addChoices(...CAREER_CHOICES)
        )
    )
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
              ...Object.keys(SCENARIO_CAREERS).map((c) => ({ name: c, value: c })),
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'shop') await handleShop(interaction, client);
    else if (sub === 'view') await handleView(interaction, client);
    else if (sub === 'leaderboard') await handleLeaderboard(interaction, client);
  },
};

// ── SHOP ─────────────────────────────────────────────────────────────────────

async function handleShop(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply({ ephemeral: true });
  const careerName = interaction.options.getString('career', true);
  const career = SCENARIO_CAREERS[careerName];
  if (!career) { await interaction.editReply('❌ Unknown career.'); return; }

  const shopItems = CAREER_SHOPS[careerName] ?? [];
  if (shopItems.length === 0) {
    await interaction.editReply('❌ No equipment available for this career yet.');
    return;
  }

  const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
  const balance = user?.balance ?? 0;

  const owned = new Set<string>();
  for (const item of shopItems) {
    const inv = await client.prisma.userInventory.findUnique({
      where: { userId_itemId: { userId: interaction.user.id, itemId: item.itemId } },
    });
    if (inv && inv.quantity > 0) owned.add(item.itemId);
  }

  const embed = new EmbedBuilder()
    .setColor(career.color)
    .setTitle(`${career.emoji} ${careerName} Equipment Shop`)
    .setDescription(`Your balance: **${formatNumber(balance)} PokéCoins**\nUpgrade your equipment to boost rewards!`)
    .addFields(
      shopItems.map((item) => ({
        name: `${owned.has(item.itemId) ? '✅' : '🔒'} ${item.itemName} — ${formatNumber(item.cost)} PokéCoins`,
        value: item.bonus + (owned.has(item.itemId) ? '\n*(Already owned)*' : ''),
        inline: false,
      }))
    )
    .setFooter({ text: 'Click a button below to purchase' })
    .setTimestamp();

  const availableToBuy = shopItems.filter((item) => !owned.has(item.itemId));
  if (availableToBuy.length === 0) {
    embed.setDescription(`${embed.data.description}\n\n✅ You own all equipment for this career!`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    availableToBuy.slice(0, 4).map((item) =>
      new ButtonBuilder()
        .setCustomId(`career_shop_buy:${interaction.user.id}:${item.itemId}:${item.cost}:${item.itemName}`)
        .setLabel(`Buy ${item.itemName}`)
        .setStyle(balance >= item.cost ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(balance < item.cost)
    )
  );

  const msg = await interaction.editReply({ embeds: [embed], components: [row] });

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000,
    filter: (btn) => btn.user.id === interaction.user.id,
  });

  collector.on('collect', (btn) => { void (async () => {
    const parts = btn.customId.split(':');
    const itemId = parts[2];
    const cost = parseInt(parts[3], 10);
    const itemName = parts[4];

    if (!itemId || isNaN(cost)) { await btn.reply({ content: '❌ Invalid purchase.', ephemeral: true }); return; }

    const freshUser = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
    if (!freshUser || freshUser.balance < cost) {
      await btn.reply({ content: `❌ Not enough PokéCoins! Need **${formatNumber(cost)}**.`, ephemeral: true });
      return;
    }

    const existing = await client.prisma.userInventory.findUnique({
      where: { userId_itemId: { userId: interaction.user.id, itemId } },
    });
    if (existing && existing.quantity > 0) {
      await btn.reply({ content: '❌ You already own this item!', ephemeral: true });
      return;
    }

    await client.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: interaction.user.id }, data: { balance: { decrement: cost }, totalSpent: { increment: cost } } });
      await tx.userInventory.create({ data: { userId: interaction.user.id, itemId, itemName, quantity: 1 } });
    });

    collector.stop();
    await btn.update({
      embeds: [new EmbedBuilder()
        .setColor(career.color)
        .setTitle(`✅ ${itemName} Purchased!`)
        .setDescription(`You bought **${itemName}** for **${formatNumber(cost)} PokéCoins**.\nYour ${careerName} rewards are now boosted!`)
        .setTimestamp()],
      components: [],
    }); })();
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      interaction.editReply({ components: [] }).catch(() => {});
    }
  });
}

// ── VIEW ──────────────────────────────────────────────────────────────────────

async function handleView(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const target = interaction.options.getUser('user') ?? interaction.user;

  const jobs = await client.prisma.userJob.findMany({ where: { userId: target.id } });
  const jobMap = new Map(jobs.map((j) => [j.jobName, j]));

  const redisReady = client.redis.isReady;

  const lines = await Promise.all(
    CAREERS_META.map(async (careerMeta) => {
      const job = jobMap.get(careerMeta.name);
      const level = job?.level ?? 1;
      const timesWorked = job?.timesWorked ?? 0;
      const totalEarned = job?.totalEarned ?? 0;
      const tierName = getEquipTierName(careerMeta.name, level);

      // Use guild-aware cooldown check so admin changes apply immediately
      const cooldownService = new CooldownService(client);
      const careerCd = await cooldownService.checkCareerForGuild(target.id, interaction.guild?.id);
      const cdStatus = careerCd.onCooldown ? `⏰ ${CooldownService.formatDuration(careerCd.remaining!)}` : '✅ Ready';

      const usesToNextLevel = 10 - (timesWorked % 10);
      const filled = 10 - usesToNextLevel;
      const progress = '█'.repeat(filled) + '░'.repeat(usesToNextLevel);

      return {
        name: `${careerMeta.emoji} ${careerMeta.name} — Level ${level} (${tierName})`,
        value: `${careerMeta.description}\n` +
          `**Used:** ${timesWorked}x | **Earned:** ${formatNumber(totalEarned)} PokéCoins\n` +
          `**Progress:** ${progress} (${usesToNextLevel} uses to Level ${level + 1})\n` +
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
    .setFooter({ text: `Total: ${totalWorked} shifts | ${formatNumber(totalEarned)} PokéCoins earned | Use /work <career>` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────

async function handleLeaderboard(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const careerFilter = interaction.options.getString('career') ?? null;

  if (careerFilter) {
    const careerMeta = CAREERS_META.find((c) => c.name === careerFilter);
    const emoji = careerMeta?.emoji ?? '⭐';

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

    const sorted = [...userTotals.values()].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 10);

    if (sorted.length === 0) { await interaction.editReply({ content: 'No career data found yet.' }); return; }

    const embed = new EmbedBuilder()
      .setColor(0xffcb05)
      .setTitle('🏆 Career Leaderboard — All Careers')
      .setDescription(
        sorted.map((u, i) =>
          `**${i + 1}.** ${u.username} — ${formatNumber(u.totalEarned)} PokéCoins (${u.totalShifts} shifts)`
        ).join('\n')
      )
      .setFooter({ text: 'Total PokéCoins earned across all careers | /career leaderboard <type> to filter' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

export default command;