import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import {
  configuredSpawnChannelIds,
  findPokemonForManualSpawn,
  spawnPokemon,
} from '../../services/spawnService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('spawn')
    .setDescription('Control wild Pokémon encounters')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) => subcommand
      .setName('now')
      .setDescription('Force one or more encounters immediately')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Target one channel instead of the configured spawn channels')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addIntegerOption((option) => option
        .setName('count')
        .setDescription('Number of encounters to create (1-10)')
        .setMinValue(1)
        .setMaxValue(10))
      .addStringOption((option) => option
        .setName('pokemon')
        .setDescription('Optional Pokédex number or exact Pokémon name'))
      .addBooleanOption((option) => option
        .setName('all_channels')
        .setDescription('Spawn once in every configured channel')))
    .addSubcommand((subcommand) => subcommand
      .setName('channels')
      .setDescription('Add, remove, clear, or list spawn channels')
      .addStringOption((option) => option
        .setName('action')
        .setDescription('Channel configuration action')
        .setRequired(true)
        .addChoices(
          { name: 'Add channel', value: 'add' },
          { name: 'Remove channel', value: 'remove' },
          { name: 'Clear all', value: 'clear' },
          { name: 'List channels', value: 'list' },
        ))
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Channel to add or remove')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand((subcommand) => subcommand
      .setName('settings')
      .setDescription('Tune automatic spawn behavior')
      .addBooleanOption((option) => option.setName('enabled').setDescription('Enable automatic encounters'))
      .addIntegerOption((option) => option
        .setName('rate')
        .setDescription('Chance per human message, as a percentage (1-100)')
        .setMinValue(1)
        .setMaxValue(100))
      .addIntegerOption((option) => option
        .setName('cooldown')
        .setDescription('Minimum seconds between automatic spawn waves (10-3600)')
        .setMinValue(10)
        .setMaxValue(3600))
      .addStringOption((option) => option
        .setName('mode')
        .setDescription('Choose one configured channel or spawn a wave in all of them')
        .addChoices(
          { name: 'Random configured channel', value: 'random' },
          { name: 'All configured channels', value: 'all' },
        )))
    .addSubcommand((subcommand) => subcommand
      .setName('status')
      .setDescription('Show spawn health and active encounters')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild || !interaction.channel || !interaction.channel.isTextBased()) return;
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
    if (!guild) {
      await interaction.editReply('Server configuration was not found.');
      return;
    }

    if (subcommand === 'now') {
      const requestedChannel = interaction.options.getChannel('channel');
      const allChannels = interaction.options.getBoolean('all_channels') ?? false;
      const count = interaction.options.getInteger('count') ?? 1;
      const pokemonQuery = interaction.options.getString('pokemon');
      const forcedPokemon = pokemonQuery ? await findPokemonForManualSpawn(client, pokemonQuery) : undefined;
      if (pokemonQuery && !forcedPokemon) {
        await interaction.editReply(`No Pokémon matched **${pokemonQuery}**. Use an exact name or Pokédex number.`);
        return;
      }

      const configured = configuredSpawnChannelIds(guild);
      const targets = requestedChannel
        ? [requestedChannel.id]
        : allChannels && configured.length > 0
          ? configured
          : configured.length > 0
            ? [configured[Math.floor(Math.random() * configured.length)]]
            : [interaction.channel.id];

      const jobs: Array<Promise<Awaited<ReturnType<typeof spawnPokemon>>>> = [];
      if (allChannels && !requestedChannel) {
        for (const channelId of targets) jobs.push(spawnPokemon(client, guild.id, channelId, forcedPokemon ?? undefined));
      } else {
        for (let index = 0; index < count; index++) {
          jobs.push(spawnPokemon(client, guild.id, targets[index % targets.length], forcedPokemon ?? undefined));
        }
      }
      const results = (await Promise.all(jobs)).filter((result): result is NonNullable<typeof result> => Boolean(result));
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(results.length ? 0x00c853 : 0xd32f2f)
          .setTitle(results.length ? '⚡ Wild encounter forced' : '❌ No encounters created')
          .setDescription(results.length
            ? results.map((result) => `• **${result.pokemonName}** in <#${result.channelId}>`).join('\n')
            : 'Check that the bot can view the channel, send messages, and embed links.')
          .setFooter({ text: `Requested by ${interaction.user.username} • Automatic toggle is bypassed for manual spawns` })],
      });
      return;
    }

    if (subcommand === 'channels') {
      const action = interaction.options.getString('action', true);
      const channel = interaction.options.getChannel('channel');
      let channelIds = configuredSpawnChannelIds(guild);

      if ((action === 'add' || action === 'remove') && !channel) {
        await interaction.editReply('Choose a channel for that action.');
        return;
      }
      if (action === 'add' && channel && !channelIds.includes(channel.id)) channelIds.push(channel.id);
      if (action === 'remove' && channel) channelIds = channelIds.filter((id) => id !== channel.id);
      if (action === 'clear') channelIds = [];

      if (action !== 'list') {
        await client.prisma.guild.update({
          where: { id: guild.id },
          data: { spawnChannelIds: channelIds, pokeSpawnsChannelId: null },
        });
      }
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x3b82f6)
          .setTitle('🌿 Wild encounter channels')
          .setDescription(channelIds.length
            ? channelIds.map((id, index) => `${index + 1}. <#${id}>`).join('\n')
            : 'No dedicated channels. Automatic encounters fall back to the channel where activity occurs.')
          .setFooter({ text: `${channelIds.length} configured channel${channelIds.length === 1 ? '' : 's'}` })],
      });
      return;
    }

    if (subcommand === 'settings') {
      const enabled = interaction.options.getBoolean('enabled');
      const rate = interaction.options.getInteger('rate');
      const cooldown = interaction.options.getInteger('cooldown');
      const mode = interaction.options.getString('mode');
      const updated = await client.prisma.guild.update({
        where: { id: guild.id },
        data: {
          spawnEnabled: enabled ?? undefined,
          spawnRate: rate ?? undefined,
          spawnCooldown: cooldown ?? undefined,
          spawnMode: mode ?? undefined,
        },
      });
      await interaction.editReply({
        embeds: [spawnStatusEmbed(updated, await activeSpawnCount(client, guild.id))
          .setTitle('✅ Spawn settings updated')],
      });
      return;
    }

    await interaction.editReply({
      embeds: [spawnStatusEmbed(guild, await activeSpawnCount(client, guild.id))],
    });
  },
};

