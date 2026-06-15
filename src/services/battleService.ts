import type { BotClient, BattleState, BattlePokemon, StatStages, MoveData } from '../types/index.js';
import { calcPokemonStats, getTypeEffectiveness, getEffectivenessText, TYPE_CHART } from '../utils/pokemon.js';
import { PrismaClient } from '@prisma/client';
import { addXp } from './userService.js';
import { checkAndAwardAchievements } from './achievementService.js';
import { incrementQuestProgress } from './questService.js';

// Lookup table for common moves. Battle uses this to get real power + category.
// Unknown moves default to Normal/Physical/50.
export const MOVE_TABLE: Record<string, Omit<MoveData, 'name'>> = {
  tackle:       { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 35 },
  scratch:      { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 35 },
  pound:        { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 35 },
  growl:        { type: 'normal',   category: 'Status',   power: 0,   accuracy: 100, pp: 40 },
  leer:         { type: 'normal',   category: 'Status',   power: 0,   accuracy: 100, pp: 30 },
  tail_whip:    { type: 'normal',   category: 'Status',   power: 0,   accuracy: 100, pp: 30 },
  'tail whip':  { type: 'normal',   category: 'Status',   power: 0,   accuracy: 100, pp: 30 },
  quick_attack: { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 30, priority: 1 },
  'quick attack': { type: 'normal', category: 'Physical', power: 40,  accuracy: 100, pp: 30, priority: 1 },
  headbutt:     { type: 'normal',   category: 'Physical', power: 70,  accuracy: 100, pp: 15 },
  'body slam':  { type: 'normal',   category: 'Physical', power: 85,  accuracy: 100, pp: 15 },
  body_slam:    { type: 'normal',   category: 'Physical', power: 85,  accuracy: 100, pp: 15 },
  swift:        { type: 'normal',   category: 'Special',  power: 60,  accuracy: 100, pp: 20 },
  'hyper beam': { type: 'normal',   category: 'Special',  power: 150, accuracy: 90,  pp: 5  },
  hyper_beam:   { type: 'normal',   category: 'Special',  power: 150, accuracy: 90,  pp: 5  },
  // Fire
  ember:        { type: 'fire',     category: 'Special',  power: 40,  accuracy: 100, pp: 25 },
  flamethrower: { type: 'fire',     category: 'Special',  power: 90,  accuracy: 100, pp: 15 },
  'fire blast': { type: 'fire',     category: 'Special',  power: 110, accuracy: 85,  pp: 5  },
  fire_blast:   { type: 'fire',     category: 'Special',  power: 110, accuracy: 85,  pp: 5  },
  'fire spin':  { type: 'fire',     category: 'Special',  power: 35,  accuracy: 85,  pp: 15 },
  // Water
  'water gun':  { type: 'water',    category: 'Special',  power: 40,  accuracy: 100, pp: 25 },
  water_gun:    { type: 'water',    category: 'Special',  power: 40,  accuracy: 100, pp: 25 },
  surf:         { type: 'water',    category: 'Special',  power: 90,  accuracy: 100, pp: 15 },
  'water pulse':{ type: 'water',    category: 'Special',  power: 60,  accuracy: 100, pp: 20 },
  // Grass
  'vine whip':  { type: 'grass',    category: 'Physical', power: 45,  accuracy: 100, pp: 25 },
  vine_whip:    { type: 'grass',    category: 'Physical', power: 45,  accuracy: 100, pp: 25 },
  'razor leaf': { type: 'grass',    category: 'Physical', power: 55,  accuracy: 95,  pp: 25 },
  razor_leaf:   { type: 'grass',    category: 'Physical', power: 55,  accuracy: 95,  pp: 25 },
  'solar beam': { type: 'grass',    category: 'Special',  power: 120, accuracy: 100, pp: 10 },
  solar_beam:   { type: 'grass',    category: 'Special',  power: 120, accuracy: 100, pp: 10 },
  // Electric
  'thunder shock': { type: 'electric', category: 'Special', power: 40, accuracy: 100, pp: 30 },
  thundershock: { type: 'electric', category: 'Special',  power: 40,  accuracy: 100, pp: 30 },
  thunderbolt:  { type: 'electric', category: 'Special',  power: 90,  accuracy: 100, pp: 15 },
  thunder:      { type: 'electric', category: 'Special',  power: 110, accuracy: 70,  pp: 10 },
  // Psychic
  psychic:      { type: 'psychic',  category: 'Special',  power: 90,  accuracy: 100, pp: 10 },
  confusion:    { type: 'psychic',  category: 'Special',  power: 50,  accuracy: 100, pp: 25 },
  // Ice
  'ice beam':   { type: 'ice',      category: 'Special',  power: 90,  accuracy: 100, pp: 10 },
  ice_beam:     { type: 'ice',      category: 'Special',  power: 90,  accuracy: 100, pp: 10 },
  blizzard:     { type: 'ice',      category: 'Special',  power: 110, accuracy: 70,  pp: 5  },
  // Rock / Ground
  earthquake:   { type: 'ground',   category: 'Physical', power: 100, accuracy: 100, pp: 10 },
  'rock slide': { type: 'rock',     category: 'Physical', power: 75,  accuracy: 90,  pp: 10 },
  rock_slide:   { type: 'rock',     category: 'Physical', power: 75,  accuracy: 90,  pp: 10 },
  // Ghost / Dark
  'shadow ball':{ type: 'ghost',    category: 'Special',  power: 80,  accuracy: 100, pp: 15 },
  shadow_ball:  { type: 'ghost',    category: 'Special',  power: 80,  accuracy: 100, pp: 15 },
  bite:         { type: 'dark',     category: 'Physical', power: 60,  accuracy: 100, pp: 25 },
  crunch:       { type: 'dark',     category: 'Physical', power: 80,  accuracy: 100, pp: 15 },
  // Dragon / Steel
  'dragon claw':{ type: 'dragon',   category: 'Physical', power: 80,  accuracy: 100, pp: 15 },
  dragon_claw:  { type: 'dragon',   category: 'Physical', power: 80,  accuracy: 100, pp: 15 },
  'iron tail':  { type: 'steel',    category: 'Physical', power: 100, accuracy: 75,  pp: 15 },
  iron_tail:    { type: 'steel',    category: 'Physical', power: 100, accuracy: 75,  pp: 15 },
  // Fighting / Poison / Flying / Bug / Fairy
  'karate chop':{ type: 'fighting', category: 'Physical', power: 50,  accuracy: 100, pp: 25 },
  'cross chop': { type: 'fighting', category: 'Physical', power: 100, accuracy: 80,  pp: 5  },
  'poison sting':{ type: 'poison',  category: 'Physical', power: 15,  accuracy: 100, pp: 35 },
  'gust':       { type: 'flying',   category: 'Special',  power: 40,  accuracy: 100, pp: 35 },
  'wing attack':{ type: 'flying',   category: 'Physical', power: 60,  accuracy: 100, pp: 35 },
  'bug bite':   { type: 'bug',      category: 'Physical', power: 60,  accuracy: 100, pp: 20 },
  'moon blast': { type: 'fairy',    category: 'Special',  power: 95,  accuracy: 100, pp: 15 },
};

