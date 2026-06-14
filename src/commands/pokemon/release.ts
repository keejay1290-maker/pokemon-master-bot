import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber } from '../../utils/embeds.js';
import { addBalance, addXp } from '../../services/userService.js';

const RARITY_REFUND: Record<string, number> = {
  Legendary: 300,
  Mythical: 300,
  Epic: 150,
  Rare: 80,
  Uncommon: 40,
  Common: 20,
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('release')
    .setDescription('Release a Pokémon from your box and receive PokéCoins in return')
    .addStringOption((o) =>
      o.setName('id').setDescription('Pokémon ID from /box (first 8 characters)').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply({ ephemeral: true });
    const partialId = interaction.options.getString('id', true).toLowerCase();

    const up = await client.prisma.userPokemon.findFirst({
      where: { userId: interaction.user.id, id: { startsWith: partialId } },
      include: { pokemon: true },
    });

    if (!up) {
      await interaction.editReply({ content: `❌ No Pokémon found with ID \`${partialId}\`. Use **/box** to view your Pokémon IDs.` });
      return;
    }

    if (up.isInTeam) {
      await interaction.editReply({ content: `❌ **${up.nickname ?? up.pokemon.nameDisplay}** is in your battle team. Remove it first with **/team**.` });
      return;
    }

    if (up.isFavorite) {
      await interaction.editReply({ content: `❌ **${up.nickname ?? up.pokemon.nameDisplay}** is marked as a favourite. Unfavourite it first to prevent accidental release.` });
      return;
    }

    const isSpecial = up.pokemon.isLegendary || up.pokemon.isMythical;
    const refund = up.isShiny ? 500 : isSpecial ? RARITY_REFUND['Legendary'] : (RARITY_REFUND[up.pokemon.rarity] ?? 20);

    await client.prisma.userPokemon.delete({ where: { id: up.id } });
    await addBalance(client.prisma, interaction.user.id, refund);
    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, 5);

    const embed = new EmbedBuilder()
      .setColor(0x888888)
      .setTitle('👋 Pokémon Released')
      .setDescription(`**${up.isShiny ? '✨ ' : ''}${up.nickname ?? up.pokemon.nameDisplay}** was released back into the wild.`)
      .addFields(
        { name: '💰 Refund', value: `${formatNumber(refund)} PokéCoins`, inline: true },
        { name: '⭐ XP', value: '+5 XP', inline: true },
      )
      .setFooter({ text: `Rarity: ${up.pokemon.rarity}${up.isShiny ? ' • Shiny bonus applied' : ''}` })
      .setTimestamp();

    if (leveledUp) {
      embed.addFields({ name: '🎉 Level Up!', value: `You reached **Trainer Level ${newLevel}**!`, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
