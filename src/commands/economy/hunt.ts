import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { formatNumber, formatDuration } from '../../utils/embeds.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';

const ENCOUNTERS = [
  { name: 'Rattata', reward: 80, chance: 0.3, emoji: '🐭' },
  { name: 'Pidgey', reward: 100, chance: 0.25, emoji: '🐦' },
  { name: 'Ekans', reward: 150, chance: 0.15, emoji: '🐍' },
  { name: 'Growlithe', reward: 300, chance: 0.1, emoji: '🐕' },
  { name: 'Scyther', reward: 500, chance: 0.08, emoji: '🦗' },
  { name: 'Electabuzz', reward: 700, chance: 0.05, emoji: '⚡' },
  { name: 'Snorlax', reward: 1000, chance: 0.05, emoji: '😴' },
  { name: 'Dragonite', reward: 2000, chance: 0.02, emoji: '🐲' },
];

const command: Command = {
  data: new SlashCommandBuilder().setName('hunt').setDescription('Hunt Pokemon in the wild for PokéCoins!'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const guild = await client.prisma.guild.findUnique({ where: { id: interaction.guild?.id ?? '' } });
    const cooldownSecs = guild?.huntCooldown ?? 3600;

    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'hunt', cooldownSecs);
    if (onCooldown) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('⏰ Cooldown').setDescription(`Hunt again in **${formatDuration(remaining!)}**.`)], ephemeral: true });
      return;
    }

    const isFail = Math.random() < 0.15;
    if (isFail) {
      await setCooldown(client, interaction.user.id, 'hunt', cooldownSecs);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff8c00).setTitle('🌿 Nothing Found').setDescription('You searched the tall grass but found nothing. Try again later!')] });
      return;
    }

    let roll = Math.random();
    let enc = ENCOUNTERS[0];
    for (const e of ENCOUNTERS) { roll -= e.chance; if (roll <= 0) { enc = e; break; } }

    const bonus = Math.random() < 0.1 ? Math.floor(enc.reward * 0.5) : 0;
    const total = enc.reward + bonus;

    await setCooldown(client, interaction.user.id, 'hunt', cooldownSecs);
    await client.prisma.user.update({ where: { id: interaction.user.id }, data: { balance: { increment: total }, totalEarned: { increment: total } } });

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle(`🌿 Encountered a ${enc.name}!`)
        .setDescription(`${enc.emoji} Chased away and earned **${formatNumber(enc.reward)} PokéCoins**${bonus > 0 ? `\n🌟 Bonus: +${formatNumber(bonus)} PokéCoins!` : ''}`)
        .setFooter({ text: `Total: ${formatNumber(total)} PokéCoins` }).setTimestamp()],
    });
  },
};
export default command;
