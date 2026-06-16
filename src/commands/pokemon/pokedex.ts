import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { TypeColors, rarityEmoji, progressBar } from '../../utils/embeds.js';

const PAGE_SIZE = 10;
type Tab = 'summary' | 'selected' | 'collection' | 'favorites' | 'inspect';

// ── Component builders ────────────────────────────────────────────────────────

function tabRow(active: Tab) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('pdex:summary')
      .setLabel('📊 Summary')
      .setStyle(active === 'summary' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('pdex:selected')
      .setLabel('⚔️ Selected')
      .setStyle(active === 'selected' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('pdex:collection:0')
      .setLabel('📋 Collection')
      .setStyle(active === 'collection' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('pdex:favorites:0')
      .setLabel('❤️ Favorites')
      .setStyle(active === 'favorites' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
  return row;
}

function pageRow(page: number, totalPages: number, action: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pdex:prev:${page}:${action}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('pdex:pageinfo')
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`pdex:next:${page}:${action}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

function collectionFilterRow(currentFilter: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pdex:cfilter:all`)
      .setLabel('📋 All')
      .setStyle(currentFilter === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('pdex:cfilter:team')
      .setLabel('⚔️ Team')
      .setStyle(currentFilter === 'team' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('pdex:cfilter:favorites')
      .setLabel('❤️ Favorites')
      .setStyle(currentFilter === 'favorites' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('pdex:cfilter:shiny')
      .setLabel('✨ Shiny')
      .setStyle(currentFilter === 'shiny' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

// ── View builders ─────────────────────────────────────────────────────────────

async function buildSummary(
  client: BotClient,
  userId: string,
  username: string,
  avatarUrl: string,
) {
  const [caughtIds, totalPokemon, rarities, favoriteCount, teamCount, recentCatch] = await Promise.all([
    client.prisma.userPokemon.findMany({ where: { userId }, select: { pokemonId: true }, distinct: ['pokemonId'] }),
    client.prisma.pokemon.count(),
    client.prisma.userPokemon.findMany({ where: { userId }, include: { pokemon: { select: { rarity: true } } }, distinct: ['pokemonId'] }),
    client.prisma.userPokemon.count({ where: { userId, isFavorite: true } }),
    client.prisma.userPokemon.count({ where: { userId, isInTeam: true } }),
    client.prisma.userPokemon.findFirst({ where: { userId }, include: { pokemon: true }, orderBy: { caughtAt: 'desc' } }),
  ]);

  const caughtCount = caughtIds.length;
  const percent = totalPokemon > 0 ? ((caughtCount / totalPokemon) * 100).toFixed(1) : '0';
  const rarityCounts: Record<string, number> = {};
  for (const r of rarities) rarityCounts[r.pokemon.rarity] = (rarityCounts[r.pokemon.rarity] ?? 0) + 1;

  const fillBars = Math.round((caughtCount / Math.max(totalPokemon, 1)) * 20);
  const pBar = '█'.repeat(fillBars) + '░'.repeat(20 - fillBars);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`📖 ${username}'s Pokédex`)
    .setThumbnail(avatarUrl)
    .setDescription(`**${pBar}**\n${caughtCount}/${totalPokemon} Pokémon (${percent}%)`)
    .addFields(
      { name: '⚪ Common',    value: `${rarityCounts['Common']    ?? 0}`, inline: true },
      { name: '🟢 Uncommon',  value: `${rarityCounts['Uncommon']  ?? 0}`, inline: true },
      { name: '🔵 Rare',      value: `${rarityCounts['Rare']      ?? 0}`, inline: true },
      { name: '🟣 Epic',      value: `${rarityCounts['Epic']      ?? 0}`, inline: true },
      { name: '🟠 Legendary', value: `${rarityCounts['Legendary'] ?? 0}`, inline: true },
      { name: '🔴 Mythical',  value: `${rarityCounts['Mythical']  ?? 0}`, inline: true },
      { name: '❤️ Favorites', value: `${favoriteCount}`, inline: true },
      { name: '⚔️ Team Size', value: `${teamCount}/6`, inline: true },
      { name: '📊 Total Caught', value: `${caughtCount} unique`, inline: true },
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

async function buildSelected(client: BotClient, userId: string, username: string) {
  const team = await client.prisma.userPokemon.findMany({
    where: { userId, isInTeam: true },
    include: { pokemon: true },
    orderBy: { teamSlot: 'asc' },
    take: 6,
  });

  // Also fetch user stats for battle readiness
  const user = await client.prisma.user.findUnique({
    where: { id: userId },
    select: { battlesWon: true, battlesLost: true },
  });

  if (team.length === 0) {
    // Show the single most recent Pokemon as "selected"
    const latest = await client.prisma.userPokemon.findFirst({
      where: { userId },
      include: { pokemon: true },
      orderBy: { caughtAt: 'desc' },
    });
    if (!latest) {
      return {
        embeds: [new EmbedBuilder()
          .setColor(0x888888)
          .setTitle(`⚔️ ${username}'s Selected Pokémon`)
          .setDescription('No Pokémon yet! Use `/catch` to catch some.')],
        components: [tabRow('selected')],
      };
    }

    const totalIV = latest.ivHp + latest.ivAttack + latest.ivDefense + latest.ivSpAttack + latest.ivSpDefense + latest.ivSpeed;
    const ivPercent = Math.round((totalIV / 186) * 100);

    const embed = new EmbedBuilder()
      .setColor(TypeColors[latest.pokemon.type1] as number ?? 0xffcb05)
      .setTitle(`⚔️ ${username}'s Pokémon — ${latest.nickname ?? latest.pokemon.nameDisplay}`)
      .setDescription(`No team set. Use \`/team add\` to build a battle team.`)
      .addFields(
        { name: '🎚️ Level', value: `${latest.level}`, inline: true },
        { name: '💫 Rarity', value: `${rarityEmoji(latest.pokemon.rarity)} ${latest.pokemon.rarity}`, inline: true },
        { name: '💎 IVs', value: `${ivPercent}%`, inline: true },
        { name: '⚔️ Battles', value: `Won: ${user?.battlesWon ?? 0} | Lost: ${user?.battlesLost ?? 0}`, inline: false },
      )
      .setTimestamp();

    if (latest.pokemon.artworkUrl) embed.setImage(latest.pokemon.artworkUrl);
    return { embeds: [embed], components: [tabRow('selected')] };
  }

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`⚔️ ${username}'s Battle Team`)
    .setDescription(`**${team.length}/6** Pokémon ready for battle\n**Battle Record:** ${user?.battlesWon ?? 0}W / ${user?.battlesLost ?? 0}L`)
    .setTimestamp();

  for (const up of team) {
    const totalIV = up.ivHp + up.ivAttack + up.ivDefense + up.ivSpAttack + up.ivSpDefense + up.ivSpeed;
    const ivPercent = Math.round((totalIV / 186) * 100);
    const hpBar = progressBar(up.level * 10, 100);
    const shinyTag = up.isShiny ? '✨ ' : '';
    const favTag = up.isFavorite ? '❤️ ' : '';
    embed.addFields({
      name: `Slot ${up.teamSlot}: ${favTag}${shinyTag}${up.nickname ?? up.pokemon.nameDisplay}`,
      value: `Lv.${up.level} ${rarityEmoji(up.pokemon.rarity)} ${up.pokemon.rarity} | 💎 ${ivPercent}% | 🎚️ \`${hpBar}\``,
      inline: false,
    });
  }

  if (team[0]?.pokemon.artworkUrl) embed.setImage(team[0].pokemon.artworkUrl);

  return { embeds: [embed], components: [tabRow('selected')] };
}

async function buildCollection(
  client: BotClient,
  userId: string,
  username: string,
  page: number,
  filterType = 'all',
) {
  const where: Record<string, any> = { userId };
  if (filterType === 'favorites') where.isFavorite = true;
  if (filterType === 'team') where.isInTeam = true;
  if (filterType === 'shiny') where.isShiny = true;

  const total = await client.prisma.userPokemon.count({ where });

  if (total === 0) {
    const descMap: Record<string, string> = {
      all: 'No Pokémon caught yet!\nUse `/hunt` or wait for a wild spawn.',
      favorites: 'No favorites yet! Use `/favorite` to mark Pokémon as favorites.',
      team: 'No team members! Use `/team add` to add Pokémon to your team.',
      shiny: 'No shiny Pokémon! Keep hunting!',
    };
    return {
      embeds: [new EmbedBuilder()
        .setColor(0x888888)
        .setTitle(`📋 ${username}'s Collection`)
        .setDescription(descMap[filterType] ?? descMap.all)],
      components: [tabRow('collection'), collectionFilterRow(filterType)],
    };
  }

  const caught = await client.prisma.userPokemon.findMany({
    where,
    include: { pokemon: true },
    orderBy: [{ caughtAt: 'desc' }],
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const featured = caught[0];

  const lines = caught.map((up, i) => {
    const shinyTag = up.isShiny ? ' ✨' : '';
    const favTag = up.isFavorite ? '❤️ ' : '';
    const teamTag = up.isInTeam ? `⚔️` : '';
    const nickTag = up.nickname ? ` "${up.nickname}"` : '';
    return `**${page * PAGE_SIZE + i + 1}.** ${favTag}${teamTag} ${up.pokemon.nameDisplay}${shinyTag}${nickTag} — Lv.${up.level} ${rarityEmoji(up.pokemon.rarity)}`;
  });

  const filterLabel = filterType !== 'all' ? ` (${filterType})` : '';
  const embed = new EmbedBuilder()
    .setColor(filterType === 'favorites' ? 0xff69b4 : 0xff0000)
    .setTitle(`📋 ${username}'s Collection${filterLabel}`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${total} total` })
    .setTimestamp();

  if (featured?.pokemon.artworkUrl) embed.setImage(featured.pokemon.artworkUrl);
  else if (featured?.pokemon.spriteUrl) embed.setThumbnail(featured.pokemon.spriteUrl);

  const components: ActionRowBuilder<ButtonBuilder>[] = [tabRow('collection'), collectionFilterRow(filterType)];
  if (totalPages > 1) components.push(pageRow(page, totalPages, `collection:${filterType}`));

  return { embeds: [embed], components };
}

async function buildInspect(
  client: BotClient,
  userId: string,
  pokemonId: string,
) {
  const up = await client.prisma.userPokemon.findFirst({
    where: { id: pokemonId, userId },
    include: { pokemon: true },
  });
  if (!up) return null;

  const totalIV = up.ivHp + up.ivAttack + up.ivDefense + up.ivSpAttack + up.ivSpDefense + up.ivSpeed;
  const ivPercent = Math.round((totalIV / 186) * 100);
  const ivBar = '█'.repeat(Math.round(ivPercent / 5)) + '░'.repeat(20 - Math.round(ivPercent / 5));

  const embed = new EmbedBuilder()
    .setColor(up.isShiny ? 0xffd700 : up.isFavorite ? 0xff69b4 : (TypeColors[up.pokemon.type1] as number) ?? 0xffcb05)
    .setTitle(`${up.isShiny ? '✨ ' : ''}${up.nickname ?? up.pokemon.nameDisplay} #${up.pokemon.id.toString().padStart(3, '0')}`)
    .addFields(
      { name: '🎚️ Level', value: `${up.level}`, inline: true },
      { name: '💫 Rarity', value: `${rarityEmoji(up.pokemon.rarity)} ${up.pokemon.rarity}`, inline: true },
      { name: '💖 Favorite', value: up.isFavorite ? '❤️ Yes' : '♡ No', inline: true },
      { name: '⚔️ In Team', value: up.isInTeam ? `Slot ${up.teamSlot}` : 'Not in team', inline: true },
      { name: '🎾 Caught In', value: up.caughtIn ?? 'Unknown', inline: true },
      { name: '🧬 Nature', value: up.nature ?? 'Unknown', inline: true },
      { name: '📛 Nickname', value: up.nickname ?? 'None', inline: true },
      { name: `💎 IVs (${ivPercent}%)`, value: `\`${ivBar}\``, inline: false },
      { name: '📊 IV Breakdown', value: `HP: ${up.ivHp}/31 • ATK: ${up.ivAttack}/31 • DEF: ${up.ivDefense}/31\nSPA: ${up.ivSpAttack}/31 • SPD: ${up.ivSpDefense}/31 • SPE: ${up.ivSpeed}/31`, inline: false },
      { name: '🎯 Moves', value: up.moves?.length ? up.moves.map((m: string) => `• ${m.charAt(0).toUpperCase() + m.slice(1)}`).join('\n') : 'No moves known', inline: false },
    )
    .setFooter({ text: `Pokémon ID: ${pokemonId}` })
    .setTimestamp();

  if (up.pokemon.artworkUrl) embed.setImage(up.isShiny && up.pokemon.shinyArtworkUrl ? up.pokemon.shinyArtworkUrl : up.pokemon.artworkUrl);
  else if (up.pokemon.spriteUrl) embed.setThumbnail(up.pokemon.spriteUrl);

  return { embeds: [embed], components: [tabRow('inspect')] };
}

// ── Command ───────────────────────────────────────────────────────────────────

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pokedex')
    .setDescription("Browse your Pokédex — use the tab buttons to switch views")
    .addUserOption((o) => o.setName('user').setDescription("View another trainer's Pokédex"))
    .addStringOption((o) => o.setName('pokemon_id').setDescription('Inspect a specific Pokémon by ID (from /box)')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') ?? interaction.user;
    const inspectId = interaction.options.getString('pokemon_id');
    const avatarUrl = target.displayAvatarURL();

    // If a pokemon_id was provided, go straight to inspection view
    if (inspectId) {
      const view = await buildInspect(client, target.id, inspectId);
      if (!view) {
        await interaction.editReply({ content: '❌ Pokémon not found in your collection!' });
        return;
      }
      const reply = await interaction.editReply(view);
      const collector = reply.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 120_000,
      });

      collector.on('collect', (btn) => {
        btn.deferUpdate().then(async () => {
          const [, action] = btn.customId.split(':');
          if (action === 'summary') {
            const v = await buildSummary(client, target.id, target.username, avatarUrl);
            await interaction.editReply(v);
          } else if (action === 'selected') {
            const v = await buildSelected(client, target.id, target.username);
            await interaction.editReply(v);
          } else if (action === 'collection') {
            const v = await buildCollection(client, target.id, target.username, 0);
            await interaction.editReply(v);
          } else if (action === 'favorites') {
            const v = await buildCollection(client, target.id, target.username, 0, 'favorites');
            await interaction.editReply(v);
          }
        }).catch(() => {});
      });

      collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });
      return;
    }

    const initial = await buildSummary(client, target.id, target.username, avatarUrl);
    const reply = await interaction.editReply(initial);

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 120_000,
    });

    collector.on('collect', (btn) => {
      btn.deferUpdate().then(async () => {
        const parts = btn.customId.split(':');
        const action = parts[1];
        const param = parts[2];

        if (action === 'summary') {
          const v = await buildSummary(client, target.id, target.username, avatarUrl);
          await interaction.editReply(v);
        } else if (action === 'selected') {
          const v = await buildSelected(client, target.id, target.username);
          await interaction.editReply(v);
        } else if (action === 'collection') {
          const page = parseInt(param ?? '0', 10);
          const v = await buildCollection(client, target.id, target.username, page);
          await interaction.editReply(v);
        } else if (action === 'favorites') {
          const page = parseInt(param ?? '0', 10);
          const v = await buildCollection(client, target.id, target.username, page, 'favorites');
          await interaction.editReply(v);
        } else if (action === 'prev') {
          const page = Math.max(0, parseInt(param, 10) - 1);
          const [, , listType] = parts[3]?.split(':') ?? [];
          const filter = listType ?? 'all';
          const v = await buildCollection(client, target.id, target.username, page, filter);
          await interaction.editReply(v);
        } else if (action === 'next') {
          const page = parseInt(param, 10) + 1;
          const [, , listType] = parts[3]?.split(':') ?? [];
          const filter = listType ?? 'all';
          const v = await buildCollection(client, target.id, target.username, page, filter);
          await interaction.editReply(v);
        } else if (action === 'cfilter') {
          const filter = param ?? 'all';
          const v = await buildCollection(client, target.id, target.username, 0, filter);
          await interaction.editReply(v);
        }
      }).catch(() => {});
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};

export default command;