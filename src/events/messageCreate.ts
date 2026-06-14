import { Message, EmbedBuilder } from 'discord.js';
import type { BotClient } from '../types/index.js';
import { checkAutoMod } from '../services/moderationService.js';
import { handleSpawnMessage } from '../services/spawnService.js';
import { askProfessor } from '../services/groqService.js';

// Per-user cooldown for mention responses (60s) — stored in Redis
const MENTION_COOLDOWN = 60;

export async function handleMessageCreate(message: Message, client: BotClient) {
  if (message.author.bot || !message.guild) return;

  // Auto-mod check
  await checkAutoMod(message, client).catch(() => {});

  // Random spawn trigger
  await handleSpawnMessage(message, client).catch(() => {});

  // XP gain (60s cooldown)
  const xpKey = `xp:cooldown:${message.guild.id}:${message.author.id}`;
  const hasXpCooldown = await client.redis.get(xpKey);
  if (!hasXpCooldown) {
    const xpGain = Math.floor(Math.random() * 15) + 5;
    await client.prisma.guildUser.upsert({
      where: { guildId_userId: { guildId: message.guild.id, userId: message.author.id } },
      update: { xp: { increment: xpGain }, messages: { increment: 1 } },
      create: { guildId: message.guild.id, userId: message.author.id, xp: xpGain, messages: 1 },
    }).catch(() => {});
    await client.redis.set(xpKey, '1', { EX: 60 });
  }

  // Bot mention → Professor Oak AI
  if (client.user && message.mentions.has(client.user)) {
    await handleMentionAI(message, client).catch(() => {});
  }
}

async function handleMentionAI(message: Message, client: BotClient) {
  // Per-user cooldown
  const coolKey = `mention:cd:${message.author.id}`;
  const onCooldown = await client.redis.get(coolKey);
  if (onCooldown) {
    // Silently ignore — don't spam the channel with cooldown messages
    return;
  }

  // Strip the mention from the message content
  const question = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!question) {
    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x3b82f6)
        .setDescription('Ah, a Trainer approaches! Ask me anything about Pokémon, battles, or how this bot works.')],
    });
    return;
  }

  // Show typing indicator while Groq responds
  if ('sendTyping' in message.channel) {
    await (message.channel as any).sendTyping().catch(() => {});
  }

  const answer = await askProfessor(question).catch(() => null);

  if (!answer) {
    await message.reply({ content: "My research terminal seems to be offline right now. Try again in a moment!" });
    return;
  }

  await message.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x3b82f6)
      .setAuthor({ name: 'Professor Oak', iconURL: client.user?.displayAvatarURL() })
      .setDescription(answer)
      .setFooter({ text: 'Ask me anything about Pokémon!' })],
  });

  // Set cooldown after successful response
  await client.redis.set(coolKey, '1', { EX: MENTION_COOLDOWN });
}
