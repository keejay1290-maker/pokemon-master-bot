import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { rarityEmoji } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Manage your battle team')
    .addSubcommand((s) => s.setName('view').setDescription('View your current team'))
    .addSubcommand((s) => s.setName('add').setDescription('Add a Pokemon to your team')
      .addStringOption((o) => o.setName('pokemon_id').setDescription('Pokemon ID from /box').setRequired(true))
      .addIntegerOption((o) => o.setName('slot').setDescription('Team slot (1-6)').setRequired(true).setMinValue(1).setMaxValue(6)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove a Pokemon from your team')
      .addIntegerOption((o) => o.setName('slot').setDescription('Team slot to remove').setRequired(true).setMinValue(1).setMaxValue(6))),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const team = await client.prisma.userPokemon.findMany({
        where: { userId: interaction.user.id, isInTeam: true },
        include: { pokemon: true },
        orderBy: { teamSlot: 'asc' },
      });

      const embed = new EmbedBuilder().setColor(0xffcb05).setTitle(`⚔️ ${interaction.user.username}'s Team`);
      if (team.length === 0) {
        embed.setDescription('Your team is empty! Use `/team add` to add Pokemon.');
      } else {
        embed.setDescription(team.map((up) =>
          `Slot ${up.teamSlot}: ${up.isShiny ? '✨ ' : ''}**${up.nickname ?? up.pokemon.nameDisplay}** Lv.${up.level} ${rarityEmoji(up.pokemon.rarity)}`
        ).join('\n'));
      }
      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'add') {
      const pokemonId = interaction.options.getString('pokemon_id', true);
      const slot = interaction.options.getInteger('slot', true);

      const pokemon = await client.prisma.userPokemon.findFirst({ where: { id: pokemonId, userId: interaction.user.id }, include: { pokemon: true } });
      if (!pokemon) { await interaction.reply({ content: "Pokemon not found in your box!", ephemeral: true }); return; }

      await client.prisma.userPokemon.updateMany({ where: { userId: interaction.user.id, teamSlot: slot }, data: { isInTeam: false, teamSlot: null } });
      await client.prisma.userPokemon.update({ where: { id: pokemonId }, data: { isInTeam: true, teamSlot: slot } });

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Team Updated').setDescription(`**${pokemon.pokemon.nameDisplay}** added to slot ${slot}.`)] });

    } else if (sub === 'remove') {
      const slot = interaction.options.getInteger('slot', true);
      const removed = await client.prisma.userPokemon.updateMany({ where: { userId: interaction.user.id, teamSlot: slot }, data: { isInTeam: false, teamSlot: null } });
      if (removed.count === 0) { await interaction.reply({ content: 'No Pokemon in that slot.', ephemeral: true }); return; }
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Team Updated').setDescription(`Removed Pokemon from slot ${slot}.`)] });
    }
  },
};
export default command;
