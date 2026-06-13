import type { Pokemon, UserPokemon } from '@prisma/client';

export const NATURES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
] as const;

export const NATURE_MODIFIERS: Record<string, { boost?: string; reduce?: string }> = {
  Hardy: {}, Docile: {}, Serious: {}, Bashful: {}, Quirky: {},
  Lonely: { boost: 'attack', reduce: 'defense' },
  Brave: { boost: 'attack', reduce: 'speed' },
  Adamant: { boost: 'attack', reduce: 'spAttack' },
  Naughty: { boost: 'attack', reduce: 'spDefense' },
  Bold: { boost: 'defense', reduce: 'attack' },
  Relaxed: { boost: 'defense', reduce: 'speed' },
  Impish: { boost: 'defense', reduce: 'spAttack' },
  Lax: { boost: 'defense', reduce: 'spDefense' },
  Timid: { boost: 'speed', reduce: 'attack' },
  Hasty: { boost: 'speed', reduce: 'defense' },
  Jolly: { boost: 'speed', reduce: 'spAttack' },
  Naive: { boost: 'speed', reduce: 'spDefense' },
  Modest: { boost: 'spAttack', reduce: 'attack' },
  Mild: { boost: 'spAttack', reduce: 'defense' },
  Quiet: { boost: 'spAttack', reduce: 'speed' },
  Rash: { boost: 'spAttack', reduce: 'spDefense' },
  Calm: { boost: 'spDefense', reduce: 'attack' },
  Gentle: { boost: 'spDefense', reduce: 'defense' },
  Sassy: { boost: 'spDefense', reduce: 'speed' },
  Careful: { boost: 'spDefense', reduce: 'spAttack' },
};

export function randomNature(): string {
  return NATURES[Math.floor(Math.random() * NATURES.length)];
}

export function randomIV(): number {
  return Math.floor(Math.random() * 32);
}

export function calcStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: string,
  statName: string
): number {
  const modifier = NATURE_MODIFIERS[nature] || {};
  let natureMod = 1.0;
  if (modifier.boost === statName) natureMod = 1.1;
  if (modifier.reduce === statName) natureMod = 0.9;

  const stat = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100 + 5) * natureMod;
  return Math.floor(stat);
}

export function calcHp(base: number, iv: number, ev: number, level: number): number {
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100 + level + 10);
}

export function calcPokemonStats(pokemon: Pokemon, userPokemon: UserPokemon) {
  const lvl = userPokemon.level;
  const nat = userPokemon.nature;
  return {
    hp: calcHp(pokemon.hp, userPokemon.ivHp, userPokemon.evHp, lvl),
    attack: calcStat(pokemon.attack, userPokemon.ivAttack, userPokemon.evAttack, lvl, nat, 'attack'),
    defense: calcStat(pokemon.defense, userPokemon.ivDefense, userPokemon.evDefense, lvl, nat, 'defense'),
    spAttack: calcStat(pokemon.spAttack, userPokemon.ivSpAttack, userPokemon.evSpAttack, lvl, nat, 'spAttack'),
    spDefense: calcStat(pokemon.spDefense, userPokemon.ivSpDefense, userPokemon.evSpDefense, lvl, nat, 'spDefense'),
    speed: calcStat(pokemon.speed, userPokemon.ivSpeed, userPokemon.evSpeed, lvl, nat, 'speed'),
  };
}

export const TYPE_CHART: Record<string, Record<string, number>> = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

export function getTypeEffectiveness(moveType: string, defType1: string, defType2?: string | null): number {
  const chart = TYPE_CHART[moveType.toLowerCase()] || {};
  let eff = chart[defType1.toLowerCase()] ?? 1;
  if (defType2) eff *= chart[defType2.toLowerCase()] ?? 1;
  return eff;
}

export function getEffectivenessText(multiplier: number): string {
  if (multiplier === 0) return "It had no effect!";
  if (multiplier < 0.5) return "It's not very effective...";
  if (multiplier < 1) return "It's not very effective...";
  if (multiplier > 2) return "It's super effective!!";
  if (multiplier > 1) return "It's super effective!";
  return "";
}

export function xpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 2));
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function formatPokemonName(name: string): string {
  return name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}
