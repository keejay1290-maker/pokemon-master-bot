import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('protect')
    .setDescription('Protect or unprotect a captured Pokémon from transfers')
    .addStringOption((option) =>
      option
        .setName('pokemon')
        .setDescription('Choose one of your captured Pokémon')
        .setAutocomplete(true)
        .setRequired(true)
    ),

  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const owned = await client.prisma.userPokemon.findMany({
      where: { userId: interaction.user.id },
      include: { pokemon: true },
      orderBy: { caughtAt: 'desc' },
      take: 50,
    });
    await interaction.respond(owned
      .map((entry) => {
        const name = entry.nickname ?? entry.pokemon.nameDisplay;
        return {
          name: `${entry.isLocked ? '🔒' : '🔓'} ${entry.isShiny ? '✨ ' : ''}${name} • Lv.${entry.level}`,
          value: entry.id,
          search: `${name} ${entry.pokemon.nameDisplay}`.toLowerCase(),
        };
      })
      .filter((choice) => !focused || choice.search.includes(focused))
      .slice(0, 25)
      .map(({ name, value }) => ({ name: name.slice(0, 100), value })));
  },

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const ownershipId = interaction.options.getString('pokemon', true);
    const owned = await client.prisma.userPokemon.findFirst({
      where: { id: ownershipId, userId: interaction.user.id },
      include: { pokemon: true },
    });
    if (!owned) {
      await interaction.reply({ content: 'Choose one of your Pokémon from autocomplete.', ephemeral: true });
      return;
    }
    const battleLock = await client.prisma.battleParticipantLock.findUnique({
      where: { userId: interaction.user.id },
    });
    if (battleLock) {
      await interaction.reply({
        content: 'You cannot change Pokémon protection while a battle or ranked challenge is in progress.',
        ephemeral: true,
      });
      return;
    }

    const updated = await client.prisma.userPokemon.update({
      where: { id: owned.id },
      data: { isLocked: !owned.isLocked },
    });
    const displayName = owned.nickname ?? owned.pokemon.nameDisplay;
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(updated.isLocked ? 0x5865f2 : 0x808080)
        .setTitle(updated.isLocked ? '🔒 Pokémon Protected' : '🔓 Protection Removed')
        .setDescription(updated.isLocked
          ? `**${displayName}** cannot be gifted or transferred while protected.`
          : `**${displayName}** may now be gifted if it is not favorited, on a team, listed, or in battle.`)],
      ephemeral: true,
    });
  },
};

export default command;
