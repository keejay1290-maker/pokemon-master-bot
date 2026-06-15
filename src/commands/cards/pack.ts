import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { openPack, fetchSets } from '../../services/pokemonTcgService.js';
import { formatNumber } from '../../utils/embeds.js';
import { checkAndAwardAchievements } from '../../services/achievementService.js';
import { incrementQuestProgress } from '../../services/questService.js';
import { createPackSession, type ResolvedCard } from '../../handlers/packRevealHandler.js';
import { getPackCost, getPackTier, getPackSize, TIER_CONFIGS } from '../../config/pack-tiers.js';

const PACK_COST = 500; // default fallback

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pack')
    .setDescription('Buy, open, or view your TCG card packs')
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription(`Buy a pack for ${formatNumber(PACK_COST)} PokéCoins and add to your inventory`)
        .addStringOption((o) => o.setName('set').setDescription('Card set to buy (optional)').setAutocomplete(true))
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
    const filtered = (sets as Array<{ id: string; name: string }>)
      .filter((s) => s.name.toLowerCase().includes(focused))
      .slice(0, 25);
    await interaction.respond(filtered.map((s) => ({ name: s.name, value: s.id })));
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
  } catch (e: any) {
    if (e.message === 'INSUFFICIENT_FUNDS') {
      const u = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
      await interaction.editReply(`❌ You need **${formatNumber(cost)} PokéCoins** to buy a pack. You have **${formatNumber(u?.balance ?? 0)}**.`);
    } else {
      console.error(e);
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
      .setFooter({ text: 'Open with /pack open' })
      .setTimestamp()],
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
      .setFooter({ text: 'Open a pack with /pack open' })
      .setTimestamp()],
  });
}

