import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const PAGE_SIZE = 10;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pokedex')
    .setDescription('Browse your Pokédex — caught Pokémon with sprites and stats')
    .addStringOption((o) =>
      o.setName('view')
        .setDescription('What to show')
        .addChoices(
          { name: '📊 Summary', value: 'summary' },
          { name: '🖼️ Recent Catches (with images)', value: 'recent' },
        )
    )
    .addUserOption((o) => o.setName('user').setDescription("View another trainer's Pokédex")),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const view = interaction.options.getString('view') ?? 'summary';
    const target = interaction.options.getUser('user') ?? interaction.user;

    if (view === 'recent') {
      await showRecentCatches(interaction, client, target.id, target.username, 0);
    } else {
      await showSummary(interaction, client, target.id, target.username, target.displayAvatarURL());
    }
  },
};

async function showSummary(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  userId: string,
  username: string,
  avatarUrl: string,
) {
  const [caughtIds, totalPokemon, rarities, recentCatch] = await Promise.all([
    client.prisma.userPokemon.findMany({
      where: { userId },
      select: { pokemonId: true },
      distinct: ['pokemonId'],
    }),
    client.prisma.pokemon.count(),
    client.prisma.userPokemon.findMany({
      where: { userId },
      include: { pokemon: { select: { rarity: true } } },
      distinct: ['pokemonId'],
    }),
    client.prisma.userPokemon.findFirst({
      where: { userId },
      include: { pokemon: true },
      orderBy: { caughtAt: 'desc' },
    }),
  ]);

  const caughtCount = caughtIds.length;
  const percent = totalPokemon > 0 ? ((caughtCount / totalPokemon) * 100).toFixed(1) : '0';

  const rarityCounts: Record<string, number> = {};
  for (const r of rarities) {
    rarityCounts[r.pokemon.rarity] = (rarityCounts[r.pokemon.rarity] ?? 0) + 1;
  }

  const shinyCaught = rarities.filter((r) => (r as any).isShiny).length;

  const fillBars = Math.round((caughtCount / Math.max(totalPokemon, 1)) * 20);
  const progressBar = '█'.repeat(fillBars) + '░'.repeat(20 - fillBars);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`📖 ${username}'s Pokédex`)
    .setThumbnail(avatarUrl)
    .setDescription(`**${progressBar}**\n${caughtCount}/${totalPokemon} Pokémon (${percent}%)`)
    .addFields(
      { name: '⚪ Common',    value: `${rarityCounts['Common']    ?? 0}`, inline: true },
      { name: '🟢 Uncommon',  value: `${rarityCounts['Uncommon']  ?? 0}`, inline: true },
      { name: '🔵 Rare',      value: `${rarityCounts['Rare']      ?? 0}`, inline: true },
      { name: '🟣 Epic',      value: `${rarityCounts['Epic']      ?? 0}`, inline: true },
      { name: '🟠 Legendary', value: `${rarityCounts['Legendary'] ?? 0}`, inline: true },
      { name: '🔴 Mythical',  value: `${rarityCounts['Mythical']  ?? 0}`, inline: true },
    )
    .setFooter({ text: 'Use /pokedex view:Recent Catches to see Pokémon with images' })
    .setTimestamp();

  if (recentCatch?.pokemon.artworkUrl) {
    embed.setImage(recentCatch.pokemon.artworkUrl);
    embed.addFields({
      name: '⭐ Most Recently Caught',
      value: `**${recentCatch.pokemon.nameDisplay}**${recentCatch.isShiny ? ' ✨' : ''} (Lv.${recentCatch.level})`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function showRecentCatches(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  userId: string,
  username: string,
  page: number,
) {
  const total = await client.prisma.userPokemon.count({ where: { userId } });

  if (total === 0) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x888888)
        .setTitle(`📖 ${username}'s Pokédex`)
        .setDescription('No Pokémon caught yet! Use `/hunt`, `/catch`, or wait for a wild spawn.')],
    });
    return;
  }

  const caught = await client.prisma.userPokemon.findMany({
    where: { userId },
    include: { pokemon: true },
    orderBy: { caughtAt: 'desc' },
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const featured = caught[0];

  const lines = caught.map((up, i) => {
    const shinyTag = up.isShiny ? ' ✨' : '';
    const nickTag = up.nickname ? ` "${up.nickname}"` : '';
    return `**${page * PAGE_SIZE + i + 1}.** ${up.pokemon.nameDisplay}${shinyTag}${nickTag} — Lv.${up.level} • ${up.pokemon.rarity}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`📖 ${username}'s Recent Catches`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${total} total caught` })
    .setTimestamp();

  if (featured?.pokemon.artworkUrl) {
    embed.setImage(featured.pokemon.artworkUrl);
  } else if (featured?.pokemon.spriteUrl) {
    embed.setThumbnail(featured.pokemon.spriteUrl);
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pokedex_prev:${userId}:${page}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`pokedex_page:${userId}:${page}`)
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`pokedex_next:${userId}:${page}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  const reply = await interaction.editReply({ embeds: [embed], components: [row] });

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
    filter: (btn) => btn.user.id === interaction.user.id,
  });

  collector.on('collect', async (btn) => {
    await btn.deferUpdate();
    const parts = btn.customId.split(':');
    const currentPage = parseInt(parts[2], 10);
    const newPage = btn.customId.startsWith('pokedex_prev') ? currentPage - 1 : currentPage + 1;

    const newCaught = await client.prisma.userPokemon.findMany({
      where: { userId },
      include: { pokemon: true },
      orderBy: { caughtAt: 'desc' },
      skip: newPage * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    const newFeatured = newCaught[0];
    const newLines = newCaught.map((up, i) => {
      const shinyTag = up.isShiny ? ' ✨' : '';
      const nickTag = up.nickname ? ` "${up.nickname}"` : '';
      return `**${newPage * PAGE_SIZE + i + 1}.** ${up.pokemon.nameDisplay}${shinyTag}${nickTag} — Lv.${up.level} • ${up.pokemon.rarity}`;
    });

    const newEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`📖 ${username}'s Recent Catches`)
      .setDescription(newLines.join('\n'))
      .setFooter({ text: `Page ${newPage + 1}/${totalPages} • ${total} total caught` })
      .setTimestamp();

    if (newFeatured?.pokemon.artworkUrl) {
      newEmbed.setImage(newFeatured.pokemon.artworkUrl);
    } else if (newFeatured?.pokemon.spriteUrl) {
      newEmbed.setThumbnail(newFeatured.pokemon.spriteUrl);
    }

    const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`pokedex_prev:${userId}:${newPage}`)
        .setLabel('◀ Prev')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0),
      new ButtonBuilder()
        .setCustomId(`pokedex_page:${userId}:${newPage}`)
        .setLabel(`${newPage + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`pokedex_next:${userId}:${newPage}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1),
    );

    await interaction.editReply({ embeds: [newEmbed], components: [newRow] });
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
}

export default command;
