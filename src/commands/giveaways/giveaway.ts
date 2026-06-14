import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ComponentType,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { endGiveaway } from '../../jobs/giveawayJob.js';
import { fetchSets } from '../../services/pokemonTcgService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand((s) =>
      s.setName('create').setDescription('Create a giveaway')
        .addStringOption((o) => o.setName('title').setDescription('Giveaway title').setRequired(true))
        .addStringOption((o) =>
          o.setName('prize_type').setDescription('Prize type').setRequired(true).addChoices(
            { name: 'Coins', value: 'coins' },
            { name: 'Card Packs', value: 'packs' },
          )
        )
        .addIntegerOption((o) => o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1))
        .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(10))
        // Coins prize
        .addIntegerOption((o) => o.setName('coins').setDescription('PokéCoins per winner (required if prize_type=coins)').setMinValue(1))
        // Pack prizes
        .addStringOption((o) =>
          o.setName('pack_set').setDescription('Card set to give (required if prize_type=packs)').setAutocomplete(true)
        )
        .addIntegerOption((o) => o.setName('pack_quantity').setDescription('Packs per winner (default 1)').setMinValue(1).setMaxValue(10))
    )
    .addSubcommand((s) =>
      s.setName('end').setDescription('End a giveaway early')
        .addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('reroll').setDescription('Reroll giveaway winners')
        .addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true))
    ),

  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'pack_set') {
      const sets = await fetchSets(client);
      const query = focused.value.toLowerCase();
      const filtered = (sets as Array<{ id: string; name: string }>)
        .filter((s) => s.name.toLowerCase().includes(query))
        .slice(0, 25);
      await interaction.respond(filtered.map((s) => ({ name: s.name, value: s.id })));
    }
  },

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
          interaction.user.id !== interaction.guild.ownerId) {
        await interaction.reply({ content: '❌ Manage Server permission required to create giveaways.', ephemeral: true });
        return;
      }

      const title = interaction.options.getString('title', true);
      const prizeType = interaction.options.getString('prize_type', true) as 'coins' | 'packs';
      const duration = interaction.options.getInteger('duration', true);
      const winners = interaction.options.getInteger('winners') ?? 1;
      const endsAt = new Date(Date.now() + duration * 60000);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let prizeData: any;
      let prizeDescription: string;

      if (prizeType === 'coins') {
        const coins = interaction.options.getInteger('coins');
        if (!coins) {
          await interaction.reply({ content: '❌ Specify `coins` when prize_type is Coins.', ephemeral: true });
          return;
        }
        prizeData = { coins };
        prizeDescription = `💰 **${coins.toLocaleString()} PokéCoins**`;
      } else {
        const packSet = interaction.options.getString('pack_set');
        if (!packSet) {
          await interaction.reply({ content: '❌ Specify `pack_set` when prize_type is Card Packs.', ephemeral: true });
          return;
        }
        const sets = await fetchSets(client);
        const setData = (sets as Array<{ id: string; name: string }>).find((s) => s.id === packSet);
        if (!setData) {
          await interaction.reply({ content: '❌ Pack set not found. Use autocomplete to select a valid set.', ephemeral: true });
          return;
        }
        const qty = interaction.options.getInteger('pack_quantity') ?? 1;
        prizeData = { setId: packSet, setName: setData.name, quantity: qty };
        prizeDescription = `📦 **${qty} ${setData.name} Pack${qty > 1 ? 's' : ''}**`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`🎉 GIVEAWAY: ${title}`)
        .setDescription(`**Prize:** ${prizeDescription}\n\nClick the button below to enter!`)
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
          prizeType,
          prizeData,
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
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
          interaction.user.id !== interaction.guild.ownerId) {
        await interaction.reply({ content: '❌ No permission.', ephemeral: true }); return;
      }
      const id = interaction.options.getString('id', true);
      await endGiveaway(client, id);
      await interaction.reply({ content: `✅ Giveaway ${id} ended.`, ephemeral: true });

    } else if (sub === 'reroll') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
          interaction.user.id !== interaction.guild.ownerId) {
        await interaction.reply({ content: '❌ No permission.', ephemeral: true }); return;
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
