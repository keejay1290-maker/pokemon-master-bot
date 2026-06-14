import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { addXp } from '../../services/userService.js';

const CATCHES = [
  { name: 'Magikarp', reward: 100, chance: 0.3, emoji: '🐟' },
  { name: 'Goldeen', reward: 150, chance: 0.25, emoji: '🐠' },
  { name: 'Tentacool', reward: 120, chance: 0.2, emoji: '🪼' },
  { name: 'Horsea', reward: 200, chance: 0.1, emoji: '🐴' },
  { name: 'Psyduck', reward: 250, chance: 0.08, emoji: '🦆' },
  { name: 'Gyarados', reward: 800, chance: 0.04, emoji: '🐉' },
  { name: 'Lapras', reward: 1200, chance: 0.02, emoji: '🦕' },
  { name: 'Dratini', reward: 1500, chance: 0.01, emoji: '🐲' },
];

const command: Command = {
  data: new SlashCommandBuilder().setName('fish').setDescription('Go fishing for PokéCoins!'),
  cooldown: 1800,

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } });
    const cooldownSecs = guild?.fishCooldown ?? 1800;

    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'fish', cooldownSecs);
    if (onCooldown) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Fishing Cooldown').setDescription(`Cast your line again in **${formatDuration(remaining!)}**.`)], ephemeral: true });
      return;
    }

    const isFail = Math.random() < 0.1;
    if (isFail) {
      await setCooldown(client, interaction.user.id, 'fish', cooldownSecs);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff8c00).setTitle('🎣 No Bite!').setDescription('You cast your line but nothing bit. Better luck next time!')] });
      return;
    }

    let roll = Math.random();
    let caught = CATCHES[0];
    for (const c of CATCHES) { roll -= c.chance; if (roll <= 0) { caught = c; break; } }

    await setCooldown(client, interaction.user.id, 'fish', cooldownSecs);
    await client.prisma.user.update({ where: { id: interaction.user.id }, data: { balance: { increment: caught.reward }, totalEarned: { increment: caught.reward } } });

    const xpGain = Math.max(10, Math.floor(caught.reward / 50));
    const { leveledUp, newLevel } = await addXp(client.prisma, interaction.user.id, xpGain);

    const embed = new EmbedBuilder().setColor(0x3498db).setTitle(`🎣 You caught a ${caught.name}!`)
      .setDescription(`${caught.emoji} Sold for **${formatNumber(caught.reward)} PokéCoins**!\nNext cast in ${formatDuration(cooldownSecs)}.`)
      .addFields({ name: '⭐ Trainer XP', value: `+${xpGain} XP`, inline: true })
      .setTimestamp();
    if (leveledUp) embed.addFields({ name: '🎉 Level Up!', value: `You reached **Level ${newLevel}**!`, inline: true });

    await interaction.reply({ embeds: [embed] });
  },
};
export default command;
