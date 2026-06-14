import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Give your Pokémon a nickname or clear its existing one')
    .addStringOption((o) =>
      o.setName('id').setDescription('Pokémon ID from /box (first 8 characters)').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('name').setDescription('New nickname (leave blank to clear). Max 20 characters.').setMaxLength(20)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply({ ephemeral: true });
    const partialId = interaction.options.getString('id', true).toLowerCase();
    const nickname = interaction.options.getString('name') ?? null;

    if (nickname !== null && nickname.trim().length === 0) {
      await interaction.editReply({ content: '❌ Nickname cannot be blank. Leave the `name` option empty to clear a nickname.' });
      return;
    }

    if (nickname !== null && !/^[\w\s\-'.!?]+$/u.test(nickname)) {
      await interaction.editReply({ content: '❌ Nickname contains invalid characters. Use only letters, numbers, spaces, and basic punctuation.' });
      return;
    }

    const up = await client.prisma.userPokemon.findFirst({
      where: { userId: interaction.user.id, id: { startsWith: partialId } },
      include: { pokemon: true },
    });

    if (!up) {
      await interaction.editReply({ content: `❌ No Pokémon found with ID \`${partialId}\`. Use **/box** to view your Pokémon IDs.` });
      return;
    }

    await client.prisma.userPokemon.update({
      where: { id: up.id },
      data: { nickname: nickname?.trim() ?? null },
    });

    const baseName = up.pokemon.nameDisplay;

    if (nickname) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xffcb05)
          .setTitle('✏️ Nickname Set')
          .setDescription(`**${baseName}** is now known as **${nickname.trim()}**!`)
          .setFooter({ text: 'The nickname appears in /box and battle.' })
          .setTimestamp()],
      });
    } else {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xffcb05)
          .setTitle('✏️ Nickname Cleared')
          .setDescription(`**${baseName}**'s nickname has been removed.`)
          .setTimestamp()],
      });
    }
  },
};

export default command;
