import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ComponentType,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { endGiveaway } from '../../jobs/giveawayJob.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand((s) =>
      s.setName('create').setDescription('Create a giveaway')
        .addStringOption((o) => o.setName('title').setDescription('Giveaway title').setRequired(true))
        .addStringOption((o) => o.setName('prize').setDescription('What to give away').setRequired(true))
        .addIntegerOption((o) => o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1))
        .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(10))
    )
    .addSubcommand((s) =>
      s.setName('end').setDescription('End a giveaway early')
        .addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('reroll').setDescription('Reroll giveaway winners')
        .addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const title = interaction.options.getString('title', true);
      const prize = interaction.options.getString('prize', true);
      const duration = interaction.options.getInteger('duration', true);
      const winners = interaction.options.getInteger('winners') ?? 1;
      const endsAt = new Date(Date.now() + duration * 60000);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`🎉 GIVEAWAY: ${title}`)
        .setDescription(`**Prize:** ${prize}\n\nClick the button below to enter!`)
        .addFields(
          { name: '🏆 Winners', value: winners.toString(), inline: true },
          { name: '⏰ Ends', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
          { name: '🎫 Entries', value: '0', inline: true },
        )
        .setFooter({ text: `Hosted by ${interaction.user.tag}` })
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🎉 Enter').setStyle(ButtonStyle.Success)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      const giveaway = await client.prisma.giveaway.create({
        data: {
          guildId: interaction.guild.id,
          channelId: interaction.channelId,
          messageId: msg.id,
          hostId: interaction.user.id,
          title,
          prizeType: 'coins',
          prizeData: { description: prize },
          winners,
          endsAt,
        },
      });

      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: duration * 60000 });
      collector.on('collect', async (btn) => {
        if (btn.customId !== 'giveaway_enter') return;
        const existing = await client.prisma.giveawayEntry.findUnique({
          where: { giveawayId_userId: { giveawayId: giveaway.id, userId: btn.user.id } },
        });
        if (existing) { await btn.reply({ content: "You're already entered!", ephemeral: true }); return; }
        await client.prisma.giveawayEntry.create({ data: { giveawayId: giveaway.id, userId: btn.user.id } });
        const count = await client.prisma.giveawayEntry.count({ where: { giveawayId: giveaway.id } });
        embed.setFields(
          { name: '🏆 Winners', value: winners.toString(), inline: true },
          { name: '⏰ Ends', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
          { name: '🎫 Entries', value: count.toString(), inline: true },
        );
        await btn.update({ embeds: [embed] });
      });

      collector.on('end', async () => { await endGiveaway(client, giveaway.id); });

    } else if (sub === 'end') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: 'No permission.', ephemeral: true }); return;
      }
      const id = interaction.options.getString('id', true);
      await endGiveaway(client, id);
      await interaction.reply({ content: `✅ Giveaway ${id} ended.`, ephemeral: true });

    } else if (sub === 'reroll') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: 'No permission.', ephemeral: true }); return;
      }
      const id = interaction.options.getString('id', true);
      const giveaway = await client.prisma.giveaway.findUnique({ where: { id }, include: { entries: true } });
      if (!giveaway) { await interaction.reply({ content: 'Giveaway not found.', ephemeral: true }); return; }
      const newWinner = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)];
      if (!newWinner) { await interaction.reply({ content: 'No entries.', ephemeral: true }); return; }
      await interaction.reply({ content: `🎉 Rerolled! New winner: <@${newWinner.userId}>` });
    }
  },
};
export default command;
