import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';

const RESPONSES = [
  { msg: 'A kind trainer tossed you some coins!', min: 50, max: 150 },
  { msg: 'You found a coin on the ground!', min: 10, max: 50 },
  { msg: 'Nurse Joy felt sorry for you.', min: 100, max: 300 },
  { msg: 'The Gym Leader ignored you...', min: 0, max: 0 },
  { msg: 'A wealthy Collector donated PokéCoins!', min: 200, max: 500 },
  { msg: 'Professor Oak slipped you some grant money.', min: 150, max: 400 },
];

const command: Command = {
  data: new SlashCommandBuilder().setName('beg').setDescription('Beg for PokéCoins'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const COOLDOWN = 600;
    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'beg', COOLDOWN);
    if (onCooldown) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Cooldown').setDescription(`Beg again in **${formatDuration(remaining!)}**.`)], ephemeral: true });
      return;
    }

    const res = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    const amount = res.min > 0 ? Math.floor(Math.random() * (res.max - res.min) + res.min) : 0;

    await setCooldown(client, interaction.user.id, 'beg', COOLDOWN);
    if (amount > 0) await client.prisma.user.update({ where: { id: interaction.user.id }, data: { balance: { increment: amount }, totalEarned: { increment: amount } } });

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(amount > 0 ? 0x00ff00 : 0x808080)
        .setTitle(amount > 0 ? '🙏 Someone was generous!' : '🙏 No luck...')
        .setDescription(`${res.msg}${amount > 0 ? `\n\n+**${formatNumber(amount)} PokéCoins**` : ''}`)
        .setTimestamp()],
    });
  },
};
export default command;