async function handleOpen(interaction: ChatInputCommandInteraction, client: BotClient) {
  await interaction.deferReply();

  const packs = await client.prisma.userInventory.findMany({
    where: { userId: interaction.user.id, itemId: { startsWith: 'pack:' }, quantity: { gt: 0 } },
    orderBy: { updatedAt: 'desc' },
    take: 25,
  });

  if (packs.length === 0) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('❌ No Packs Available')
        .setDescription('You have no unopened packs.\nBuy one with `/pack buy` or ask an admin with `/giftpack`.')],
    });
    return;
  }

  // Show select menu for pack choice
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`pack_select:${interaction.user.id}`)
    .setPlaceholder('Choose a pack to open...')
    .addOptions(
      packs.map((p) => ({
        label: p.itemName,
        description: `×${p.quantity} available`,
        value: p.itemId,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const reply = await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('📦 Open a Pack')
      .setDescription('Select a pack from your inventory to begin opening.\nCards are revealed one at a time!'),
    ],
    components: [row],
  });

  // Await the selection
  try {
    const selection = await reply.awaitMessageComponent({
      filter: (i): i is StringSelectMenuInteraction => i.isStringSelectMenu() && i.user.id === interaction.user.id,
      time: 30_000,
    }) as StringSelectMenuInteraction;

    const chosenItemId = selection.values[0];
    const chosenPack = packs.find((p) => p.itemId === chosenItemId);
    if (!chosenPack) {
      await selection.update({ content: '❌ Pack not found.', embeds: [], components: [] });
      return;
    }

    const setId = chosenItemId.replace('pack:', '');

    // Atomic deduction — verify ownership before consuming
    try {
      await client.prisma.$transaction(async (tx) => {
        const inv = await tx.userInventory.findUnique({
          where: { userId_itemId: { userId: interaction.user.id, itemId: chosenItemId } },
        });
        if (!inv || inv.quantity < 1) throw new Error('NO_PACK');
        if (inv.quantity === 1) {
          await tx.userInventory.delete({ where: { userId_itemId: { userId: interaction.user.id, itemId: chosenItemId } } });
        } else {
          await tx.userInventory.update({
            where: { userId_itemId: { userId: interaction.user.id, itemId: chosenItemId } },
            data: { quantity: { decrement: 1 } },
          });
        }
      });
    } catch (e: any) {
      if (e.message === 'NO_PACK') {
        await selection.update({ content: '❌ Pack no longer in inventory.', embeds: [], components: [] });
      } else {
        console.error(e);
        await selection.update({ content: '❌ An error occurred.', embeds: [], components: [] });
      }
      return;
    }

    // Fetch the cards for this pack
    const rawCards = await openPack(client, setId);
    if (rawCards.length === 0) {
      // Refund the pack
      await client.prisma.userInventory.upsert({
        where: { userId_itemId: { userId: interaction.user.id, itemId: chosenItemId } },
        update: { quantity: { increment: 1 } },
        create: { userId: interaction.user.id, itemId: chosenItemId, itemName: chosenPack.itemName, quantity: 1 },
      });
      await selection.update({ content: '❌ Could not fetch cards from TCG API. Your pack has been refunded.', embeds: [], components: [] });
      return;
    }

    // Check which cards the user already owns (for NEW vs DUPLICATE)
    const cardIds = rawCards.map((c) => (c as Record<string, unknown>).id as string);
    const existingCards = await client.prisma.userCard.findMany({
      where: { userId: interaction.user.id, cardId: { in: cardIds } },
    });
    const ownedIds = new Set(existingCards.map((ec) => ec.cardId));

    // Fetch set info for logo
    const sets = await fetchSets(client);
    const setInfo = (sets as Array<{ id: string; name: string; images?: { logo?: string; symbol?: string } }>)
      .find((s) => s.id === setId);

    const resolvedCards: ResolvedCard[] = rawCards.map((c) => {
      const card = c as Record<string, unknown>;
      const images = card.images as Record<string, unknown> | undefined;
      const attacks = card.attacks as Array<{ name: string; damage: string; cost: string[] }> | undefined;
      const weaknesses = card.weaknesses as Array<{ type: string; value: string }> | undefined;
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
        attacks: attacks?.slice(0, 2) ?? undefined,
        weaknesses: weaknesses?.slice(0, 2) ?? undefined,
        retreatCost: (card.retreatCost as number) ?? undefined,
        marketValue: undefined, // calculated during reveal
      };
    });

    let sessionResult: Awaited<ReturnType<typeof createPackSession>>;
    try {
      sessionResult = await createPackSession(
        client,
        interaction.user.id,
        setId,
        setInfo?.name ?? chosenPack.itemName.replace(' Pack', ''),
        setInfo?.images?.logo ?? undefined,
        resolvedCards
      );
    } catch (e: any) {
      // Refund the pack — session creation failed
      await client.prisma.userInventory.upsert({
        where: { userId_itemId: { userId: interaction.user.id, itemId: chosenItemId } },
        update: { quantity: { increment: 1 } },
        create: { userId: interaction.user.id, itemId: chosenItemId, itemName: chosenPack.itemName, quantity: 1 },
      });
      const msg = e.message === 'REDIS_UNAVAILABLE'
        ? '❌ Pack reveal is temporarily unavailable (cache offline). Your pack has been refunded — try again in a moment.'
        : '❌ Failed to start pack session. Your pack has been refunded.';
      await selection.update({ content: msg, embeds: [], components: [] });
      return;
    }

    await selection.update({ embeds: [sessionResult.embed], components: [sessionResult.row] });

    // Fire-and-forget quest/achievement tracking for opening a pack
    incrementQuestProgress(client.prisma, interaction.user.id, 'open_pack', 1).catch(() => {});
    checkAndAwardAchievements(client, interaction.user.id, interaction.channelId, interaction.guild?.id).catch(() => {});
  } catch (e: any) {
    const isTimeout = e?.code === 'InteractionCollectorError' || e?.message?.includes('timeout');
    await interaction.editReply({
      content: isTimeout
        ? '⌛ Selection timed out. Use `/pack open` to try again.'
        : '❌ An error occurred. Please use `/pack open` to start again.',
      embeds: [],
      components: [],
    }).catch(() => {});
  }
}

export default command;
