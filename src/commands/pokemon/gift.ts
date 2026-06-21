import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { ensureUser } from '../../services/userService.js';
import {
  parseGiftSelection,
  transferPokemonGift,
  type GiftSelection,
} from '../../services/giftService.js';

function giftErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    SELF_GIFT: 'You cannot gift something to yourself.',
    GIFT_NOT_OWNED: 'You no longer own that Pokémon or card.',
    GIFT_IN_TEAM: 'Remove that Pokémon from every team before gifting it.',
    GIFT_FAVORITE: 'Unfavorite that Pokémon before gifting it.',
    GIFT_LOCKED: 'Unprotect that Pokémon before gifting it.',
    GIFT_IN_BATTLE: 'Finish your active battle before gifting a caught Pokémon.',
    GIFT_LISTED: 'That Pokémon is currently listed on the market.',
  };
  return messages[code] ?? 'The gift could not be completed. Nothing was transferred.';
}

async function describeSelection(client: BotClient, userId: string, selection: GiftSelection) {
  if (selection.kind === 'caught') {
    const owned = await client.prisma.userPokemon.findFirst({
      where: { id: selection.ownershipId, userId },
      include: { pokemon: true },
    });
    if (!owned) return null;
    return {
      title: `${owned.isShiny ? '✨ ' : ''}${owned.nickname ?? owned.pokemon.nameDisplay}`,
      detail: `Pokédex Pokémon • Lv.${owned.level} • ${owned.pokemon.rarity}`,
      image: owned.isShiny
        ? (owned.pokemon.shinyArtworkUrl ?? owned.pokemon.artworkUrl)
        : owned.pokemon.artworkUrl,
    };
  }

  const owned = await client.prisma.userCard.findFirst({
    where: { id: selection.ownershipId, userId, quantity: { gt: 0 } },
    include: { card: true },
  });
  if (!owned) return null;
  return {
    title: `${owned.isFoil ? '✨ ' : ''}${owned.card.name}`,
    detail: `TCG collection card • ${owned.card.rarity} • ${owned.quantity} owned`,
    image: owned.card.imageLarge ?? owned.card.imageSmall,
  };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Gift Pokémon and cards to another trainer')
    .addSubcommandGroup((group) =>
      group
        .setName('pokemon')
        .setDescription('Gift from your Pokémon collections')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('pokedex')
            .setDescription('Gift a captured Pokémon from your Pokédex')
            .addUserOption((option) =>
              option.setName('recipient').setDescription('Trainer receiving the Pokémon').setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName('pokemon')
                .setDescription('Choose an eligible captured Pokémon')
                .setAutocomplete(true)
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('collection')
            .setDescription('Gift a Pokémon card from your TCG collection')
            .addUserOption((option) =>
              option.setName('recipient').setDescription('Trainer receiving the card').setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName('card')
                .setDescription('Choose a card from your collection')
                .setAutocomplete(true)
                .setRequired(true)
            )
        )
    ),

  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const source = interaction.options.getSubcommand(true);

    if (source === 'pokedex') {
      const caught = await client.prisma.userPokemon.findMany({
        where: {
          userId: interaction.user.id,
          isFavorite: false,
          isLocked: false,
          isInTeam: false,
        },
        include: { pokemon: true },
        orderBy: { caughtAt: 'desc' },
        take: 50,
      });
      const choices = caught
        .map((owned) => {
          const ivTotal = owned.ivHp + owned.ivAttack + owned.ivDefense +
            owned.ivSpAttack + owned.ivSpDefense + owned.ivSpeed;
          const ivPercent = Math.round((ivTotal / 186) * 100);
          const displayName = owned.nickname ?? owned.pokemon.nameDisplay;
          return {
            name: `${owned.isShiny ? '✨ ' : ''}${displayName} • Lv.${owned.level} • ${ivPercent}% IV • ${owned.pokemon.rarity}`,
            value: `caught:${owned.id}`,
            search: `${displayName} ${owned.pokemon.nameDisplay} ${owned.pokemon.rarity}`.toLowerCase(),
          };
        })
        .filter((choice) => !focused || choice.search.includes(focused))
        .slice(0, 25)
        .map(({ name, value }) => ({ name: name.slice(0, 100), value }));
      await interaction.respond(choices);
      return;
    }

    const cards = await client.prisma.userCard.findMany({
      where: { userId: interaction.user.id, quantity: { gt: 0 } },
      include: { card: true },
      orderBy: { obtainedAt: 'desc' },
      take: 50,
    });
    const choices = cards
      .map((owned) => ({
        name: `${owned.isFoil ? '✨ ' : ''}${owned.card.name} • ${owned.card.rarity} • x${owned.quantity}`,
        value: `card:${owned.id}`,
        search: `${owned.card.name} ${owned.card.rarity}`.toLowerCase(),
      }))
      .filter((choice) => !focused || choice.search.includes(focused))
      .slice(0, 25)
      .map(({ name, value }) => ({ name: name.slice(0, 100), value }));
    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Gifts must be sent inside a server.', ephemeral: true });
      return;
    }

    const source = interaction.options.getSubcommand(true);
    const recipient = interaction.options.getUser('recipient', true);
    const rawSelection = source === 'pokedex'
      ? interaction.options.getString('pokemon', true)
      : interaction.options.getString('card', true);
    const selection = parseGiftSelection(rawSelection);
    if (!selection || (source === 'pokedex' && selection.kind !== 'caught') ||
      (source === 'collection' && selection.kind !== 'card')) {
      await interaction.reply({ content: 'Choose an item from autocomplete.', ephemeral: true });
      return;
    }
    if (recipient.bot) {
      await interaction.reply({ content: 'Bots cannot receive Pokémon gifts.', ephemeral: true });
      return;
    }
    if (recipient.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot gift something to yourself.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    await ensureUser(client.prisma, recipient);

    const gift = await describeSelection(client, interaction.user.id, selection);
    if (!gift) {
      await interaction.editReply('You no longer own that Pokémon or card.');
      return;
    }

    const confirmId = `gift_confirm:${interaction.id}`;
    const cancelId = `gift_cancel:${interaction.id}`;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel('Confirm Gift').setEmoji('🎁').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    const reviewEmbed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setTitle('🎁 Review Your Gift')
      .setDescription(`Send **${gift.title}** to <@${recipient.id}>?`)
      .addFields(
        { name: 'From', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'To', value: `<@${recipient.id}>`, inline: true },
        { name: 'Gift', value: gift.detail, inline: false },
      )
      .setFooter({ text: 'Ownership and protection checks run again on confirmation.' });
    if (gift.image) reviewEmbed.setThumbnail(gift.image);

    const reply = await interaction.editReply({ embeds: [reviewEmbed], components: [row] });
    try {
      const button = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (component) => component.user.id === interaction.user.id &&
          (component.customId === confirmId || component.customId === cancelId),
        time: 60_000,
      });

      if (button.customId === cancelId) {
        await button.update({ content: 'Gift cancelled.', embeds: [], components: [] });
        return;
      }

      await button.deferUpdate();
      try {
        const result = await transferPokemonGift(
          client.prisma,
          interaction.guild.id,
          interaction.user.id,
          recipient.id,
          selection,
        );
        const resultLabel = result.kind === 'caught'
          ? `${result.isShiny ? '✨ ' : ''}${result.name} (Lv.${result.level})`
          : `${result.name} (${result.rarity})`;
        await interaction.editReply({
          content: `✅ Gift sent! **${resultLabel}** now belongs to <@${recipient.id}>.`,
          embeds: [],
          components: [],
        });

        const announcement = new EmbedBuilder()
          .setColor(result.kind === 'caught' ? 0xffcb05 : 0x3498db)
          .setTitle('🎁 A Trainer Gift!')
          .setDescription(`<@${interaction.user.id}> gifted **${resultLabel}** to <@${recipient.id}>!`)
          .addFields(
            { name: 'Sender', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Recipient', value: `<@${recipient.id}>`, inline: true },
            { name: result.kind === 'caught' ? 'Pokédex Pokémon' : 'TCG Card', value: gift.detail, inline: false },
          )
          .setFooter({ text: 'Generosity makes the trainer community stronger.' })
          .setTimestamp();
        if (gift.image) announcement.setThumbnail(gift.image);
        if (interaction.channel?.isSendable()) {
          await interaction.channel.send({ embeds: [announcement] }).catch(() => {});
        }
        await recipient.send(
          `🎁 <@${interaction.user.id}> gifted you **${resultLabel}** in **${interaction.guild.name}**!`
        ).catch(() => {});
      } catch (error) {
        await interaction.editReply({
          content: `❌ ${giftErrorMessage(error)}`,
          embeds: [],
          components: [],
        });
      }
    } catch {
      await interaction.editReply({
        content: '⌛ Gift confirmation expired. Nothing was transferred.',
        embeds: [],
        components: [],
      }).catch(() => {});
    }
  },
};

export default command;
