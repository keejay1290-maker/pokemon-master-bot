import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { errorEmbed } from '../../utils/embeds.js';
import { REDIS_KEYS, deserializeSpawn } from '../../utils/redisKeys.js';

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

    const messageId = await client.redis.get(REDIS_KEYS.guildSpawn(interaction.guild.id));
    const spawn = messageId
      ? deserializeSpawn(await client.redis.get(REDIS_KEYS.spawn(messageId)))
      : null;

    if (!spawn) {
      await interaction.reply({
        embeds: [errorEmbed('No Pokemon', 'There are no wild Pokemon to catch right now!\nWait for one to spawn or be active in the server.')],
        ephemeral: true,
      });
      return;
    }

    // The actual catching happens via button click on the spawn message
    // Also set a Redis cooldown keyed to guild-configured catchCooldown to rate-limit /catch usage
    try {
      const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
      const cd = guild?.catchCooldown ?? 3;
      await client.redis.set(`cooldown:${interaction.user.id}:catch`, (Date.now() + cd * 1000).toString(), { EX: cd });
    } catch {
      // non-fatal — keep best-effort behavior
    }

    await interaction.reply({
      content: `There's a wild Pokemon in <#${spawn.channelId}>! Go click the **Catch!** button on the spawn message!`,
      ephemeral: true,
    });
  },
};

export default command;