async function activeSpawnCount(client: BotClient, guildId: string) {
  return client.prisma.spawn.count({
    where: { guildId, isCaught: false, expiresAt: { gt: new Date() } },
  });
}

function spawnStatusEmbed(guild: {
  spawnEnabled: boolean;
  spawnRate: number;
  spawnCooldown: number;
  spawnMode: string;
  spawnChannelIds: string[];
  pokeSpawnsChannelId: string | null;
}, active: number) {
  const channels = configuredSpawnChannelIds(guild);
  return new EmbedBuilder()
    .setColor(guild.spawnEnabled ? 0x00c853 : 0x607d8b)
    .setTitle('🌿 Wild encounter status')
    .addFields(
      { name: 'Automatic spawns', value: guild.spawnEnabled ? '✅ Enabled' : '⏸️ Disabled', inline: true },
      { name: 'Activity chance', value: `${guild.spawnRate}% per message`, inline: true },
      { name: 'Wave cooldown', value: `${guild.spawnCooldown}s`, inline: true },
      { name: 'Channel mode', value: guild.spawnMode === 'all' ? 'All channels (wave)' : 'One random channel', inline: true },
      { name: 'Active encounters', value: `${active}`, inline: true },
      { name: 'Redis acceleration', value: 'Optional; database fallback enabled', inline: true },
      { name: `Configured channels (${channels.length})`, value: channels.length ? channels.map((id) => `<#${id}>`).join(', ') : 'Activity channel fallback', inline: false },
    )
    .setTimestamp();
}

export default command;