export function getMoveData(moveName: string): MoveData {
  const key = moveName.toLowerCase().replace(/_/g, ' ');
  const entry = MOVE_TABLE[key] ?? MOVE_TABLE[moveName.toLowerCase()];
  if (entry) return { name: moveName, ...entry };
  // Unknown move: treat as Normal Physical 50
  return { name: moveName, type: 'normal', category: 'Physical', power: 50, accuracy: 100, pp: 20 };
}

export async function loadBattleTeam(
  prisma: PrismaClient,
  userId: string
): Promise<BattlePokemon[]> {
  const teamPokemon = await prisma.userPokemon.findMany({
    where: { userId, isInTeam: true },
    include: { pokemon: true },
    orderBy: { teamSlot: 'asc' },
    take: 6,
  });

  if (teamPokemon.length === 0) {
    const firstPokemon = await prisma.userPokemon.findFirst({
      where: { userId },
      include: { pokemon: true },
    });
    if (!firstPokemon) return [];
    teamPokemon.push(firstPokemon);
  }

  // Batch-fetch move data from DB for all Pokémon in the team
  const allPokemonIds = teamPokemon.map((up) => up.pokemon.id);
  const dbMoves = await prisma.pokemonMove.findMany({
    where: { pokemonId: { in: allPokemonIds } },
  });
  // Index by pokemonId → moveName for O(1) lookups
  const dbMoveIndex: Record<string, Record<string, typeof dbMoves[0]>> = {};
  for (const m of dbMoves) {
    if (!dbMoveIndex[m.pokemonId]) dbMoveIndex[m.pokemonId] = {};
    dbMoveIndex[m.pokemonId][m.moveName.toLowerCase()] = m;
  }

  return teamPokemon.map((up) => {
    const stats = calcPokemonStats(up.pokemon, up);
    const types = [up.pokemon.type1, up.pokemon.type2].filter(Boolean) as string[];
    const moveNames = up.moves.length > 0 ? up.moves : ['tackle', 'growl', 'scratch', 'ember'];
    const pokemonMoves = dbMoveIndex[up.pokemon.id] ?? {};

    const moveData: MoveData[] = moveNames.map((name) => {
      const dbEntry = pokemonMoves[name.toLowerCase()];
      if (dbEntry) {
        return {
          name: dbEntry.moveName,
          type: dbEntry.moveType,
          category: dbEntry.category as MoveData['category'],
          power: dbEntry.power ?? 0,
          accuracy: dbEntry.accuracy ?? 100,
          pp: dbEntry.pp,
        };
      }
      // Fall back to static table for default / unknown moves
      return getMoveData(name);
    });

    return {
      userPokemonId: up.id,
      pokemonId: up.pokemon.id,
      name: up.nickname ?? up.pokemon.nameDisplay,
      level: up.level,
      isShiny: up.isShiny,
      nature: up.nature,
      types,
      moves: moveNames,
      moveData,
      heldItem: up.heldItem ?? undefined,
      maxHp: stats.hp,
      currentHp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      spAttack: stats.spAttack,
      spDefense: stats.spDefense,
      speed: stats.speed,
      statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
      volatileStatus: [],
      ability: up.pokemon.ability1,
    };
  });
}

