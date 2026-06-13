import axios from 'axios';
import type { BotClient } from '../types/index.js';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const CACHE_TTL = 86400; // 24h

export async function fetchPokemonFromApi(
  client: BotClient,
  nameOrId: string | number
): Promise<Record<string, unknown> | null> {
  const cacheKey = `pokeapi:pokemon:${nameOrId}`;
  const cached = await client.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const { data } = await axios.get(`${POKEAPI_BASE}/pokemon/${nameOrId}`);
    await client.redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL });
    return data;
  } catch {
    return null;
  }
}

export async function fetchPokemonSpecies(
  client: BotClient,
  nameOrId: string | number
): Promise<Record<string, unknown> | null> {
  const cacheKey = `pokeapi:species:${nameOrId}`;
  const cached = await client.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const { data } = await axios.get(`${POKEAPI_BASE}/pokemon-species/${nameOrId}`);
    await client.redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL });
    return data;
  } catch {
    return null;
  }
}

export async function fetchEvolutionChain(
  client: BotClient,
  url: string
): Promise<Record<string, unknown> | null> {
  const cacheKey = `pokeapi:evo:${url}`;
  const cached = await client.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const { data } = await axios.get(url);
    await client.redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL });
    return data;
  } catch {
    return null;
  }
}

export async function fetchMove(
  client: BotClient,
  nameOrId: string | number
): Promise<Record<string, unknown> | null> {
  const cacheKey = `pokeapi:move:${nameOrId}`;
  const cached = await client.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const { data } = await axios.get(`${POKEAPI_BASE}/move/${nameOrId}`);
    await client.redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL });
    return data;
  } catch {
    return null;
  }
}

export async function fetchAbility(
  client: BotClient,
  nameOrId: string | number
): Promise<Record<string, unknown> | null> {
  const cacheKey = `pokeapi:ability:${nameOrId}`;
  const cached = await client.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const { data } = await axios.get(`${POKEAPI_BASE}/ability/${nameOrId}`);
    await client.redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL });
    return data;
  } catch {
    return null;
  }
}

export function getPokemonArtworkUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

export function getPokemonShinyArtworkUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`;
}

export function parsePokeApiPokemon(data: Record<string, unknown>) {
  const stats = (data.stats as Array<{ base_stat: number; stat: { name: string } }>);
  const getStat = (name: string) => stats.find((s) => s.stat.name === name)?.base_stat ?? 0;
  const types = (data.types as Array<{ slot: number; type: { name: string } }>)
    .sort((a, b) => a.slot - b.slot)
    .map((t) => t.type.name);
  const abilities = data.abilities as Array<{ ability: { name: string }; is_hidden: boolean; slot: number }>;

  return {
    id: data.id as number,
    name: data.name as string,
    nameDisplay: formatPokemonName(data.name as string),
    type1: types[0] ?? 'normal',
    type2: types[1] ?? null,
    hp: getStat('hp'),
    attack: getStat('attack'),
    defense: getStat('defense'),
    spAttack: getStat('special-attack'),
    spDefense: getStat('special-defense'),
    speed: getStat('speed'),
    baseStatTotal: stats.reduce((s, st) => s + st.base_stat, 0),
    height: (data.height as number) / 10,
    weight: (data.weight as number) / 10,
    ability1: abilities.find((a) => a.slot === 1)?.ability.name ?? 'unknown',
    ability2: abilities.find((a) => a.slot === 2)?.ability.name ?? null,
    hiddenAbility: abilities.find((a) => a.is_hidden)?.ability.name ?? null,
    spriteUrl: (data.sprites as Record<string, unknown>)?.front_default as string ?? null,
    shinySpriteUrl: (data.sprites as Record<string, unknown>)?.front_shiny as string ?? null,
    artworkUrl: getPokemonArtworkUrl(data.id as number),
    shinyArtworkUrl: getPokemonShinyArtworkUrl(data.id as number),
    moves: (data.moves as Array<{ move: { name: string }; version_group_details: Array<{ level_learned_at: number; move_learn_method: { name: string } }> }>)
      .filter((m) => m.version_group_details.some((v) => v.move_learn_method.name === 'level-up'))
      .slice(0, 4)
      .map((m) => m.move.name),
  };
}

function formatPokemonName(name: string): string {
  return name.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}
