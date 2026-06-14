import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ComponentType,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { addXp } from '../../services/userService.js';
import { checkAndAwardAchievements } from '../../services/achievementService.js';

const EVOLVE_XP = 100;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('evolve')
    .setDescription('Evolve a Pokémon that meets its evolution conditions'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();

    // Find all user Pokémon that have an evolution available
    const userPokemon = await client.prisma.userPokemon.findMany({
      where: { userId: interaction.user.id },
      include: {
        pokemon: {
          include: {
            evolvesInto: {
              select: { id: true, name: true, nameDisplay: true, evolutionLevel: true, evolutionItem: true, evolutionCondition: true, artworkUrl: true, shinyArtworkUrl: true, type1: true, type2: true },
            },
          },
        },
      },
    });

    // Filter to only pokemon that can evolve right now
    const eligible = userPokemon.filter((up) => {
      const evolutions = up.pokemon.evolvesInto;
      if (!evolutions || evolutions.length === 0) return false;
      return evolutions.some((evo) => {
        if (evo.evolutionLevel && up.level < evo.evolutionLevel) return false;
        if (evo.evolutionItem) return false; // item evolutions not yet supported
        return true;
      });
    });

    if (eligible.length === 0) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle('🔴 No Pokémon Ready to Evolve')
          .setDescription(
            'None of your Pokémon are ready to evolve right now.\n\n' +
            '**Tips:**\n' +
            '• Level up your Pokémon in `/battle`\n' +
            '• Check `/box` to see your Pokémon levels\n' +
            '• Some Pokémon need specific items to evolve (coming soon)'
          )],
      });
      return;
    }

    // Build select menu options (max 25)
    const options = eligible.slice(0, 25).map((up) => {
      const evo = up.pokemon.evolvesInto.find((e) => !e.evolutionLevel || up.level >= e.evolutionLevel);
      const label = `${up.pokemon.nameDisplay} → ${evo?.nameDisplay ?? '?'}`;
      const desc = `Level ${up.level}${up.isShiny ? ' ✨ Shiny' : ''} | Needs Lv.${evo?.evolutionLevel ?? '?'}`;
      return {
        label: label.slice(0, 100),
        description: desc.slice(0, 100),
        value: `${up.id}:${evo?.id ?? ''}`,
      };
    });

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('evolve:select')
        .setPlaceholder('Choose a Pokémon to evolve...')
        .addOptions(options)
    );

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('⚡ Evolution Chamber')
        .setDescription(`You have **${eligible.length}** Pokémon ready to evolve!\nSelect one from the menu below.`)],
      components: [selectRow],
    });

    const collector = interaction.channel?.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.customId === 'evolve:select' && i.user.id === interaction.user.id,
      time: 60_000,
      max: 1,
    });

    collector?.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
      await selectInteraction.deferUpdate();

      const [userPokemonId, evolutionPokemonId] = selectInteraction.values[0].split(':');

      // Re-validate ownership + eligibility
      const up = await client.prisma.userPokemon.findUnique({
        where: { id: userPokemonId },
        include: {
          pokemon: {
            include: { evolvesInto: true },
          },
        },
      });

      if (!up || up.userId !== interaction.user.id) {
        await interaction.editReply({ content: '❌ Pokémon not found.', components: [] });
        return;
      }

      const evo = await client.prisma.pokemon.findUnique({ where: { id: parseInt(evolutionPokemonId, 10) } });
      if (!evo) {
        await interaction.editReply({ content: '❌ Evolution data not found.', components: [] });
        return;
      }

      if (evo.evolutionLevel && up.level < evo.evolutionLevel) {
        await interaction.editReply({
          content: `❌ **${up.pokemon.nameDisplay}** needs to be level **${evo.evolutionLevel}** to evolve (currently ${up.level}).`,
          components: [],
        });
        return;
      }

      // Execute evolution
      const evolved = await client.prisma.userPokemon.update({
        where: { id: up.id },
        data: { pokemonId: evo.id },
        include: { pokemon: true },
      });

      // Grant evolution XP
      const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, EVOLVE_XP);

      // Achievement check
      checkAndAwardAchievements(client, interaction.user.id, interaction.channelId, interaction.guild?.id).catch(() => {});

      const beforeArt = up.isShiny ? up.pokemon.shinyArtworkUrl : up.pokemon.artworkUrl;
      const afterArt = up.isShiny ? evo.shinyArtworkUrl : evo.artworkUrl;

      const embed = new EmbedBuilder()
        .setColor(up.isShiny ? 0xffd700 : 0x9b59b6)
        .setTitle(`⚡ ${up.pokemon.nameDisplay} evolved into ${evo.nameDisplay}!`)
        .setDescription(
          `Congratulations, Trainer! Your ${up.isShiny ? '✨ Shiny ' : ''}**${up.pokemon.nameDisplay}** has evolved into **${evo.nameDisplay}**!`
        )
        .addFields(
          { name: 'Before', value: `**${up.pokemon.nameDisplay}** (Lv.${up.level})`, inline: true },
          { name: 'After', value: `**${evo.nameDisplay}** (Lv.${evolved.level})`, inline: true },
          { name: '⭐ XP Gained', value: `+${EVOLVE_XP} XP`, inline: true },
        );

      if (afterArt) embed.setThumbnail(afterArt);
      if (leveledUp) embed.addFields({ name: '🎉 Trainer Level Up!', value: `You reached **Trainer Level ${newLevel}**!`, inline: false });

      await interaction.editReply({ embeds: [embed], components: [] });
    });

    collector?.on('end', async (collected) => {
      if (collected.size === 0) {
        await interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};

export default command;
