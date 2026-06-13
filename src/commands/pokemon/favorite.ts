import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('favorite')
    .setDescription('Mark a Pokemon as favorite')
    .addStringOption((o) => o.setName('pokemon_id').setDescription('Pokemon ID from /box').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const pokemonId = interaction.options.getString('pokemon_id', true);
    const pokemon = await client.prisma.userPokemon.findFirst({ where: { id: pokemonId, userId: interaction.user.id }, include: { pokemon: true } });
    if (!pokemon) { await interaction.reply({ content: "You don't own that Pokemon!", ephemeral: true }); return; }

    const updated = await client.prisma.userPokemon.update({ where: { id: pokemonId }, data: { isFavorite: !pokemon.isFavorite } });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(updated.isFavorite ? 0xff69b4 : 0x808080)
        .setTitle(updated.isFavorite ? '❤️ Favorited!' : '💔 Unfavorited')
        .setDescription(`**${pokemon.pokemon.nameDisplay}** ${updated.isFavorite ? 'added to' : 'removed from'} favorites.`)],
    });
  },
};
export default command;
