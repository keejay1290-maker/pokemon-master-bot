import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('View your card collection')
    .addUserOption((o) => o.setName('user').setDescription('View another user\'s collection')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') ?? interaction.user;

    const cards = await client.prisma.userCard.findMany({
      where: { userId: target.id },
      include: { card: true },
      orderBy: { card: { rarity: 'desc' } },
      take: 20,
    });

    const total = await client.prisma.userCard.count({ where: { userId: target.id } });
    const rarityCount = await client.prisma.userCard.groupBy({
      by: ['cardId'],
      where: { userId: target.id },
      _count: true,
    });

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🃏 ${target.username}'s Card Collection`)
      .setThumbnail(target.displayAvatarURL());

    if (cards.length === 0) {
      embed.setDescription('No cards yet! Use `/pack` to open some.');
    } else {
      embed.setDescription(
        cards.slice(0, 15).map((uc) =>
          `**${uc.card.name}** — ${uc.card.rarity} (x${uc.quantity})`
        ).join('\n')
      );
    }

    embed.addFields({ name: 'Total Cards', value: total.toString(), inline: true });
    embed.setFooter({ text: 'Use /pack to open more cards!' });

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
