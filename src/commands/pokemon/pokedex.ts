import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { typeEmoji, rarityEmoji } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pokedex')
    .setDescription('View your Pokedex progress'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const userId = interaction.user.id;

    const caughtIds = await client.prisma.userPokemon.findMany({ where: { userId }, select: { pokemonId: true }, distinct: ['pokemonId'] });
    const caughtSet = new Set(caughtIds.map((p) => p.pokemonId));
    const totalPokemon = await client.prisma.pokemon.count();
    const caughtCount = caughtSet.size;

    const byType = await client.prisma.userPokemon.groupBy({
      by: ['pokemonId'],
      where: { userId },
    });

    const rarities = await client.prisma.userPokemon.findMany({
      where: { userId },
      include: { pokemon: { select: { rarity: true } } },
      distinct: ['pokemonId'],
    });
    const rarityCounts: Record<string, number> = {};
    for (const r of rarities) {
      rarityCounts[r.pokemon.rarity] = (rarityCounts[r.pokemon.rarity] ?? 0) + 1;
    }

    const percent = totalPokemon > 0 ? ((caughtCount / totalPokemon) * 100).toFixed(1) : '0';

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`📖 ${interaction.user.username}'s Pokédex`)
      .addFields(
        { name: '📊 Completion', value: `${caughtCount}/${totalPokemon} (${percent}%)`, inline: true },
        { name: '⚪ Common', value: `${rarityCounts['Common'] ?? 0}`, inline: true },
        { name: '🟢 Uncommon', value: `${rarityCounts['Uncommon'] ?? 0}`, inline: true },
        { name: '🔵 Rare', value: `${rarityCounts['Rare'] ?? 0}`, inline: true },
        { name: '🟣 Epic', value: `${rarityCounts['Epic'] ?? 0}`, inline: true },
        { name: '🟠 Legendary', value: `${rarityCounts['Legendary'] ?? 0}`, inline: true },
        { name: '🔴 Mythical', value: `${rarityCounts['Mythical'] ?? 0}`, inline: true },
      )
      .setFooter({ text: 'Keep catching to complete your Pokédex!' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
