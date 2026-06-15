import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const PAGE_SIZE = 10;
type Tab = 'summary' | 'last' | 'collection';

// ── Component builders ────────────────────────────────────────────────────────

function tabRow(active: Tab, collectionPage = 0) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('pdex:summary')
      .setLabel('📊 Summary')
      .setStyle(active === 'summary' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('pdex:last')
      .setLabel('⭐ Last Caught')
      .setStyle(active === 'last' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`pdex:collection:0`)
      .setLabel('📋 Collection')
      .setStyle(active === 'collection' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

function pageRow(page: number, totalPages: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pdex:prev:${page}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('pdex:pageinfo')
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`pdex:next:${page}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

// ── View builders (return { embeds, components }) ─────────────────────────────

async function buildSummary(
  client: BotClient,
  userId: string,
  username: string,
  avatarUrl: string,
) {
  const [caughtIds, totalPokemon, rarities, recentCatch] = await Promise.all([
    client.prisma.userPokemon.findMany({ where: { userId }, select: { pokemonId: true }, distinct: ['pokemonId'] }),
    client.prisma.pokemon.count(),
    client.prisma.userPokemon.findMany({ where: { userId }, include: { pokemon: { select: { rarity: true } } }, distinct: ['pokemonId'] }),
    client.prisma.userPokemon.findFirst({ where: { userId }, include: { pokemon: true }, orderBy: { caughtAt: 'desc' } }),
  ]);

  const caughtCount = caughtIds.length;
  const percent = totalPokemon > 0 ? ((caughtCount / totalPokemon) * 100).toFixed(1) : '0';
  const rarityCounts: Record<string, number> = {};
  for (const r of rarities) rarityCounts[r.pokemon.rarity] = (rarityCounts[r.pokemon.rarity] ?? 0) + 1;

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
    .setTimestamp();

  if (recentCatch?.pokemon.artworkUrl) {
    embed.setImage(recentCatch.pokemon.artworkUrl);
    embed.addFields({
      name: '⭐ Most Recently Caught',
      value: `**${recentCatch.pokemon.nameDisplay}**${recentCatch.isShiny ? ' ✨' : ''} (Lv.${recentCatch.level})`,
      inline: false,
    });
  }

  return { embeds: [embed], components: [tabRow('summary')] };
}

async function buildLastCaught(
  client: BotClient,
  userId: string,
  username: string,
) {
  const latest = await client.prisma.userPokemon.findFirst({
    where: { userId },
    include: { pokemon: true },
    orderBy: { caughtAt: 'desc' },
  });

  if (!latest) {
    return {
      embeds: [new EmbedBuilder()
        .setColor(0x888888)
        .setTitle(`⭐ ${username}'s Last Caught`)
        .setDescription('No Pokémon caught yet!\nUse `/hunt` or wait for a wild spawn.')],
      components: [tabRow('last')],
    };
  }

  const embed = new EmbedBuilder()
    .setColor(latest.isShiny ? 0xffd700 : 0xff0000)
    .setTitle(`⭐ Last Caught — ${latest.pokemon.nameDisplay}${latest.isShiny ? ' ✨ SHINY' : ''}`)
    .addFields(
      { name: '🎚️ Level',  value: `${latest.level}`,          inline: true },
      { name: '💫 Rarity', value: latest.pokemon.rarity,       inline: true },
      { name: '🕐 Caught', value: `<t:${Math.floor(latest.caughtAt.getTime() / 1000)}:R>`, inline: true },
    )
    .setTimestamp();

  if (latest.nickname) embed.addFields({ name: '📛 Nickname', value: latest.nickname, inline: true });
  if (latest.pokemon.artworkUrl) embed.setImage(latest.pokemon.artworkUrl);
  else if (latest.pokemon.spriteUrl) embed.setThumbnail(latest.pokemon.spriteUrl);

  return { embeds: [embed], components: [tabRow('last')] };
}

async function buildCollection(
  client: BotClient,
  userId: string,
  username: string,
  page: number,
) {
  const total = await client.prisma.userPokemon.count({ where: { userId } });

  if (total === 0) {
    return {
      embeds: [new EmbedBuilder()
        .setColor(0x888888)
        .setTitle(`📋 ${username}'s Collection`)
        .setDescription('No Pokémon caught yet!\nUse `/hunt` or wait for a wild spawn.')],
      components: [tabRow('collection')],
    };
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
    .setTitle(`📋 ${username}'s Collection`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${total} total caught` })
    .setTimestamp();

  if (featured?.pokemon.artworkUrl) embed.setImage(featured.pokemon.artworkUrl);
  else if (featured?.pokemon.spriteUrl) embed.setThumbnail(featured.pokemon.spriteUrl);

  const components: ActionRowBuilder<ButtonBuilder>[] = [tabRow('collection', page)];
  if (totalPages > 1) components.push(pageRow(page, totalPages));

  return { embeds: [embed], components };
}

// ── Command ───────────────────────────────────────────────────────────────────

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pokedex')
    .setDescription("Browse your Pokédex — use the tab buttons to switch views")
    .addUserOption((o) => o.setName('user').setDescription("View another trainer's Pokédex")),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') ?? interaction.user;
    const avatarUrl = target.displayAvatarURL();

    const initial = await buildSummary(client, target.id, target.username, avatarUrl);
    const reply = await interaction.editReply(initial);

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 120_000,
    });

    collector.on('collect', async (btn) => {
      await btn.deferUpdate();
      const [, action, param] = btn.customId.split(':');

      if (action === 'summary') {
        const view = await buildSummary(client, target.id, target.username, avatarUrl);
        await interaction.editReply(view);

      } else if (action === 'last') {
        const view = await buildLastCaught(client, target.id, target.username);
        await interaction.editReply(view);

      } else if (action === 'collection') {
        const page = parseInt(param ?? '0', 10);
        const view = await buildCollection(client, target.id, target.username, page);
        await interaction.editReply(view);

      } else if (action === 'prev') {
        const page = Math.max(0, parseInt(param, 10) - 1);
        const view = await buildCollection(client, target.id, target.username, page);
        await interaction.editReply(view);

      } else if (action === 'next') {
        const page = parseInt(param, 10) + 1;
        const view = await buildCollection(client, target.id, target.username, page);
        await interaction.editReply(view);
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};

export default command;
