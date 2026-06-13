import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Trade Pokemon with another trainer')
    .addUserOption((o) => o.setName('user').setDescription('Trainer to trade with').setRequired(true))
    .addStringOption((o) => o.setName('pokemon_id').setDescription('Your Pokemon ID to offer').setRequired(true))
    .addStringOption((o) => o.setName('request').setDescription('Pokemon ID you want in return').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const target = interaction.options.getUser('user', true);
    const offerId = interaction.options.getString('pokemon_id', true);
    const requestId = interaction.options.getString('request', true);

    if (target.id === interaction.user.id) { await interaction.reply({ content: "You can't trade with yourself!", ephemeral: true }); return; }

    const myPokemon = await client.prisma.userPokemon.findFirst({ where: { id: offerId, userId: interaction.user.id }, include: { pokemon: true } });
    if (!myPokemon) { await interaction.reply({ content: "You don't have that Pokemon!", ephemeral: true }); return; }

    const theirPokemon = await client.prisma.userPokemon.findFirst({ where: { id: requestId, userId: target.id }, include: { pokemon: true } });
    if (!theirPokemon) { await interaction.reply({ content: `<@${target.id}> doesn't have that Pokemon!`, ephemeral: true }); return; }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🤝 Trade Offer!')
      .setDescription(`<@${interaction.user.id}> wants to trade with <@${target.id}>!`)
      .addFields(
        { name: `${interaction.user.username} offers`, value: `${myPokemon.isShiny ? '✨ ' : ''}**${myPokemon.pokemon.nameDisplay}** Lv.${myPokemon.level}`, inline: true },
        { name: `Wants`, value: `${theirPokemon.isShiny ? '✨ ' : ''}**${theirPokemon.pokemon.nameDisplay}** Lv.${theirPokemon.level}`, inline: true },
      )
      .setFooter({ text: 'Trade expires in 60 seconds' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('accept_trade').setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('decline_trade').setLabel('Decline').setStyle(ButtonStyle.Danger),
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== target.id) { await btn.reply({ content: "This trade isn't for you!", ephemeral: true }); return; }
      collector.stop();

      if (btn.customId === 'decline_trade') {
        await btn.update({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle('❌ Trade Declined')], components: [] });
        return;
      }

      // Execute trade
      await client.prisma.$transaction([
        client.prisma.userPokemon.update({ where: { id: offerId }, data: { userId: target.id } }),
        client.prisma.userPokemon.update({ where: { id: requestId }, data: { userId: interaction.user.id } }),
      ]);

      await client.prisma.trade.create({
        data: {
          initiatorId: interaction.user.id,
          receiverId: target.id,
          status: 'completed',
          expiresAt: new Date(),
          completedAt: new Date(),
        },
      });

      await btn.update({
        embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Trade Complete!')
          .setDescription(`Trade successful!\n<@${interaction.user.id}> ↔️ <@${target.id}>`)
          .addFields(
            { name: `${interaction.user.username} received`, value: `${theirPokemon.isShiny ? '✨ ' : ''}${theirPokemon.pokemon.nameDisplay}`, inline: true },
            { name: `${target.username} received`, value: `${myPokemon.isShiny ? '✨ ' : ''}${myPokemon.pokemon.nameDisplay}`, inline: true },
          )],
        components: [],
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
export default command;
