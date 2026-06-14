import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { addXp } from '../../services/userService.js';

// ── Career definitions ─────────────────────────────────────────────────────────

type WorkEntry = { name: string; reward: number; chance: number; emoji: string };
type ShopItem = { itemId: string; itemName: string; cost: number; tier: number; bonus: string };

interface CareerDef {
  emoji: string;
  color: number;
  description: string;
  cooldownKey: string;
  cooldown: number;
  table: WorkEntry[];
  drop?: { itemId: string; itemName: string; chance: number; message: string };
  shop: ShopItem[];
}

const CAREERS: Record<string, CareerDef> = {
  Fisher: {
    emoji: '🎣', color: 0x3498db,
    description: 'Cast your line and see what bites!',
    cooldownKey: 'career:fisher', cooldown: 3600,
    table: [
      { name: 'Magikarp', reward: 150, chance: 0.30, emoji: '🐟' },
      { name: 'Goldeen', reward: 200, chance: 0.20, emoji: '🐠' },
      { name: 'Tentacool', reward: 250, chance: 0.18, emoji: '🪼' },
      { name: 'Horsea', reward: 400, chance: 0.12, emoji: '🐴' },
      { name: 'Psyduck', reward: 600, chance: 0.09, emoji: '🦆' },
      { name: 'Gyarados', reward: 1500, chance: 0.05, emoji: '🐉' },
      { name: 'Lapras', reward: 2500, chance: 0.03, emoji: '🦕' },
      { name: 'Dratini', reward: 5000, chance: 0.01, emoji: '🐲' },
    ],
    shop: [
      { itemId: 'good_rod', itemName: 'Good Rod', cost: 2000, tier: 2, bonus: '+25% coin reward' },
      { itemId: 'super_rod', itemName: 'Super Rod', cost: 8000, tier: 3, bonus: '+50% coin reward' },
      { itemId: 'master_rod', itemName: 'Master Rod', cost: 25000, tier: 4, bonus: '+100% coin reward' },
    ],
  },
  Ranger: {
    emoji: '🌲', color: 0x27ae60,
    description: 'Patrol the wild and protect Pokémon!',
    cooldownKey: 'career:ranger', cooldown: 3600,
    table: [
      { name: 'Rattata nest cleared', reward: 250, chance: 0.28, emoji: '🐭' },
      { name: 'Lost trainer found', reward: 400, chance: 0.22, emoji: '🧭' },
      { name: 'Rare Pokémon tracked', reward: 700, chance: 0.18, emoji: '🦶' },
      { name: 'Poacher stopped', reward: 1200, chance: 0.12, emoji: '🚫' },
      { name: 'Safari Zone patrol', reward: 1800, chance: 0.09, emoji: '🌿' },
      { name: 'Legendary sighting', reward: 3000, chance: 0.06, emoji: '⚡' },
      { name: 'Safari ticket earned', reward: 4500, chance: 0.03, emoji: '🎟️' },
      { name: 'Rare encounter report', reward: 6000, chance: 0.02, emoji: '📋' },
    ],
    drop: { itemId: 'pokeball', itemName: 'Poke Ball', chance: 0.10, message: '⚽ You kept some Poké Balls from patrol!' },
    shop: [
      { itemId: 'tracking_kit', itemName: 'Tracking Kit', cost: 1500, tier: 2, bonus: '+25% reward, +rare encounter chance' },
      { itemId: 'field_scanner', itemName: 'Field Scanner', cost: 6000, tier: 3, bonus: '+50% reward, +rare encounter chance' },
      { itemId: 'ranger_gear', itemName: 'Ranger Gear', cost: 20000, tier: 4, bonus: '+100% reward, guaranteed rare encounter' },
    ],
  },
  Breeder: {
    emoji: '🥚', color: 0xf39c12,
    description: 'Care for eggs and hatch rare Pokémon!',
    cooldownKey: 'career:breeder', cooldown: 3600,
    table: [
      { name: 'Pidgey egg hatched', reward: 200, chance: 0.30, emoji: '🐣' },
      { name: 'Eevee egg hatched', reward: 500, chance: 0.22, emoji: '🦊' },
      { name: 'Snorlax egg hatched', reward: 800, chance: 0.18, emoji: '😴' },
      { name: 'Dragon egg hatched', reward: 1400, chance: 0.12, emoji: '🐉' },
      { name: 'Shiny egg hatched!', reward: 3000, chance: 0.09, emoji: '✨' },
      { name: 'Legendary egg detected', reward: 5000, chance: 0.05, emoji: '🌟' },
      { name: 'Mythical egg hatched!', reward: 8000, chance: 0.03, emoji: '💫' },
      { name: 'Perfect IV egg!', reward: 12000, chance: 0.01, emoji: '💎' },
    ],
    drop: { itemId: 'oran_berry', itemName: 'Oran Berry', chance: 0.10, message: '🍇 The Day Care gave you extra berries!' },
    shop: [
      { itemId: 'improved_incubator', itemName: 'Improved Incubator', cost: 5000, tier: 2, bonus: '+rare egg chance' },
      { itemId: 'advanced_incubator', itemName: 'Advanced Incubator', cost: 15000, tier: 3, bonus: '+shiny egg chance' },
      { itemId: 'perfect_incubator', itemName: 'Perfect Incubator', cost: 50000, tier: 4, bonus: '+IV boost on hatched' },
    ],
  },
  Researcher: {
    emoji: '🔬', color: 0x9b59b6,
    description: 'Conduct research and earn academic grants!',
    cooldownKey: 'career:researcher', cooldown: 3600,
    table: [
      { name: 'Field survey', reward: 300, chance: 0.30, emoji: '📊' },
      { name: 'Lab analysis', reward: 500, chance: 0.22, emoji: '🧪' },
      { name: 'Paper published', reward: 900, chance: 0.18, emoji: '📄' },
      { name: 'Discovery made', reward: 1500, chance: 0.12, emoji: '🔭' },
      { name: 'Grant awarded', reward: 2500, chance: 0.09, emoji: '🏆' },
      { name: 'Major breakthrough', reward: 4000, chance: 0.05, emoji: '💡' },
      { name: 'Government contract', reward: 7000, chance: 0.03, emoji: '📜' },
      { name: 'Nobel-level discovery', reward: 10000, chance: 0.01, emoji: '🌍' },
    ],
    drop: { itemId: 'exp_shard', itemName: 'EXP Shard', chance: 0.08, message: '🔬 Lab by-product: an EXP Shard!' },
    shop: [
      { itemId: 'research_kit', itemName: 'Research Kit', cost: 2000, tier: 2, bonus: '+30% XP & coin reward' },
      { itemId: 'data_analyzer', itemName: 'Data Analyzer', cost: 8000, tier: 3, bonus: '+50% XP & rare data chance' },
      { itemId: 'pokedex_pro', itemName: 'Pokédex Pro', cost: 25000, tier: 4, bonus: '+100% XP & bonus coins' },
    ],
  },
  Miner: {
    emoji: '⛏️', color: 0x795548,
    description: 'Mine for evolution stones, fossils, and gems!',
    cooldownKey: 'career:miner', cooldown: 3600,
    table: [
      { name: 'Stone chunks', reward: 200, chance: 0.30, emoji: '🪨' },
      { name: 'Fire Stone shard', reward: 500, chance: 0.20, emoji: '🔥' },
      { name: 'Water Stone shard', reward: 500, chance: 0.18, emoji: '💧' },
      { name: 'Rare gem', reward: 900, chance: 0.12, emoji: '💎' },
      { name: 'Thunder Stone', reward: 1500, chance: 0.09, emoji: '⚡' },
      { name: 'Old Amber fossil', reward: 2500, chance: 0.06, emoji: '🦕' },
      { name: 'Moon Stone vein', reward: 5000, chance: 0.03, emoji: '🌙' },
      { name: 'Mega Stone discovered!', reward: 10000, chance: 0.02, emoji: '🌌' },
    ],
    shop: [
      { itemId: 'iron_pickaxe', itemName: 'Iron Pickaxe', cost: 2000, tier: 2, bonus: '+evolution stone chance' },
      { itemId: 'steel_pickaxe', itemName: 'Steel Pickaxe', cost: 8000, tier: 3, bonus: '+rare gem chance' },
      { itemId: 'diamond_drill', itemName: 'Diamond Drill', cost: 25000, tier: 4, bonus: '+guaranteed stone per shift' },
    ],
  },
  Rocket: {
    emoji: '🚀', color: 0xe74c3c,
    description: 'High-risk, high-reward criminal operations!',
    cooldownKey: 'career:rocket', cooldown: 3600,
    table: [
      { name: 'Petty theft', reward: 300, chance: 0.25, emoji: '💰' },
      { name: 'Smuggling run', reward: 600, chance: 0.20, emoji: '📦' },
      { name: 'Heist attempt', reward: 1200, chance: 0.18, emoji: '🏦' },
      { name: 'Black market deal', reward: 2000, chance: 0.14, emoji: '🕶️' },
      { name: 'Big score', reward: 3500, chance: 0.10, emoji: '💵' },
      { name: 'Corporate espionage', reward: 6000, chance: 0.07, emoji: '🕵️' },
      { name: 'Silph Co. infiltration', reward: 10000, chance: 0.04, emoji: '⚡' },
      { name: 'Legendary theft!', reward: 15000, chance: 0.02, emoji: '🌑' },
    ],
    shop: [
      { itemId: 'gadget_kit', itemName: 'Gadget Kit', cost: 5000, tier: 2, bonus: '+success rate +25%' },
      { itemId: 'hacking_tools', itemName: 'Hacking Tools', cost: 15000, tier: 3, bonus: '+big score chance' },
      { itemId: 'master_plan', itemName: 'Master Plan', cost: 40000, tier: 4, bonus: '+extreme risk/reward ×2' },
    ],
  },
};

