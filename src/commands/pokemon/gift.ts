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
    GIFT_IN_TEAM: 'Remove that Pokémon from your team before gifting it.',
    GIFT_FAVORITE: 'Unfavorite that Pokémon before gifting it.',
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
      detail: `Caught Pokémon • Lv.${owned.level} • ${owned.pokemon.rarity}`,
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
    detail: `TCG card • ${owned.card.rarity} • ${owned.quantity} owned`,
    image: owned.card.imageLarge ?? owned.card.imageSmall,
  };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Gift Pokémon and cards to another trainer')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('pokemon')
        .setDescription('Gift a caught Pokémon or Pokémon card')
        .addUserOption((option) =>
          option.setName('recipient').setDescription('Trainer receiving the gift').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('pokemon')
            .setDescription('Choose from your Pokédex or card collection')
            .setAutocomplete(true)
            .setRequired(true)
        )
    ),

  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const [caught, cards] = await Promise.all([
      client.prisma.userPokemon.findMany({
        where: { userId: interaction.user.id },
        include: { pokemon: true },
        orderBy: { caughtAt: 'desc' },
        take: 40,
      }),
      client.prisma.userCard.findMany({
        where: { userId: interaction.user.id, quantity: { gt: 0 } },
        include: { card: true },
        orderBy: { obtainedAt: 'desc' },
        take: 40,
      }),
    ]);

    const choices = [
      ...caught.map((owned) => {
        const ivTotal = owned.ivHp + owned.ivAttack + owned.ivDefense +
          owned.ivSpAttack + owned.ivSpDefense + owned.ivSpeed;
        const ivPercent = Math.round((ivTotal / 186) * 100);
        const displayName = owned.nickname ?? owned.pokemon.nameDisplay;
        return {
          name: `Pokédex • ${owned.isShiny ? '✨ ' : ''}${displayName} • Lv.${owned.level} • ${ivPercent}% IV`,
          value: `caught:${owned.id}`,
          search: `${displayName} ${owned.pokemon.nameDisplay}`.toLowerCase(),
        };
      }),
      ...cards.map((owned) => ({
        name: `Collection • ${owned.isFoil ? '✨ ' : ''}${owned.card.name} • ${owned.card.rarity} • x${owned.quantity}`,
        value: `card:${owned.id}`,
        search: `${owned.card.name} ${owned.card.rarity}`.toLowerCase(),
      })),
    ]
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

    const recipient = interaction.options.getUser('recipient', true);
    const selection = parseGiftSelection(interaction.options.getString('pokemon', true));
    if (!selection) {
      await interaction.reply({ content: 'Choose a Pokémon or card from autocomplete.', ephemeral: true });
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
      new ButtonBuilder().setCustomId(confirmId).setLabel('Confirm Gift').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setTitle('🎁 Review Your Gift')
      .setDescription(`Send **${gift.title}** to <@${recipient.id}>?`)
      .addFields(
        { name: 'From', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'To', value: `<@${recipient.id}>`, inline: true },
        { name: 'Gift', value: gift.detail, inline: false },
      )
      .setFooter({ text: 'Ownership is checked again when you confirm.' });
    if (gift.image) embed.setThumbnail(gift.image);

    const reply = await interaction.editReply({ embeds: [embed], components: [row] });
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
          content: `🎁 **${resultLabel}** was gifted to <@${recipient.id}>.`,
          embeds: [],
          components: [],
        });
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
