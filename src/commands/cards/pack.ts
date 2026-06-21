import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuInteraction,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { openPack, fetchSets } from '../../services/pokemonTcgService.js';
import { formatNumber } from '../../utils/embeds.js';
import { checkAndAwardAchievements } from '../../services/achievementService.js';
import { incrementQuestProgress } from '../../services/questService.js';
import { createPackSession, type ResolvedCard } from '../../handlers/packRevealHandler.js';
import { getPackCost, getPackTier } from '../../config/pack-tiers.js';

const PACK_COST = 500; // default fallback
type PackFlowInteraction = ChatInputCommandInteraction | StringSelectMenuInteraction;

export async function buildPackSelectionView(client: BotClient, userId: string, persistent = false) {
  const packs = await client.prisma.userInventory.findMany({
    where: { userId, itemId: { startsWith: 'pack:' }, quantity: { gt: 0 } },
    orderBy: { updatedAt: 'desc' },
    take: 25,
  });
  if (packs.length === 0) {
    return {
      embeds: [new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('❌ No Packs Available')
        .setDescription('You have no unopened packs.\nBuy one with `/pack buy` or ask an admin with `/giftpack`.')],
      components: [],
    };
  }
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${persistent ? 'pack_continue_select' : 'pack_select'}:${userId}`)
    .setPlaceholder('Choose a pack to open...')
    .addOptions(packs.map((pack) => ({
      label: pack.itemName,
      description: `×${pack.quantity} available`,
      value: pack.itemId,
    })));
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('📦 Open a Pack')
      .setDescription('Choose a pack below. Every card is secured in your collection before the reveal begins.')],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
  };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pack')
    .setDescription('Buy, open, or view your TCG card packs')
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy a TCG pack — cost varies by set tier (200–10,000 coins). Use autocomplete to see prices.')
        .addStringOption((o) => o.setName('set').setDescription('Card set to buy (optional — autocomplete shows tier & cost)').setAutocomplete(true))
    )
    .addSubcommand((sub) =>
      sub.setName('open')
        .setDescription('Open an unopened pack from your inventory')
    )
    .addSubcommand((sub) =>
      sub.setName('inventory')
        .setDescription('View your unopened pack inventory')
    ),

  async autocomplete(interaction, client) {
    if (interaction.options.getSubcommand() !== 'buy') {
      await interaction.respond([]);
      return;
    }
    const sets = await fetchSets(client);
    const focused = interaction.options.getFocused().toLowerCase();
    const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
    const filtered = (sets as Array<{ id: string; name: string }>)
      .filter((s) => s.name.toLowerCase().includes(focused) || s.id.toLowerCase().includes(focused))
      .sort((a, b) => {
        const ta = tierOrder[getPackTier(a.id)] ?? 5;
        const tb = tierOrder[getPackTier(b.id)] ?? 5;
        return ta - tb;
      })
      .slice(0, 25);
    await interaction.respond(filtered.map((s) => {
      const tier = getPackTier(s.id);
      const cost = getPackCost(s.id);
      const label = `${s.name} · Tier ${tier} · ${cost.toLocaleString()} coins`;
      return { name: label.slice(0, 100), value: s.id };
    }));
  },

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'buy') await handleBuy(interaction, client);
    else if (sub === 'open') await handleOpen(interaction, client);
    else if (sub === 'inventory') await handleInventory(interaction, client);
  },
};

async function handleBuy(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const setIdInput = interaction.options.getString('set') ?? undefined;

  let setId = setIdInput;
  let setName = 'Random Set';
  let tier = 'C';

  if (setId) {
    const sets = await fetchSets(client);
    const found = (sets as Array<{ id: string; name: string }>).find((s) => s.id === setId);
    if (!found) {
      await interaction.editReply('❌ Set not found. Use autocomplete to select a valid set.');
      return;
    }
    setName = found.name;
  } else {
    // Pick a random set
    const sets = await fetchSets(client);
    const pick = (sets as Array<{ id: string; name: string }>)[Math.floor(Math.random() * sets.length)];
    if (pick) { setId = pick.id; setName = pick.name; }
  }

  const cost = setId ? getPackCost(setId) : PACK_COST;
  tier = setId ? getPackTier(setId) : 'C';

  try {
    await client.prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: interaction.user.id } });
      if (!u || u.balance < cost) throw new Error('INSUFFICIENT_FUNDS');
      await tx.user.update({
        where: { id: interaction.user.id },
        data: { balance: { decrement: cost }, totalSpent: { increment: cost } },
      });
      await tx.userInventory.upsert({
        where: { userId_itemId: { userId: interaction.user.id, itemId: `pack:${setId}` } },
        update: { quantity: { increment: 1 } },
        create: { userId: interaction.user.id, itemId: `pack:${setId}`, itemName: `${setName} Pack`, quantity: 1 },
      });
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_FUNDS') {
      const u = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
      await interaction.editReply(`❌ You need **${formatNumber(cost)} PokéCoins** to buy a pack. You have **${formatNumber(u?.balance ?? 0)}**.`);
    } else {
      client.logger.error('Pack purchase failed', error);
      await interaction.editReply('❌ An error occurred. Please try again.');
    }
    return;
  }

  // Check current inventory count for this set
  const inv = await client.prisma.userInventory.findUnique({
    where: { userId_itemId: { userId: interaction.user.id, itemId: `pack:${setId}` } },
  });

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('📦 Pack Purchased!')
      .setDescription(`Added **${setName} Pack** to your inventory.`)
      .addFields(
        { name: '💰 Cost', value: `${formatNumber(cost)} PokéCoins`, inline: true },
        { name: '📦 Tier', value: `Tier ${tier}`, inline: true },
        { name: '📦 Owned (this set)', value: `${inv?.quantity ?? 1}`, inline: true },
      )
      .setFooter({ text: 'Your pack is ready to open.' })
      .setTimestamp()],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`pack_open_another:${interaction.user.id}`)
        .setLabel('Open Pack')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Success),
    )],
  });
}

async function handleInventory(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();

  const packs = await client.prisma.userInventory.findMany({
    where: { userId: interaction.user.id, itemId: { startsWith: 'pack:' }, quantity: { gt: 0 } },
    orderBy: { updatedAt: 'desc' },
  });

  if (packs.length === 0) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🎒 Pack Inventory')
        .setDescription('You have no unopened packs.\nBuy one with `/pack buy` or ask an admin to gift you packs!')],
    });
    return;
  }

  const lines = packs.map((p) => `📦 **${p.itemName}** — ×${p.quantity}`).join('\n');
  const total = packs.reduce((sum, p) => sum + p.quantity, 0);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🎒 Your Pack Inventory')
      .setDescription(lines)
      .addFields({ name: 'Total Packs', value: `${total}`, inline: true })
      .setFooter({ text: 'Choose Open Pack to continue.' })
      .setTimestamp()],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`pack_open_another:${interaction.user.id}`)
        .setLabel('Open Pack')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Success),
    )],
  });
}

async function handleOpen(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();
  const view = await buildPackSelectionView(client, interaction.user.id);
  const reply = await interaction.editReply(view);
  if (view.components.length === 0) return;

  // Await the selection
  try {
    const selection = await reply.awaitMessageComponent({
      filter: (i): i is StringSelectMenuInteraction => i.isStringSelectMenu() && i.user.id === interaction.user.id,
      time: 30_000,
    }) as StringSelectMenuInteraction;

    // Acknowledge the select-menu interaction immediately — Discord gives 3s before it expires.
    // All remaining async work (DB, TCG API, Redis) runs after this defer.
    await selection.deferUpdate();
    await openSelectedPack(selection, client, selection.values[0]);
  } catch (error: unknown) {
    const errorCode = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
    const errorMessage = error instanceof Error ? error.message : '';
    const isTimeout = errorCode === 'InteractionCollectorError' || errorMessage.includes('timeout');
    await interaction.editReply({
      content: isTimeout
        ? '⌛ Selection timed out. Use `/pack open` to try again.'
        : '❌ An error occurred. Please use `/pack open` to start again.',
      embeds: [],
      components: [],
    }).catch(() => {});
  }
}

export async function openSelectedPack(
  interaction: PackFlowInteraction,
  client: BotClient,
  chosenItemId: string,
): Promise<void> {
  const chosenPack = await client.prisma.userInventory.findUnique({
    where: { userId_itemId: { userId: interaction.user.id, itemId: chosenItemId } },
  });
  if (!chosenPack || chosenPack.quantity < 1) {
    await interaction.editReply({ content: '❌ Pack no longer in inventory.', embeds: [], components: [] });
    return;
  }
  const setId = chosenItemId.replace('pack:', '');

  try {
    const consumed = await client.prisma.userInventory.updateMany({
      where: { id: chosenPack.id, userId: interaction.user.id, quantity: { gt: 0 } },
      data: { quantity: { decrement: 1 } },
    });
    if (consumed.count !== 1) throw new Error('NO_PACK');
  } catch {
    await interaction.editReply({ content: '❌ Pack no longer in inventory.', embeds: [], components: [] });
    return;
  }

  const refund = async () => {
    await client.prisma.userInventory.upsert({
      where: { userId_itemId: { userId: interaction.user.id, itemId: chosenItemId } },
      update: { quantity: { increment: 1 } },
      create: { userId: interaction.user.id, itemId: chosenItemId, itemName: chosenPack.itemName, quantity: 1 },
    });
  };

  let sessionCreated = false;
  try {
    const rawCards = await openPack(client, setId);
    if (rawCards.length === 0) throw new Error('PACK_API_EMPTY');

    const cardIds = rawCards.map((card) => card.id as string);
    const existingCards = await client.prisma.userCard.findMany({
      where: { userId: interaction.user.id, cardId: { in: cardIds } },
    });
    const ownedIds = new Set(existingCards.map((card) => card.cardId));
    const sets = await fetchSets(client);
    const setInfo = (sets as Array<{ id: string; name: string; images?: { logo?: string } }>)
      .find((set) => set.id === setId);
    const resolvedCards: ResolvedCard[] = rawCards.map((rawCard) => {
      const card = rawCard as Record<string, unknown>;
      const images = card.images as Record<string, unknown> | undefined;
      return {
        id: card.id as string,
        name: card.name as string,
        rarity: (card.rarity as string) ?? 'Common',
        imageSmall: (images?.small as string) ?? null,
        imageLarge: (images?.large as string) ?? null,
        number: (card.number as string) ?? '0',
        isNew: !ownedIds.has(card.id as string),
        hp: (card.hp as string) ?? null,
        types: (card.types as string[]) ?? undefined,
        subtypes: (card.subtypes as string[]) ?? undefined,
        attacks: (card.attacks as ResolvedCard['attacks'])?.slice(0, 2),
        weaknesses: (card.weaknesses as ResolvedCard['weaknesses'])?.slice(0, 2),
        retreatCost: (card.retreatCost as number) ?? undefined,
      };
    });
    const sessionResult = await createPackSession(
      client,
      interaction.user.id,
      interaction.guild?.id,
      setId,
      setInfo?.name ?? chosenPack.itemName.replace(' Pack', ''),
      setInfo?.images?.logo,
      resolvedCards,
    );
    sessionCreated = true;
    await interaction.editReply({ embeds: [sessionResult.embed], components: [sessionResult.row] });
    incrementQuestProgress(client.prisma, interaction.user.id, 'open_pack', 1).catch(() => {});
    checkAndAwardAchievements(client, interaction.user.id, interaction.channelId, interaction.guild?.id).catch(() => {});
  } catch (error) {
    client.logger.error('Pack opening failed before session creation', error);
    if (!sessionCreated) await refund();
    await interaction.editReply({
      content: sessionCreated
        ? '⚠️ Your cards are safe in your collection, but the reveal message could not be displayed.'
        : '❌ Could not safely open that pack. It has been refunded.',
      embeds: [],
      components: [],
    }).catch(() => {});
  }
}

export default command;
