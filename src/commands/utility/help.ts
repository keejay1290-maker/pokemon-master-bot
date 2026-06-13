import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available commands')
    .addStringOption((o) => o.setName('category').setDescription('Command category').addChoices(
      { name: 'Pokemon', value: 'pokemon' },
      { name: 'Economy', value: 'economy' },
      { name: 'Cards', value: 'cards' },
      { name: 'Battles', value: 'battles' },
      { name: 'Social', value: 'social' },
      { name: 'Moderation', value: 'moderation' },
      { name: 'Utility', value: 'utility' },
    )),

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient) {
    const category = interaction.options.getString('category');
    const categories: Record<string, { commands: string[]; emoji: string; description: string }> = {
      pokemon: { emoji: '🎮', description: 'Pokemon collection and management', commands: ['/pokemon', '/pokedex', '/catch', '/box', '/team', '/trade', '/favorite', '/release'] },
      economy: { emoji: '💰', description: 'Economy and earning PokéCoins', commands: ['/balance', '/daily', '/weekly', '/work', '/fish', '/hunt', '/beg', '/rob', '/deposit', '/withdraw', '/shop'] },
      cards: { emoji: '🃏', description: 'Pokemon card collection', commands: ['/pack', '/card', '/collection'] },
      battles: { emoji: '⚔️', description: 'Pokemon battles', commands: ['/battle'] },
      social: { emoji: '👥', description: 'Profile and community features', commands: ['/profile', '/leaderboard', '/achievements', '/quests'] },
      moderation: { emoji: '🔨', description: 'Server moderation (Mods only)', commands: ['/ban', '/kick', '/warn', '/timeout', '/warnings', '/purge', '/lock', '/unlock', '/slowmode'] },
      utility: { emoji: '🔧', description: 'Utility commands', commands: ['/ping', '/help', '/setup', '/welcome', '/professor', '/giveaway', '/config'] },
    };

    if (category && categories[category]) {
      const cat = categories[category];
      const embed = new EmbedBuilder()
        .setColor(0xffcb05)
        .setTitle(`${cat.emoji} ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`)
        .setDescription(cat.description)
        .addFields({ name: 'Commands', value: cat.commands.join('\n') });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      const embed = new EmbedBuilder()
        .setColor(0xffcb05)
        .setTitle('📖 Pokemon Master Help')
        .setDescription('Use `/help <category>` for detailed command info!')
        .addFields(
          ...Object.entries(categories).map(([name, cat]) => ({
            name: `${cat.emoji} ${name.charAt(0).toUpperCase() + name.slice(1)}`,
            value: `${cat.description}\n${cat.commands.slice(0, 3).join(', ')}${cat.commands.length > 3 ? '...' : ''}`,
            inline: true,
          }))
        )
        .setFooter({ text: 'Pokemon Master Bot v1.0.0' });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
export default command;
