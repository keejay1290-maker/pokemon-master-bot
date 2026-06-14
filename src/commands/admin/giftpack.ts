import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { fetchSets } from '../../services/pokemonTcgService.js';
import { ensureUser } from '../../services/userService.js';

const MAX_QUANTITY = 20;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('giftpack')
    .setDescription('Gift unopened TCG card packs to a user (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) =>
      o.setName('user').setDescription('User to gift packs to').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('set').setDescription('Card set to gift').setAutocomplete(true).setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName('quantity').setDescription(`Number of packs to gift (1–${MAX_QUANTITY})`).setMinValue(1).setMaxValue(MAX_QUANTITY).setRequired(true)
    ),

  async autocomplete(interaction, client) {
    const sets = await fetchSets(client);
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = (sets as Array<{ id: string; name: string }>)
      .filter((s) => s.name.toLowerCase().includes(focused))
      .slice(0, 25);
    await interaction.respond(filtered.map((s) => ({ name: s.name, value: s.id })));
  },

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;

    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    if (!isOwner && !isAdmin) {
      await interaction.reply({ content: '❌ Administrator permission required.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const setId = interaction.options.getString('set', true);
    const quantity = interaction.options.getInteger('quantity', true);

    await ensureUser(client.prisma, target);

    const sets = await fetchSets(client);
    const setData = (sets as Array<{ id: string; name: string; images?: Record<string, string> }>).find((s) => s.id === setId);
    if (!setData) {
      await interaction.editReply('❌ Set not found. Use autocomplete to select a valid set.');
      return;
    }

    const itemId = `pack:${setId}`;
    const itemName = `${setData.name} Pack`;

    // Add packs to inventory — do NOT open them
    await client.prisma.userInventory.upsert({
      where: { userId_itemId: { userId: target.id, itemId } },
      update: { quantity: { increment: quantity } },
      create: { userId: target.id, itemId, itemName, quantity },
    });

    await client.prisma.auditLog.create({
      data: {
        guildId: interaction.guild.id,
        action: 'GIFT_PACK',
        targetId: target.id,
        moderatorId: interaction.user.id,
        metadata: { setId, setName: setData.name, quantity },
      },
    });

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🎁 Packs Gifted!')
        .addFields(
          { name: 'Recipient', value: `<@${target.id}>`, inline: true },
          { name: 'Set', value: setData.name, inline: true },
          { name: 'Packs', value: `${quantity}`, inline: true },
          { name: 'Status', value: 'Added to inventory — user opens with `/pack open`', inline: false },
        )
        .setFooter({ text: `Gifted by ${interaction.user.tag}` })
        .setTimestamp()],
    });

    try {
      await target.send({
        embeds: [new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle('🎁 You received card packs!')
          .setDescription(`An admin gifted you **${quantity} ${setData.name} pack${quantity > 1 ? 's' : ''}**!\nOpen them with \`/pack open\`.`)
          .setTimestamp()],
      }).catch(() => {});
    } catch { /* DMs closed */ }
  },
};

export default command;
