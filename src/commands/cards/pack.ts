import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { openPack, fetchSets } from '../../services/pokemonTcgService.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { formatNumber } from '../../utils/embeds.js';

const PACK_COST = 500;
const PACK_COOLDOWN = 3600;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pack')
    .setDescription('Open a Pokemon card pack')
    .addStringOption((o) => o.setName('set').setDescription('Card set to open (optional)').setAutocomplete(true)),

  async autocomplete(interaction, client) {
    const sets = await fetchSets(client);
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = (sets as Array<{ id: string; name: string }>)
      .filter((s) => s.name.toLowerCase().includes(focused))
      .slice(0, 25);
    await interaction.respond(filtered.map((s) => ({ name: s.name, value: s.id })));
  },

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const setId = interaction.options.getString('set') ?? undefined;

    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'pack', PACK_COOLDOWN);
    if (onCooldown) {
      await interaction.editReply(`⏰ You can open another pack in **${remaining}s**.`);
      return;
    }

    const user = await client.prisma.user.findUnique({ where: { id: interaction.user.id } });
    if (!user || user.balance < PACK_COST) {
      await interaction.editReply(`❌ You need **${formatNumber(PACK_COST)} PokéCoins** to open a pack. You have ${formatNumber(user?.balance ?? 0)}.`);
      return;
    }

    const cards = await openPack(client, setId);
    if (cards.length === 0) {
      await interaction.editReply('❌ Could not fetch cards. Try again later.');
      return;
    }

    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { balance: { decrement: PACK_COST }, totalSpent: { increment: PACK_COST } },
    });
    await setCooldown(client, interaction.user.id, 'pack', PACK_COOLDOWN);

    // Save cards to collection
    for (const card of cards) {
      const c = card as Record<string, unknown>;
      await client.prisma.card.upsert({
        where: { id: c.id as string },
        update: {},
        create: {
          id: c.id as string,
          name: c.name as string,
          supertype: c.supertype as string,
          subtypes: (c.subtypes as string[]) ?? [],
          hp: c.hp as string ?? null,
          types: (c.types as string[]) ?? [],
          setId: (c.set as Record<string, unknown>)?.id as string ?? 'unknown',
          setName: (c.set as Record<string, unknown>)?.name as string ?? 'Unknown Set',
          number: c.number as string ?? '0',
          rarity: c.rarity as string ?? 'Common',
          artist: c.artist as string ?? null,
          imageSmall: ((c.images as Record<string, unknown>)?.small) as string ?? null,
          imageLarge: ((c.images as Record<string, unknown>)?.large) as string ?? null,
        },
      });

      await client.prisma.userCard.upsert({
        where: { userId_cardId_isFoil: { userId: interaction.user.id, cardId: c.id as string, isFoil: false } },
        update: { quantity: { increment: 1 } },
        create: { userId: interaction.user.id, cardId: c.id as string, quantity: 1, isFoil: false },
      });
    }

    await client.prisma.user.update({
      where: { id: interaction.user.id },
      data: { cardsCollected: { increment: cards.length } },
    });

    const rarityEmoji: Record<string, string> = {
      Common: '⚪', Uncommon: '🟢', Rare: '🔵', 'Rare Holo': '🔷',
      'Rare Ultra': '🟣', 'Illustration Rare': '🌟', 'Special Illustration Rare': '💎',
      'Hyper Rare': '🌈', 'Amazing Rare': '⭐',
    };

    const embed = new EmbedBuilder()
      .setColor(0xffcb05)
      .setTitle('📦 Pack Opened!')
      .setDescription(
        cards.map((card) => {
          const c = card as Record<string, unknown>;
          const rarity = c.rarity as string ?? 'Common';
          return `${rarityEmoji[rarity] ?? '⚪'} **${c.name}** — ${rarity}`;
        }).join('\n')
      )
      .setFooter({ text: `Cost: ${formatNumber(PACK_COST)} PokéCoins • Use /collection to view your cards` })
      .setTimestamp();

    // Show the best card image
    const bestCard = [...cards].sort((a, b) => {
      const order = ['Hyper Rare', 'Special Illustration Rare', 'Illustration Rare', 'Rare Ultra', 'Rare Holo', 'Rare'];
      return order.indexOf((b as Record<string, unknown>).rarity as string) - order.indexOf((a as Record<string, unknown>).rarity as string);
    })[0] as Record<string, unknown>;

    const imgUrl = (bestCard?.images as Record<string, unknown>)?.large as string;
    if (imgUrl) embed.setThumbnail(imgUrl);

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