// Equipment tier multipliers indexed by tier (0=none,1=base,2,3,4)
const TIER_MULTIPLIERS = [1.0, 1.0, 1.25, 1.5, 2.0];

function getEquipmentTier(careerName: string, level: number): string {
  const tiers: Record<string, string[]> = {
    Fisher: ['Old Rod', 'Old Rod', 'Good Rod', 'Super Rod', 'Master Rod'],
    Ranger: ['Net', 'Net', 'Tracking Kit', 'Field Scanner', 'Ranger Gear'],
    Breeder: ['Incubator', 'Incubator', 'Improved Incubator', 'Advanced Incubator', 'Perfect Incubator'],
    Researcher: ['Field Notes', 'Field Notes', 'Research Kit', 'Data Analyzer', 'Pokédex Pro'],
    Miner: ['Pickaxe', 'Pickaxe', 'Iron Pickaxe', 'Steel Pickaxe', 'Diamond Drill'],
    Rocket: ['Disguise', 'Disguise', 'Gadget Kit', 'Hacking Tools', 'Master Plan'],
  };
  const list = tiers[careerName] ?? ['Basic'];
  const idx = level >= 15 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : 1;
  return list[Math.min(idx, list.length - 1)];
}

async function getOwnedEquipmentTier(client: BotClient, userId: string, careerName: string): Promise<number> {
  const career = CAREERS[careerName];
  if (!career) return 1;
  for (let t = career.shop.length; t >= 0; t--) {
    const item = career.shop[t - 1];
    if (!item) continue;
    const inv = await client.prisma.userInventory.findUnique({
      where: { userId_itemId: { userId, itemId: item.itemId } },
    });
    if (inv && inv.quantity > 0) return item.tier;
  }
  return 1;
}

