import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { BotClient, Command } from '../../types/index.js';
import { askProfessor, GROQ_MODELS } from '../../services/groqService.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('professor')
    .setDescription('Ask Professor Oak a Pokemon question')
    .addSubcommand((s) =>
      s.setName('ask').setDescription('Ask a question')
        .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true))
        .addStringOption((o) => o.setName('model').setDescription('AI model').addChoices(
          ...GROQ_MODELS.map((m) => ({ name: m, value: m }))
        ))
    ),
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'ask') return;

    const question = interaction.options.getString('question', true);
    const model = interaction.options.getString('model') ?? undefined;

    const { onCooldown, remaining } = await checkCooldown(client, interaction.user.id, 'professor', 15);
    if (onCooldown) {
      await interaction.reply({ content: `⏰ Professor Oak is busy! Try again in ${remaining}s.`, ephemeral: true });
      return;
    }

    await interaction.deferReply();
    await setCooldown(client, interaction.user.id, 'professor', 15);

    const answer = await askProfessor(question, model).catch(() => 'Professor Oak is currently unavailable. Please try again later!');

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🔬 Professor Oak\'s Research Lab')
      .addFields(
        { name: '❓ Question', value: question },
        { name: '📚 Answer', value: answer },
      )
      .setFooter({ text: `Model: ${model ?? process.env.GROQ_MODEL ?? 'llama-3.1-70b-versatile'}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
export default command;
