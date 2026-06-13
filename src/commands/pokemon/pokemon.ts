import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { fetchPokemonFromApi, fetchPokemonSpecies, parsePokeApiPokemon } from '../../services/pokeApiService.js';
import { TypeColors, typeEmoji, rarityEmoji, progressBar } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pokemon')
    .setDescription('Look up a Pokemon\'s information')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Pokemon name or dex number').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const results = await client.prisma.pokemon.findMany({
      where: { name: { contains: focused } },
      take: 25,
      select: { name: true, nameDisplay: true, id: true },
    });
    await interaction.respond(results.map((p) => ({ name: `#${p.id} ${p.nameDisplay}`, value: p.name })));
  },

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const query = interaction.options.getString('name', true).toLowerCase();

    let pokemon = await client.prisma.pokemon.findFirst({
      where: { OR: [{ name: query }, { nameDisplay: { contains: query, mode: 'insensitive' } }] },
    });

    if (!pokemon) {
      const apiData = await fetchPokemonFromApi(client, query);
      if (!apiData) {
        await interaction.editReply({ content: `❌ Pokemon "${query}" not found!` });
        return;
      }
      const parsed = parsePokeApiPokemon(apiData);
      pokemon = await client.prisma.pokemon.upsert({
        where: { id: parsed.id },
        update: {},
        create: {
          id: parsed.id,
          name: parsed.name,
          nameDisplay: parsed.nameDisplay,
          generation: 1,
          type1: parsed.type1,
          type2: parsed.type2,
          hp: parsed.hp, attack: parsed.attack, defense: parsed.defense,
          spAttack: parsed.spAttack, spDefense: parsed.spDefense, speed: parsed.speed,
          baseStatTotal: parsed.baseStatTotal,
          height: parsed.height, weight: parsed.weight,
          ability1: parsed.ability1, ability2: parsed.ability2, hiddenAbility: parsed.hiddenAbility,
          spriteUrl: parsed.spriteUrl, shinySpriteUrl: parsed.shinySpriteUrl,
          artworkUrl: parsed.artworkUrl, shinyArtworkUrl: parsed.shinyArtworkUrl,
          rarity: 'Common', spawnWeight: 100, catchRate: 45,
        },
      });
    }

    const species = await fetchPokemonSpecies(client, pokemon.id).catch(() => null);
    const description = (species?.flavor_text_entries as Array<{ flavor_text: string; language: { name: string } }>)
      ?.find((e) => e.language.name === 'en')?.flavor_text?.replace(/\f/g, ' ') ?? 'No description available.';

    const maxStat = 255;
    const embed = new EmbedBuilder()
      .setColor((TypeColors[pokemon.type1] as number) ?? 0xffcb05)
      .setTitle(`#${pokemon.id.toString().padStart(3, '0')} ${pokemon.nameDisplay}`)
      .setDescription(description)
      .setThumbnail(pokemon.artworkUrl ?? null)
      .addFields(
        {
          name: 'Type',
          value: [pokemon.type1, pokemon.type2].filter(Boolean).map((t) => `${typeEmoji(t!)} ${t!.charAt(0).toUpperCase() + t!.slice(1)}`).join(' / '),
          inline: true,
        },
        { name: 'Height / Weight', value: `${pokemon.height}m / ${pokemon.weight}kg`, inline: true },
        { name: 'Catch Rate', value: `${pokemon.catchRate}/255`, inline: true },
        {
          name: 'Abilities',
          value: [
            pokemon.ability1,
            pokemon.ability2,
            pokemon.hiddenAbility ? `${pokemon.hiddenAbility} *(hidden)*` : null,
          ].filter(Boolean).map((a) => `• ${a}`).join('\n'),
          inline: false,
        },
        {
          name: `Base Stats (Total: ${pokemon.baseStatTotal})`,
          value: [
            `HP:  \`${progressBar(pokemon.hp, maxStat)}\` ${pokemon.hp}`,
            `ATK: \`${progressBar(pokemon.attack, maxStat)}\` ${pokemon.attack}`,
            `DEF: \`${progressBar(pokemon.defense, maxStat)}\` ${pokemon.defense}`,
            `SPA: \`${progressBar(pokemon.spAttack, maxStat)}\` ${pokemon.spAttack}`,
            `SPD: \`${progressBar(pokemon.spDefense, maxStat)}\` ${pokemon.spDefense}`,
            `SPE: \`${progressBar(pokemon.speed, maxStat)}\` ${pokemon.speed}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Rarity',
          value: `${rarityEmoji(pokemon.rarity)} ${pokemon.rarity}`,
          inline: true,
        }
      )
      .setFooter({ text: `Powered by PokeAPI` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
