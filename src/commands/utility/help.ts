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
      pokemon: { emoji: '🎮', description: 'Pokémon collection and management', commands: ['/pokedex', '/box', '/team', '/catch', '/evolve', '/gift pokemon', '/trade', '/favorite', '/nickname', '/release', '/pokemon'] },
      economy: { emoji: '💰', description: 'Economy and earning PokéCoins', commands: ['/balance', '/daily', '/weekly', '/beg', '/work', '/rob', '/shop', '/inventory', '/pay', '/bank', '/rewards', '/career'] },
      cards: { emoji: '🃏', description: 'Pokémon card collection', commands: ['/pack', '/card', '/collection', '/giftpack'] },
      battles: { emoji: '⚔️', description: 'Pokémon battles', commands: ['/battle', '/battlehistory'] },
      social: { emoji: '👥', description: 'Profile and community features', commands: ['/profile', '/leaderboard', '/achievements', '/quests', '/creator', '/inspector'] },
      moderation: { emoji: '🔨', description: 'Server moderation (Mods only)', commands: ['/ban', '/kick', '/warn', '/timeout', '/warnings', '/purge', '/lock', '/unlock', '/slowmode'] },
      utility: { emoji: '🔧', description: 'Utility commands', commands: ['/help', '/ping', '/setup', '/welcome', '/giveaway', '/config', '/invite'] },
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
        .setTitle('📖 Pokémon Master Help')
        .setDescription('Use `/help <category>` for detailed command info!')
        .addFields(
          ...Object.entries(categories).map(([name, cat]) => ({
            name: `${cat.emoji} ${name.charAt(0).toUpperCase() + name.slice(1)}`,
            value: `${cat.description}\n${cat.commands.slice(0, 3).join(', ')}${cat.commands.length > 3 ? '...' : ''}`,
            inline: true,
          }))
        )
        .setFooter({ text: 'Pokémon Master Bot v1.0.0' });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
export default command;