// ── Slash command definition ───────────────────────────────────────────────────

const CAREER_CHOICES = Object.keys(CAREERS).map((c) => ({ name: `${CAREERS[c].emoji} ${c}`, value: c }));

const CAREERS_META = [
  { name: 'Fisher', emoji: '🎣', description: 'Fishing for rare catches', cooldownKey: 'career:fisher' },
  { name: 'Researcher', emoji: '🔬', description: 'Pokémon research & academia', cooldownKey: 'career:researcher' },
  { name: 'Ranger', emoji: '🌲', description: 'Protecting wild Pokémon', cooldownKey: 'career:ranger' },
  { name: 'Breeder', emoji: '🥚', description: 'Caring for eggs & hatching', cooldownKey: 'career:breeder' },
  { name: 'Miner', emoji: '⛏️', description: 'Mining for fossils & stones', cooldownKey: 'career:miner' },
  { name: 'Rocket', emoji: '🚀', description: 'High-risk, high-reward missions', cooldownKey: 'career:rocket' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('career')
    .setDescription('Career system — work, shop, view progress, or check leaderboards')
    .addSubcommand((sub) =>
      sub.setName('work')
        .setDescription('Do career work to earn PokéCoins')
        .addStringOption((o) =>
          o.setName('type')
            .setDescription('Which career to work')
            .setRequired(true)
            .addChoices(...CAREER_CHOICES)
        )
    )
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
    if (sub === 'work') await handleWork(interaction, client);
    else if (sub === 'shop') await handleShop(interaction, client);
    else if (sub === 'view') await handleView(interaction, client);
    else if (sub === 'leaderboard') await handleLeaderboard(interaction, client);
  },
};

