import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('catch')
    .setDescription('Catch a wild Pokemon that has spawned!'),
  // use guild-configurable catch cooldown where possible
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) {
      await interaction.reply({ embeds: [errorEmbed('Server Only', 'This command can only be used in a server.')], ephemeral: true });
      return;
    }

    const spawns = await client.prisma.spawn.findMany({
      where: {
        guildId: interaction.guild.id,
        isCaught: false,
        expiresAt: { gt: new Date() },
        messageId: { not: null },
      },
      orderBy: { spawnedAt: 'desc' },
      take: 5,
    });

    if (spawns.length === 0) {
      await interaction.reply({
        embeds: [errorEmbed('No Pokemon', 'There are no wild Pokemon to catch right now!\nWait for one to spawn or be active in the server.')],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: spawns.length === 1
        ? `There's a wild Pokémon in <#${spawns[0].channelId}>! Press **Throw Poké Ball** on its encounter.`
        : `There are **${spawns.length} active encounters**:\n${spawns.map((spawn) => `• <#${spawn.channelId}>`).join('\n')}\nPress **Throw Poké Ball** on the one you want!`,
      ephemeral: true,
    });
  },
};

export default command;
