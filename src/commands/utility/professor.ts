import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { askProfessor, GROQ_MODELS } from '../../services/groqService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('professor')
    .setDescription('Ask Professor Oak a Pokémon question')
    .addSubcommand((s) =>
      s.setName('ask').setDescription('Ask Professor Oak anything about Pokémon')
        .addStringOption((o) => o.setName('question').setDescription('Your question for the Professor').setRequired(true))
        .addStringOption((o) => o.setName('model').setDescription('AI model to use').addChoices(
          ...GROQ_MODELS.map((m) => ({ name: m.label, value: m.id }))
        ))
    ),
  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'ask') return;

    const question = interaction.options.getString('question', true);
    const model = interaction.options.getString('model') ?? undefined;

    await interaction.deferReply();

    const answer = await askProfessor(question, model).catch((err) => {
      client.logger.error('Professor Oak Groq error:', err);
      return null;
    });

    if (!answer) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle('📡 Professor Oak is Unreachable')
          .setDescription(
            'My research lab seems to be having connectivity issues right now. ' +
            'The Pokédex uplink is down! Please try again in a moment, Trainer.'
          )
          .setFooter({ text: 'If this persists, the Groq API key may need checking.' })],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🔬 Professor Oak\'s Research Lab')
      .addFields(
        { name: '❓ Your Question', value: question.length > 1024 ? question.slice(0, 1021) + '...' : question },
        { name: '📚 Professor Oak Says', value: answer.length > 1024 ? answer.slice(0, 1021) + '...' : answer },
      )
      .setFooter({ text: `Model: ${model ?? process.env.GROQ_MODEL ?? GROQ_MODELS[0].id} • Cooldown: 30s` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