export function calcDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: MoveData,
  weather: string
): { damage: number; effectiveness: number; isCrit: boolean } {
  if (move.category === 'Status' || !move.power) {
    return { damage: 0, effectiveness: 1, isCrit: false };
  }

  const atk = move.category === 'Physical' ? attacker.attack : attacker.spAttack;
  const def = move.category === 'Physical' ? defender.defense : defender.spDefense;

  const levelFactor = (2 * attacker.level) / 5 + 2;
  const baseDmg = Math.floor((levelFactor * move.power * atk) / def / 50) + 2;

  // Random factor (85–100%)
  const random = (Math.floor(Math.random() * 16) + 85) / 100;

  // STAB: 1.5x if move type matches one of the attacker's types
  const stab = attacker.types.includes(move.type.toLowerCase()) ? 1.5 : 1.0;

  // Type effectiveness against both of defender's types
  const effectiveness = getTypeEffectiveness(move.type, defender.types[0] ?? 'normal', defender.types[1]);

  // Crit (6.25% chance — Gen 3+ base rate)
  const isCrit = Math.random() < 0.0625;
  const critMod = isCrit ? 1.5 : 1;

  // Weather
  let weatherMod = 1;
  if (weather === 'sunny' && move.type === 'fire') weatherMod = 1.5;
  if (weather === 'sunny' && move.type === 'water') weatherMod = 0.5;
  if (weather === 'rainy' && move.type === 'water') weatherMod = 1.5;
  if (weather === 'rainy' && move.type === 'fire') weatherMod = 0.5;
  if (weather === 'sandstorm' && move.type === 'rock') weatherMod = 1.5;

  const damage = Math.max(1, Math.floor(baseDmg * random * stab * effectiveness * critMod * weatherMod));
  return { damage, effectiveness, isCrit };
}

export function applyStatStage(base: number, stage: number): number {
  const multipliers = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 3 / 2, 2, 3, 4];
  const idx = Math.max(0, Math.min(8, stage + 4));
  return Math.floor(base * multipliers[idx]);
}

export function applyStatusDamage(pokemon: BattlePokemon): { damage: number; message: string } {
  if (pokemon.statusEffect === 'poison') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    return { damage, message: `🟣 ${pokemon.name} is hurt by poison! (-${damage} HP)` };
  }
  if (pokemon.statusEffect === 'burn') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 16));
    return { damage, message: `🔥 ${pokemon.name} is hurt by its burn! (-${damage} HP)` };
  }
  return { damage: 0, message: '' };
}

/** Returns whether the move hits, based on its accuracy field. */
export function checkAccuracy(accuracy: number): boolean {
  if (accuracy >= 100) return true;
  return Math.random() * 100 < accuracy;
}

