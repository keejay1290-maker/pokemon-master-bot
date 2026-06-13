import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { getTrainerTitle, getRankedTier } from '../../services/userService.js';
import { formatNumber, progressBar } from '../../utils/embeds.js';
import { xpToNextLevel } from '../../utils/pokemon.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View trainer profile')
    .addUserOption((o) => o.setName('user').setDescription('View another trainer\'s profile')),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    await interaction.deferReply();

    const user = await client.prisma.user.findUnique({
      where: { id: target.id },
      include: { achievements: true, pokemon: { where: { isShiny: true }, select: { id: true } } },
    });

    if (!user) {
      await interaction.editReply("This user hasn't started their journey yet!");
      return;
    }

    const title = getTrainerTitle(user.trainerLevel);
    const tier = getRankedTier(user.rankedPoints);
    const xpNeeded = xpToNextLevel(user.trainerLevel);
    const tierEmoji: Record<string, string> = { Bronze: '🥉', Silver: '🥈', Gold: '🥇', Platinum: '💎', Diamond: '💠', Master: '👑' };

    const embed = new EmbedBuilder()
      .setColor(0xffcb05)
      .setTitle(`🎮 ${target.username}'s Trainer Profile`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`*${title}*`)
      .addFields(
        { name: '⭐ Level', value: `**${user.trainerLevel}**\nXP: \`${progressBar(user.trainerXp % xpNeeded, xpNeeded)}\` ${user.trainerXp % xpNeeded}/${xpNeeded}`, inline: false },
        { name: '💰 Balance', value: `${formatNumber(user.balance)} PokéCoins`, inline: true },
        { name: '🏦 Bank', value: `${formatNumber(user.bankBalance)} PokéCoins`, inline: true },
        { name: `${tierEmoji[tier] ?? '🏅'} Ranked Tier`, value: `${tier} (${user.rankedPoints} pts)`, inline: true },
        { name: '🎾 Pokemon Caught', value: `${user.pokemonCaught.toLocaleString()}`, inline: true },
        { name: '✨ Shinies', value: `${user.shinyCaught}`, inline: true },
        { name: '⚡ Legendaries', value: `${user.legendariesCaught}`, inline: true },
        { name: '⚔️ Battle Record', value: `${user.battlesWon}W / ${user.battlesLost}L`, inline: true },
        { name: '🃏 Cards', value: `${user.cardsCollected}`, inline: true },
        { name: '🏆 Achievements', value: `${user.achievements.length}`, inline: true },
        { name: '🔥 Daily Streak', value: `${user.dailyStreak} days`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
