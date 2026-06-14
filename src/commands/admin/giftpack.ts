import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { openPack, fetchSets } from '../../services/pokemonTcgService.js';
import { ensureUser } from '../../services/userService.js';

const MAX_QUANTITY = 20;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('giftpack')
    .setDescription('Gift TCG card packs to a user (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) =>
      o.setName('user').setDescription('User to gift packs to').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('set').setDescription('Card set to gift').setAutocomplete(true).setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName('quantity').setDescription(`Number of packs to gift (1–${MAX_QUANTITY})`).setMinValue(1).setMaxValue(MAX_QUANTITY).setRequired(true)
    ),

  async autocomplete(interaction, client) {
    const sets = await fetchSets(client);
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = (sets as Array<{ id: string; name: string }>)
      .filter((s) => s.name.toLowerCase().includes(focused))
      .slice(0, 25);
    await interaction.respond(filtered.map((s) => ({ name: s.name, value: s.id })));
  },

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;

    // Allow server owner even if no Administrator role
    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    if (!isOwner && !isAdmin) {
      await interaction.reply({ content: '❌ Administrator permission required.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const setId = interaction.options.getString('set', true);
    const quantity = interaction.options.getInteger('quantity', true);

    // Ensure target user exists in DB
    await ensureUser(client.prisma, target);

    // Validate set exists
    const sets = await fetchSets(client);
    const setData = (sets as Array<{ id: string; name: string }>).find((s) => s.id === setId);
    if (!setData) {
      await interaction.editReply('❌ Set not found. Use autocomplete to select a valid set.');
      return;
    }

    const allCards: Array<Record<string, unknown>> = [];
    const rarityBreakdown: Record<string, number> = {};

    for (let i = 0; i < quantity; i++) {
      const cards = await openPack(client, setId);
      allCards.push(...cards);
    }

    if (allCards.length === 0) {
      await interaction.editReply('❌ Could not fetch cards from the TCG API. Try again later.');
      return;
    }

    // Persist all cards to target user's collection
    for (const card of allCards) {
      const c = card as Record<string, unknown>;
      const tcgprices = (c.tcgplayer as Record<string, unknown> | null)?.prices as Record<string, Record<string, number>> | null;
      const marketValue =
        tcgprices?.holofoil?.market ??
        tcgprices?.normal?.market ??
        tcgprices?.reverseHolofoil?.market ??
        null;

      await client.prisma.card.upsert({
        where: { id: c.id as string },
        update: { marketValue: marketValue ?? undefined },
        create: {
          id: c.id as string,
          name: c.name as string,
          supertype: c.supertype as string,
          subtypes: (c.subtypes as string[]) ?? [],
          hp: (c.hp as string) ?? null,
          types: (c.types as string[]) ?? [],
          setId: ((c.set as Record<string, unknown>)?.id as string) ?? 'unknown',
          setName: ((c.set as Record<string, unknown>)?.name as string) ?? setData.name,
          number: (c.number as string) ?? '0',
          rarity: (c.rarity as string) ?? 'Common',
          artist: (c.artist as string) ?? null,
          imageSmall: ((c.images as Record<string, unknown>)?.small) as string ?? null,
          imageLarge: ((c.images as Record<string, unknown>)?.large) as string ?? null,
          marketValue,
        },
      });

      await client.prisma.userCard.upsert({
        where: { userId_cardId_isFoil: { userId: target.id, cardId: c.id as string, isFoil: false } },
        update: { quantity: { increment: 1 } },
        create: { userId: target.id, cardId: c.id as string, quantity: 1, isFoil: false },
      });

      const rarity = (c.rarity as string) ?? 'Common';
      rarityBreakdown[rarity] = (rarityBreakdown[rarity] ?? 0) + 1;
    }

    await client.prisma.user.update({
      where: { id: target.id },
      data: { cardsCollected: { increment: allCards.length } },
    });

    // Audit log
    await client.prisma.auditLog.create({
      data: {
        guildId: interaction.guild.id,
        action: 'GIFT_PACK',
        targetId: target.id,
        moderatorId: interaction.user.id,
        metadata: { setId, setName: setData.name, quantity, cardsGifted: allCards.length },
      },
    });

    const rarityLines = Object.entries(rarityBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([r, count]) => `${r}: **${count}**`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle('🎁 Packs Gifted!')
      .addFields(
        { name: 'Recipient', value: `<@${target.id}>`, inline: true },
        { name: 'Set', value: setData.name, inline: true },
        { name: 'Packs', value: `${quantity} (${allCards.length} cards)`, inline: true },
        { name: 'Card Breakdown', value: rarityLines || 'None', inline: false },
      )
      .setFooter({ text: `Gifted by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Notify the recipient
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🎁 You received card packs!')
        .setDescription(`An admin gifted you **${quantity} ${setData.name} pack${quantity > 1 ? 's' : ''}** (${allCards.length} cards)!\nCheck your collection with \`/collection\`.`)
        .setTimestamp();
      await target.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch {
      // DMs may be closed — not a failure
    }
  },
};

export default command;
