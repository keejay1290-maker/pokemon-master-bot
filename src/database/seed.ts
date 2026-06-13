import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const POKEMON_COUNT = 151; // Start with Gen 1, can extend to 1010+

interface PokeApiPokemon {
  id: number;
  name: string;
  types: Array<{ slot: number; type: { name: string } }>;
  stats: Array<{ base_stat: number; stat: { name: string } }>;
  abilities: Array<{ ability: { name: string }; is_hidden: boolean; slot: number }>;
  height: number;
  weight: number;
  sprites: { front_default: string | null; front_shiny: string | null };
  moves: Array<{ move: { name: string }; version_group_details: Array<{ level_learned_at: number; move_learn_method: { name: string } }> }>;
}

function getRarity(id: number): string {
  const legendary = [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251];
  const mythical = [151, 251];
  if (mythical.includes(id)) return 'Mythical';
  if (legendary.includes(id)) return 'Legendary';
  if ([147, 148, 149].includes(id)) return 'Epic';
  if ([137, 132, 113, 115, 143].includes(id)) return 'Rare';
  if (id % 10 === 0) return 'Uncommon';
  return 'Common';
}

function formatName(name: string): string {
  return name.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

async function seedPokemon() {
  console.log(`Seeding ${POKEMON_COUNT} Pokemon...`);
  let success = 0;

  for (let id = 1; id <= POKEMON_COUNT; id++) {
    try {
      const { data } = await axios.get<PokeApiPokemon>(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const types = data.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
      const getStat = (name: string) => data.stats.find((s) => s.stat.name === name)?.base_stat ?? 0;
      const moves = data.moves
        .filter((m) => m.version_group_details.some((v) => v.move_learn_method.name === 'level-up'))
        .slice(0, 4).map((m) => m.move.name);

      const rarity = getRarity(id);
      const isLegendary = ['Legendary'].includes(rarity);
      const isMythical = rarity === 'Mythical';

      await prisma.pokemon.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: data.name,
          nameDisplay: formatName(data.name),
          generation: id <= 151 ? 1 : id <= 251 ? 2 : id <= 386 ? 3 : 4,
          isLegendary,
          isMythical,
          type1: types[0] ?? 'normal',
          type2: types[1] ?? null,
          hp: getStat('hp'), attack: getStat('attack'), defense: getStat('defense'),
          spAttack: getStat('special-attack'), spDefense: getStat('special-defense'), speed: getStat('speed'),
          baseStatTotal: data.stats.reduce((s, st) => s + st.base_stat, 0),
          height: data.height / 10,
          weight: data.weight / 10,
          ability1: data.abilities.find((a) => a.slot === 1)?.ability.name ?? 'unknown',
          ability2: data.abilities.find((a) => a.slot === 2)?.ability.name ?? null,
          hiddenAbility: data.abilities.find((a) => a.is_hidden)?.ability.name ?? null,
          spriteUrl: data.sprites.front_default,
          shinySpriteUrl: data.sprites.front_shiny,
          artworkUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
          shinyArtworkUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`,
          rarity,
          spawnWeight: rarity === 'Common' ? 100 : rarity === 'Uncommon' ? 50 : rarity === 'Rare' ? 20 : rarity === 'Epic' ? 5 : rarity === 'Legendary' ? 1 : 0.5,
          catchRate: isLegendary ? 3 : isMythical ? 1 : 45,
        },
      });

      success++;
      if (id % 10 === 0) console.log(`  Seeded ${id}/${POKEMON_COUNT}...`);
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.error(`Failed to seed Pokemon #${id}:`, err);
    }
  }

  console.log(`✅ Seeded ${success}/${POKEMON_COUNT} Pokemon`);
}

async function seedAchievements() {
  const achievements = [
    { name: 'First Steps', description: 'Catch your first Pokemon', category: 'Catching', icon: '🎾', xpReward: 50, coinReward: 100, rarity: 'Common', condition: { type: 'catch', threshold: 1 } },
    { name: 'Catching Fever', description: 'Catch 10 Pokemon', category: 'Catching', icon: '🎾', xpReward: 100, coinReward: 250, rarity: 'Common', condition: { type: 'catch', threshold: 10 } },
    { name: 'Dedicated Trainer', description: 'Catch 50 Pokemon', category: 'Catching', icon: '🏆', xpReward: 250, coinReward: 500, rarity: 'Uncommon', condition: { type: 'catch', threshold: 50 } },
    { name: 'Pokemon Enthusiast', description: 'Catch 100 Pokemon', category: 'Catching', icon: '🌟', xpReward: 500, coinReward: 1000, rarity: 'Rare', condition: { type: 'catch', threshold: 100 } },
    { name: 'Master Trainer', description: 'Catch 500 Pokemon', category: 'Catching', icon: '👑', xpReward: 1000, coinReward: 5000, rarity: 'Epic', condition: { type: 'catch', threshold: 500 } },
    { name: 'Living Pokedex', description: 'Catch 1000 Pokemon', category: 'Catching', icon: '📖', xpReward: 5000, coinReward: 25000, rarity: 'Legendary', condition: { type: 'catch', threshold: 1000 } },
    { name: 'Shiny Hunter', description: 'Catch your first Shiny', category: 'Shiny', icon: '✨', xpReward: 500, coinReward: 2500, rarity: 'Rare', condition: { type: 'shiny', threshold: 1 } },
    { name: 'Shiny Collector', description: 'Catch 10 Shiny Pokemon', category: 'Shiny', icon: '💎', xpReward: 2000, coinReward: 10000, rarity: 'Epic', condition: { type: 'shiny', threshold: 10 } },
    { name: 'Shiny Master', description: 'Catch 50 Shiny Pokemon', category: 'Shiny', icon: '🌈', xpReward: 10000, coinReward: 50000, rarity: 'Legendary', condition: { type: 'shiny', threshold: 50 } },
    { name: 'Legendary Spotter', description: 'Catch your first Legendary', category: 'Legendary', icon: '🦅', xpReward: 1000, coinReward: 5000, rarity: 'Epic', condition: { type: 'legendary', threshold: 1 } },
    { name: 'Legendary Collector', description: 'Catch 10 Legendaries', category: 'Legendary', icon: '⚡', xpReward: 5000, coinReward: 25000, rarity: 'Legendary', condition: { type: 'legendary', threshold: 10 } },
    { name: 'First Victory', description: 'Win your first battle', category: 'Battle', icon: '⚔️', xpReward: 100, coinReward: 200, rarity: 'Common', condition: { type: 'battle_win', threshold: 1 } },
    { name: 'Veteran Battler', description: 'Win 50 battles', category: 'Battle', icon: '🏅', xpReward: 500, coinReward: 1000, rarity: 'Uncommon', condition: { type: 'battle_win', threshold: 50 } },
    { name: 'Battle Master', description: 'Win 200 battles', category: 'Battle', icon: '🥇', xpReward: 2000, coinReward: 5000, rarity: 'Rare', condition: { type: 'battle_win', threshold: 200 } },
    { name: 'Undefeated', description: 'Win 1000 battles', category: 'Battle', icon: '👑', xpReward: 10000, coinReward: 50000, rarity: 'Legendary', condition: { type: 'battle_win', threshold: 1000 } },
    { name: 'Coin Flip', description: 'Earn 10,000 total coins', category: 'Economy', icon: '🪙', xpReward: 100, coinReward: 500, rarity: 'Common', condition: { type: 'coins', threshold: 10000 } },
    { name: 'Investor', description: 'Earn 100,000 total coins', category: 'Economy', icon: '💵', xpReward: 500, coinReward: 2000, rarity: 'Uncommon', condition: { type: 'coins', threshold: 100000 } },
    { name: 'Millionaire', description: 'Earn 1,000,000 total coins', category: 'Economy', icon: '💰', xpReward: 2000, coinReward: 10000, rarity: 'Epic', condition: { type: 'coins', threshold: 1000000 } },
    { name: 'Billionaire', description: 'Earn 1,000,000,000 total coins', category: 'Economy', icon: '💎', xpReward: 50000, coinReward: 1000000, rarity: 'Legendary', condition: { type: 'coins', threshold: 1000000000 } },
    { name: 'Card Collector', description: 'Collect 100 cards', category: 'Cards', icon: '🃏', xpReward: 500, coinReward: 1000, rarity: 'Uncommon', condition: { type: 'card', threshold: 100 } },
    { name: 'Card Hoarder', description: 'Collect 500 cards', category: 'Cards', icon: '🎴', xpReward: 2000, coinReward: 5000, rarity: 'Rare', condition: { type: 'card', threshold: 500 } },
    { name: 'Card Master', description: 'Collect 2000 cards', category: 'Cards', icon: '🏆', xpReward: 10000, coinReward: 25000, rarity: 'Epic', condition: { type: 'card', threshold: 2000 } },
    { name: 'Rookie Trainer', description: 'Reach Trainer Level 10', category: 'Progression', icon: '⭐', xpReward: 200, coinReward: 500, rarity: 'Common', condition: { type: 'level', threshold: 10 } },
    { name: 'Seasoned Trainer', description: 'Reach Trainer Level 25', category: 'Progression', icon: '🌟', xpReward: 500, coinReward: 1500, rarity: 'Uncommon', condition: { type: 'level', threshold: 25 } },
    { name: 'Expert Trainer', description: 'Reach Trainer Level 50', category: 'Progression', icon: '💫', xpReward: 1500, coinReward: 5000, rarity: 'Rare', condition: { type: 'level', threshold: 50 } },
    { name: 'Elite Trainer', description: 'Reach Trainer Level 75', category: 'Progression', icon: '✨', xpReward: 5000, coinReward: 15000, rarity: 'Epic', condition: { type: 'level', threshold: 75 } },
    { name: 'Pokemon Master', description: 'Reach Trainer Level 100', category: 'Progression', icon: '👑', xpReward: 20000, coinReward: 100000, rarity: 'Legendary', condition: { type: 'level', threshold: 100 } },
  ];

  for (const ach of achievements) {
    await prisma.achievement.upsert({ where: { name: ach.name }, update: {}, create: ach });
  }
  console.log(`✅ Seeded ${achievements.length} achievements`);
}

async function seedQuests() {
  const quests = [
    { name: 'Daily Catch', description: 'Catch 5 Pokemon today', type: 'catch', category: 'daily', xpReward: 100, coinReward: 200, requirement: { count: 5 }, resetPeriod: 'daily' },
    { name: 'Daily Battle', description: 'Win 3 battles today', type: 'battle_win', category: 'daily', xpReward: 150, coinReward: 300, requirement: { count: 3 }, resetPeriod: 'daily' },
    { name: 'Daily Coins', description: 'Earn 1000 coins today', type: 'earn_coins', category: 'daily', xpReward: 75, coinReward: 150, requirement: { amount: 1000 }, resetPeriod: 'daily' },
    { name: 'Daily Pack', description: 'Open 1 card pack', type: 'open_pack', category: 'daily', xpReward: 100, coinReward: 250, requirement: { count: 1 }, resetPeriod: 'daily' },
    { name: 'Weekly Grind', description: 'Catch 30 Pokemon this week', type: 'catch', category: 'weekly', xpReward: 500, coinReward: 1000, requirement: { count: 30 }, resetPeriod: 'weekly' },
    { name: 'Weekly Champion', description: 'Win 15 battles this week', type: 'battle_win', category: 'weekly', xpReward: 750, coinReward: 1500, requirement: { count: 15 }, resetPeriod: 'weekly' },
    { name: 'Weekly Collector', description: 'Open 10 card packs this week', type: 'open_pack', category: 'weekly', xpReward: 600, coinReward: 1200, requirement: { count: 10 }, resetPeriod: 'weekly' },
  ];

  for (const q of quests) {
    await prisma.quest.upsert({ where: { id: q.name }, update: {}, create: { ...q, id: q.name } }).catch(() => {});
  }
  console.log(`✅ Seeded ${quests.length} quests`);
}

async function seedEvents() {
  const now = new Date();
  const events = [
    {
      name: 'Pokemon Day',
      description: 'Celebrate the anniversary of Pokemon! Special Mew spawns and increased shiny rates.',
      type: 'anniversary',
      startDate: new Date('2024-02-27'),
      endDate: new Date('2024-03-05'),
      rewards: { coins: 5000, shinyRateBoost: 3 },
      bonuses: { spawnRateBoost: 2, shinyRateBoost: 3 },
    },
    {
      name: 'Halloween Event',
      description: 'Ghost and Dark type Pokemon appear more frequently! Gengar has increased shiny odds.',
      type: 'seasonal',
      startDate: new Date('2024-10-25'),
      endDate: new Date('2024-11-01'),
      rewards: { coins: 3000 },
      bonuses: { ghostBoost: 5, darkBoost: 5 },
    },
  ];

  for (const e of events) {
    await prisma.event.create({ data: e }).catch(() => {});
  }
  console.log(`✅ Seeded ${events.length} events`);
}

async function main() {
  console.log('🌱 Starting database seed...\n');
  await seedAchievements();
  await seedQuests();
  await seedEvents();
  await seedPokemon();
  console.log('\n✅ Database seed complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
