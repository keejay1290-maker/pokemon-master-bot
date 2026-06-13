import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { fetchCard, searchCards } from '../../services/pokemonTcgService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('card')
    .setDescription('Look up a Pokemon card')
    .addStringOption((o) => o.setName('name').setDescription('Card name to search').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const name = interaction.options.getString('name', true);

    const { data: cards } = await searchCards(client, `name:"${name}"`, 1, 1);
    if (!cards.length) {
      await interaction.editReply(`❌ Card "${name}" not found.`);
      return;
    }

    const card = cards[0] as Record<string, unknown>;
    const embed = new EmbedBuilder()
      .setColor(0xffcb05)
      .setTitle(`${card.name} — ${(card.set as Record<string, unknown>)?.name}`)
      .setImage(((card.images as Record<string, unknown>)?.large) as string ?? null)
      .addFields(
        { name: 'Rarity', value: card.rarity as string ?? 'Unknown', inline: true },
        { name: 'Set', value: `${(card.set as Record<string, unknown>)?.name} (${card.number})`, inline: true },
        { name: 'Artist', value: card.artist as string ?? 'Unknown', inline: true },
        { name: 'HP', value: card.hp as string ?? 'N/A', inline: true },
        { name: 'Types', value: ((card.types as string[]) ?? []).join(', ') || 'N/A', inline: true },
      )
      .setFooter({ text: `ID: ${card.id}` });

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
