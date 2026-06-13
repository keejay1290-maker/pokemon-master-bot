import type { BotClient } from '../types/index.js';
import { EmbedBuilder } from 'discord.js';

export interface AchievementCheck {
  userId: string;
  type: 'catch' | 'shiny' | 'legendary' | 'battle_win' | 'coins' | 'card' | 'trade' | 'streak' | 'level';
  value: number;
}

const ACHIEVEMENTS = [
  { name: 'First Steps', description: 'Catch your first Pokemon', category: 'Catching', icon: '🎾', xpReward: 50, coinReward: 100, rarity: 'Common', condition: { type: 'catch', threshold: 1 } },
  { name: 'Catching Fever', description: 'Catch 10 Pokemon', category: 'Catching', icon: '🎾', xpReward: 100, coinReward: 250, rarity: 'Common', condition: { type: 'catch', threshold: 10 } },
  { name: 'Dedicated Trainer', description: 'Catch 50 Pokemon', category: 'Catching', icon: '🏆', xpReward: 250, coinReward: 500, rarity: 'Uncommon', condition: { type: 'catch', threshold: 50 } },
  { name: 'Pokemon Enthusiast', description: 'Catch 100 Pokemon', category: 'Catching', icon: '🌟', xpReward: 500, coinReward: 1000, rarity: 'Rare', condition: { type: 'catch', threshold: 100 } },
  { name: 'Master Trainer', description: 'Catch 500 Pokemon', category: 'Catching', icon: '👑', xpReward: 1000, coinReward: 5000, rarity: 'Epic', condition: { type: 'catch', threshold: 500 } },
  { name: 'Living Pokedex', description: 'Catch 1000 Pokemon', category: 'Catching', icon: '📖', xpReward: 5000, coinReward: 25000, rarity: 'Legendary', condition: { type: 'catch', threshold: 1000 } },
  { name: 'Shiny Hunter', description: 'Catch your first Shiny Pokemon', category: 'Shiny', icon: '✨', xpReward: 500, coinReward: 2500, rarity: 'Rare', condition: { type: 'shiny', threshold: 1 } },
  { name: 'Shiny Collector', description: 'Catch 10 Shiny Pokemon', category: 'Shiny', icon: '💎', xpReward: 2000, coinReward: 10000, rarity: 'Epic', condition: { type: 'shiny', threshold: 10 } },
  { name: 'Shiny Master', description: 'Catch 50 Shiny Pokemon', category: 'Shiny', icon: '🌈', xpReward: 10000, coinReward: 50000, rarity: 'Legendary', condition: { type: 'shiny', threshold: 50 } },
  { name: 'Legendary Spotter', description: 'Catch your first Legendary Pokemon', category: 'Legendary', icon: '🦅', xpReward: 1000, coinReward: 5000, rarity: 'Epic', condition: { type: 'legendary', threshold: 1 } },
  { name: 'Legendary Collector', description: 'Catch 10 Legendary Pokemon', category: 'Legendary', icon: '⚡', xpReward: 5000, coinReward: 25000, rarity: 'Legendary', condition: { type: 'legendary', threshold: 10 } },
  { name: 'First Victory', description: 'Win your first battle', category: 'Battle', icon: '⚔️', xpReward: 100, coinReward: 200, rarity: 'Common', condition: { type: 'battle_win', threshold: 1 } },
  { name: 'Veteran Battler', description: 'Win 50 battles', category: 'Battle', icon: '🏅', xpReward: 500, coinReward: 1000, rarity: 'Uncommon', condition: { type: 'battle_win', threshold: 50 } },
  { name: 'Battle Master', description: 'Win 200 battles', category: 'Battle', icon: '🥇', xpReward: 2000, coinReward: 5000, rarity: 'Rare', condition: { type: 'battle_win', threshold: 200 } },
  { name: 'Millionaire', description: 'Earn 1,000,000 PokeCoins total', category: 'Economy', icon: '💰', xpReward: 2000, coinReward: 10000, rarity: 'Epic', condition: { type: 'coins', threshold: 1000000 } },
  { name: 'Card Collector', description: 'Collect 100 cards', category: 'Cards', icon: '🃏', xpReward: 500, coinReward: 1000, rarity: 'Uncommon', condition: { type: 'card', threshold: 100 } },
  { name: 'Card Master', description: 'Collect 500 cards', category: 'Cards', icon: '🎴', xpReward: 2000, coinReward: 5000, rarity: 'Rare', condition: { type: 'card', threshold: 500 } },
  { name: 'Trader', description: 'Complete 10 trades', category: 'Trading', icon: '🤝', xpReward: 300, coinReward: 600, rarity: 'Common', condition: { type: 'trade', threshold: 10 } },
];

export async function seedAchievements(client: BotClient) {
  for (const ach of ACHIEVEMENTS) {
    await client.prisma.achievement.upsert({
      where: { name: ach.name },
      update: {},
      create: ach,
    });
  }
}

export async function checkAndAwardAchievements(
  client: BotClient,
  userId: string,
  channelId?: string,
  guildId?: string
): Promise<void> {
  const user = await client.prisma.user.findUnique({
    where: { id: userId },
    include: { achievements: { include: { achievement: true } } },
  });
  if (!user) return;

  const earnedIds = new Set(user.achievements.map((a) => a.achievementId));
  const allAchievements = await client.prisma.achievement.findMany();

  for (const ach of allAchievements) {
    if (earnedIds.has(ach.id)) continue;

    const cond = ach.condition as { type: string; threshold: number };
    let met = false;

    switch (cond.type) {
      case 'catch': met = user.pokemonCaught >= cond.threshold; break;
      case 'shiny': met = user.shinyCaught >= cond.threshold; break;
      case 'legendary': met = user.legendariesCaught >= cond.threshold; break;
      case 'battle_win': met = user.battlesWon >= cond.threshold; break;
      case 'coins': met = user.totalEarned >= cond.threshold; break;
      case 'card': met = user.cardsCollected >= cond.threshold; break;
      case 'level': met = user.trainerLevel >= cond.threshold; break;
    }

    if (!met) continue;

    await client.prisma.userAchievement.create({
      data: { userId, achievementId: ach.id },
    });

    if (ach.coinReward > 0) {
      await client.prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: ach.coinReward }, trainerXp: { increment: ach.xpReward } },
      });
    }

    if (channelId && guildId) {
      const channel = client.guilds.cache.get(guildId)?.channels.cache.get(channelId);
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle(`🏆 Achievement Unlocked!`)
          .setDescription(`<@${userId}> earned **${ach.icon} ${ach.name}**!\n${ach.description}`)
          .addFields(
            { name: 'Reward', value: `+${ach.coinReward.toLocaleString()} PokeCoins\n+${ach.xpReward} XP`, inline: true },
            { name: 'Rarity', value: ach.rarity, inline: true }
          );
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  }
}
