import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { TypeColors, rarityEmoji } from '../../utils/embeds.js';

const PAGE_SIZE = 10;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('box')
    .setDescription('View your Pokemon collection')
    .addIntegerOption((opt) => opt.setName('page').setDescription('Page number').setMinValue(1)),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const page = interaction.options.getInteger('page') ?? 1;

    const total = await client.prisma.userPokemon.count({ where: { userId: interaction.user.id } });
    const pokemon = await client.prisma.userPokemon.findMany({
      where: { userId: interaction.user.id },
      include: { pokemon: true },
      orderBy: [{ isFavorite: 'desc' }, { pokemon: { id: 'asc' } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (pokemon.length === 0) {
      await interaction.editReply({ content: "You don't have any Pokemon yet! Use `/catch` to catch some." });
      return;
    }

    const buildEmbed = (pg: number) => {
      const embed = new EmbedBuilder()
        .setColor(0xffcb05)
        .setTitle(`📦 ${interaction.user.username}'s Pokemon Box`)
        .setDescription(
          pokemon.map((up, i) =>
            `${(pg - 1) * PAGE_SIZE + i + 1}. ${up.isShiny ? '✨ ' : ''}${up.isFavorite ? '❤️ ' : ''}**${up.nickname ?? up.pokemon.nameDisplay}** ` +
            `#${up.pokemon.id.toString().padStart(3, '0')} — Lv.${up.level} ${rarityEmoji(up.pokemon.rarity)}`
          ).join('\n')
        )
        .setFooter({ text: `Page ${pg}/${totalPages} • ${total} total Pokemon` });
      return embed;
    };

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 1),
      new ButtonBuilder().setCustomId('next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
    );

    const msg = await interaction.editReply({ embeds: [buildEmbed(page)], components: totalPages > 1 ? [row] : [] });
    if (totalPages <= 1) return;

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
    let currentPage = page;

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) { await btn.reply({ content: 'Not your box!', ephemeral: true }); return; }
      if (btn.customId === 'prev' && currentPage > 1) currentPage--;
      if (btn.customId === 'next' && currentPage < totalPages) currentPage++;

      const newPokemon = await client.prisma.userPokemon.findMany({
        where: { userId: interaction.user.id },
        include: { pokemon: true },
        orderBy: [{ isFavorite: 'desc' }, { pokemon: { id: 'asc' } }],
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      // Replace local pokemon var for embed
      pokemon.splice(0, pokemon.length, ...newPokemon);

      const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
        new ButtonBuilder().setCustomId('next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages),
      );
      await btn.update({ embeds: [buildEmbed(currentPage)], components: [newRow] });
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};

export default command;
