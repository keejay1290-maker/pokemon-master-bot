import Groq from 'groq-sdk';

let groqClient: Groq | null = null;

function getGroq(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

export async function askProfessor(question: string, model?: string): Promise<string> {
  const groq = getGroq();
  const modelToUse = model ?? process.env.GROQ_MODEL ?? 'llama-3.1-70b-versatile';

  const systemPrompt = `You are Professor Oak, the world's leading Pokemon researcher and expert. 
You have encyclopedic knowledge of all Pokemon, their types, abilities, moves, evolutions, locations, 
lore, competitive strategies, and the Pokemon Trading Card Game. You give helpful, accurate, and 
enthusiastic advice about Pokemon. Keep responses concise (under 500 words) but informative. 
Use Pokemon-themed language and show genuine excitement about Pokemon research!`;

  const response = await groq.chat.completions.create({
    model: modelToUse,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
    max_tokens: 600,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content ?? 'The professor seems to be busy with research. Please try again later!';
}

export const GROQ_MODELS = [
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];