/**
 * Returns { blocked, message, cured } for sleep/freeze/paralysis.
 * Mutates pokemon.statusEffect / statusTurns if status is cured.
 */
export function checkStatusBlock(pokemon: BattlePokemon): { blocked: boolean; message: string; cured: boolean } {
  if (pokemon.statusEffect === 'sleep') {
    // 33% chance to wake each turn
    if (Math.random() < 0.33) {
      pokemon.statusEffect = undefined;
      return { blocked: false, message: `😴 ${pokemon.name} woke up!`, cured: true };
    }
    return { blocked: true, message: `😴 ${pokemon.name} is fast asleep!`, cured: false };
  }
  if (pokemon.statusEffect === 'freeze') {
    // 20% chance to thaw each turn
    if (Math.random() < 0.20) {
      pokemon.statusEffect = undefined;
      return { blocked: false, message: `🧊 ${pokemon.name} thawed out!`, cured: true };
    }
    return { blocked: true, message: `🧊 ${pokemon.name} is frozen solid!`, cured: false };
  }
  if (pokemon.statusEffect === 'paralysis') {
    // 25% fully paralyzed
    if (Math.random() < 0.25) {
      return { blocked: true, message: `⚡ ${pokemon.name} is fully paralyzed! It can't move!`, cured: false };
    }
  }
  return { blocked: false, message: '', cured: false };
}

/** Returns the status to inflict on defender from a move, or undefined if none. */
export function tryInflictStatus(
  moveType: string,
  category: string,
  defender: BattlePokemon
): string | undefined {
  if (category === 'Status' || defender.statusEffect) return undefined;

  const type = moveType.toLowerCase();
  const defTypes = defender.types.map((t) => t.toLowerCase());

  // Fire move → 10% burn (immune: Fire types)
  if (type === 'fire' && !defTypes.includes('fire') && Math.random() < 0.10) return 'burn';
  // Poison/Bug move → 30% poison (immune: Poison, Steel)
  if ((type === 'poison') && !defTypes.includes('poison') && !defTypes.includes('steel') && Math.random() < 0.30) return 'poison';
  // Electric move → 10% paralysis (immune: Electric types)
  if (type === 'electric' && !defTypes.includes('electric') && Math.random() < 0.10) return 'paralysis';
  // Ice move → 10% freeze (immune: Ice types)
  if (type === 'ice' && !defTypes.includes('ice') && Math.random() < 0.10) return 'freeze';

  return undefined;
}

export function statusLabel(status?: string): string {
  const labels: Record<string, string> = {
    burn: '🔥 BRN',
    poison: '🟣 PSN',
    paralysis: '⚡ PAR',
    sleep: '😴 SLP',
    freeze: '🧊 FRZ',
  };
  return status ? (labels[status] ?? status.toUpperCase()) : '';
}

export function checkFainted(pokemon: BattlePokemon): boolean {
  return pokemon.currentHp <= 0;
}

export function getBattleResultText(winner: string, loser: string, turns: number): string {
  return `**${winner}** defeated **${loser}** in ${turns} turn${turns !== 1 ? 's' : ''}!`;
}

export async function saveBattleResult(
  client: BotClient,
  state: BattleState,
  winnerId: string
) {
  const loserId = winnerId === state.challengerId ? state.opponentId : state.challengerId;
  const isRanked = state.type === 'ranked';

  await client.prisma.battle.update({
    where: { id: state.id },
    data: {
      status: 'finished',
      winnerId,
      turns: state.turn,
      battleLog: state.battleLog,
      endedAt: new Date(),
    },
  });

  await client.prisma.user.update({
    where: { id: winnerId },
    data: {
      battlesWon: { increment: 1 },
      rankedPoints: isRanked ? { increment: 25 } : undefined,
    },
  });

  await client.prisma.user.update({
    where: { id: loserId },
    data: {
      battlesLost: { increment: 1 },
      rankedPoints: isRanked ? { decrement: 15 } : undefined,
    },
  });

  // Grant trainer XP via addXp so level-up logic fires
  const xpGain = 100 + state.turn * 2;
  await addXp(client.prisma, winnerId, xpGain);

  // Check achievement milestones for the winner (fire-and-forget)
  checkAndAwardAchievements(client, winnerId).catch(() => {});
  // Advance 'battle_win' quests (fire-and-forget)
  incrementQuestProgress(client.prisma, winnerId, 'battle_win', 1).catch(() => {});
}