// ── WORK ─────────────────────────────────────────────────────────────────────

async function handleWork(interaction: ChatInputCommandInteraction, client: BotClient) {
  const careerName = interaction.options.getString('type', true);
  const career = CAREERS[careerName];
  if (!career) { await interaction.reply({ content: '❌ Unknown career.', ephemeral: true }); return; }

  const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, career.cooldownKey, career.cooldown);
  if (onCooldown) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xff4444).setTitle(`⏰ ${careerName} Cooldown`)
        .setDescription(`Come back in **${formatDuration(remaining!)}**.`)],
      ephemeral: true,
    });
    return;
  }

  const jobRecord = await client.prisma.userJob.findUnique({
    where: { userId_jobName: { userId: interaction.user.id, jobName: careerName } },
  });
  const jobLevel = jobRecord?.level ?? 1;

  // Equipment tier from owned items
  const ownedTier = await getOwnedEquipmentTier(client, interaction.user.id, careerName);
  const levelScaling = 1.0 + (jobLevel - 1) * 0.05;
  const tierMult = TIER_MULTIPLIERS[ownedTier] ?? 1.0;
  const equipmentName = getEquipmentTier(careerName, ownedTier * 5); // level proxy for name

  // Weighted roll from career table
  let roll = Math.random();
  let result = career.table[0];
  for (const entry of career.table) {
    roll -= entry.chance;
    if (roll <= 0) { result = entry; break; }
  }

  const baseReward = result.reward;
  const reward = Math.floor(baseReward * levelScaling * tierMult);
  const xpGain = Math.floor(Math.max(20, reward / 30));

  await setCooldown(client, interaction.user.id, career.cooldownKey, career.cooldown);

  await client.prisma.user.update({
    where: { id: interaction.user.id },
    data: { balance: { increment: reward }, totalEarned: { increment: reward } },
  });

  const newRecord = await client.prisma.userJob.upsert({
    where: { userId_jobName: { userId: interaction.user.id, jobName: careerName } },
    update: { lastWorked: new Date(), totalEarned: { increment: reward }, timesWorked: { increment: 1 } },
    create: { userId: interaction.user.id, jobName: careerName, lastWorked: new Date(), totalEarned: reward, timesWorked: 1 },
  });

  let leveledUp = false;
  if (newRecord.timesWorked % 10 === 0) {
    await client.prisma.userJob.update({
      where: { userId_jobName: { userId: interaction.user.id, jobName: careerName } },
      data: { level: { increment: 1 } },
    });
    leveledUp = true;
  }

  const { leveledUp: trainerLeveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

  // Item drop
  let dropMessage: string | null = null;
  if (career.drop && Math.random() < career.drop.chance) {
    await client.prisma.userInventory.upsert({
      where: { userId_itemId: { userId: interaction.user.id, itemId: career.drop.itemId } },
      update: { quantity: { increment: 1 } },
      create: { userId: interaction.user.id, itemId: career.drop.itemId, itemName: career.drop.itemName, quantity: 1 },
    });
    dropMessage = career.drop.message;
  }

  const embed = new EmbedBuilder()
    .setColor(career.color)
    .setTitle(`${career.emoji} ${careerName} — ${result.emoji} ${result.name}`)
    .setDescription(`**+${formatNumber(reward)} PokéCoins**`)
    .addFields(
      { name: '🎒 Equipment', value: equipmentName, inline: true },
      { name: '📊 Career Level', value: `${jobLevel}${leveledUp ? ' → **Level Up!** 🎉' : ''}`, inline: true },
      { name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true },
      { name: '⏰ Next Shift', value: formatDuration(career.cooldown), inline: true },
    );

  if (ownedTier > 1) embed.addFields({ name: '🔧 Equipment Bonus', value: `×${tierMult.toFixed(2)} reward`, inline: true });
  if (dropMessage) embed.addFields({ name: '🎒 Item Drop!', value: dropMessage, inline: false });
  if (trainerLeveledUp) embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Trainer Level ${newLevel}**!`, inline: false });
  embed.setFooter({ text: `Use /career shop ${careerName.toLowerCase()} to upgrade your equipment` }).setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// ── SHOP ─────────────────────────────────────────────────────────────────────

async function handleShop(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply({ ephemeral: true });
  const careerName = interaction.options.getString('career', true);
  const career = CAREERS[careerName];
  if (!career) { await interaction.editReply('❌ Unknown career.'); return; }

  const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
  const balance = user?.balance ?? 0;

  // Check what the user already owns
  const owned = new Set<string>();
  for (const item of career.shop) {
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
      career.shop.map((item) => ({
        name: `${owned.has(item.itemId) ? '✅' : '🔒'} ${item.itemName} — ${formatNumber(item.cost)} PokéCoins`,
        value: item.bonus + (owned.has(item.itemId) ? '\n*(Already owned)*' : ''),
        inline: false,
      }))
    )
    .setFooter({ text: 'Click a button below to purchase' })
    .setTimestamp();

  const availableToBuy = career.shop.filter((item) => !owned.has(item.itemId));
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

  collector.on('collect', async (btn) => {
    const parts = btn.customId.split(':');
    // parts: career_shop_buy : userId : itemId : cost : itemName (itemName may have colons avoided)
    const itemId = parts[2];
    const cost = parseInt(parts[3], 10);
    const itemName = parts[4];

    if (!itemId || isNaN(cost)) { await btn.reply({ content: '❌ Invalid purchase.', ephemeral: true }); return; }

    // Re-check balance
    const freshUser = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
    if (!freshUser || freshUser.balance < cost) {
      await btn.reply({ content: `❌ Not enough PokéCoins! Need **${formatNumber(cost)}**.`, ephemeral: true });
      return;
    }

    // Check not already owned
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
    });
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
    CAREERS_META.map(async (career) => {
      const job = jobMap.get(career.name);
      const level = job?.level ?? 1;
      const timesWorked = job?.timesWorked ?? 0;
      const totalEarned = job?.totalEarned ?? 0;
      const tier = getEquipmentTier(career.name, level);

      let cdStatus = '✅ Ready';
      if (redisReady) {
        const cdKey = `cooldown:${target.id}:${career.cooldownKey}`;
        const cdTtl = await client.redis.ttl(cdKey);
        cdStatus = cdTtl > 0 ? `⏰ ${Math.ceil(cdTtl / 60)}m` : '✅ Ready';
      }

      const usesToNextLevel = 10 - (timesWorked % 10);
      const filled = 10 - usesToNextLevel;
      const progress = '█'.repeat(filled) + '░'.repeat(usesToNextLevel);

      return {
        name: `${career.emoji} ${career.name} — Level ${level} (${tier})`,
        value: `${career.description}\n` +
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
    .setFooter({ text: `Total: ${totalWorked} shifts | ${formatNumber(totalEarned)} PokéCoins earned | Use /career work <type>` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────

async function handleLeaderboard(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const careerFilter = interaction.options.getString('career') ?? null;

  if (careerFilter) {
    const career = CAREERS_META.find((c) => c.name === careerFilter);
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
