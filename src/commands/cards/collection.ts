import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const RARITY_ORDER = ['Hyper Rare', 'Special Illustration Rare', 'Illustration Rare', 'Amazing Rare', 'Rare Ultra', 'Rare Holo', 'Rare', 'Uncommon', 'Common'];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('View your Pokémon card collection and estimated market value')
    .addUserOption((o) => o.setName('user').setDescription("View another trainer's collection")),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') ?? interaction.user;

    // Recent 15 for display
    const [recentCards, total, allCards] = await Promise.all([
      client.prisma.userCard.findMany({
        where: { userId: target.id },
        include: { card: true },
        orderBy: { obtainedAt: 'desc' },
        take: 15,
      }),
      client.prisma.userCard.count({ where: { userId: target.id } }),
      client.prisma.userCard.findMany({
        where: { userId: target.id },
        include: { card: { select: { rarity: true, marketValue: true } } },
      }),
    ]);

    // Collection value: sum(quantity * marketValue)
    const collectionValue = allCards.reduce(
      (sum, uc) => sum + uc.quantity * (uc.card.marketValue ?? 0),
      0
    );

    // Rarity breakdown
    const rarityBreakdown: Record<string, number> = {};
    for (const uc of allCards) {
      const r = uc.card.rarity;
      rarityBreakdown[r] = (rarityBreakdown[r] ?? 0) + uc.quantity;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🃏 ${target.username}'s Card Collection`)
      .setThumbnail(target.displayAvatarURL());

    if (recentCards.length === 0) {
      embed.setDescription('No cards yet! Use `/pack` to open some.');
    } else {
      embed.setDescription(
        recentCards.map((uc) => {
          const val = uc.card.marketValue != null ? ` — $${uc.card.marketValue.toFixed(2)}` : '';
          return `**${uc.card.name}** — ${uc.card.rarity} (x${uc.quantity})${val}`;
        }).join('\n')
      );
    }

    embed.addFields(
      { name: '📦 Total Cards', value: total.toLocaleString(), inline: true },
      { name: '💰 Est. Value', value: collectionValue > 0 ? `$${collectionValue.toFixed(2)}` : 'No prices yet', inline: true },
    );

    const breakdown = RARITY_ORDER
      .filter((r) => rarityBreakdown[r])
      .map((r) => `${r}: ${rarityBreakdown[r]}`)
      .join(' | ');
    if (breakdown) {
      embed.addFields({ name: '📊 Rarity Breakdown', value: breakdown, inline: false });
    }

    embed.setFooter({ text: 'Market prices from TCGplayer. Use /pack to open more cards!' });

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
