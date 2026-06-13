import axios from 'axios';
import type { BotClient } from '../types/index.js';

const TCG_BASE = 'https://api.pokemontcg.io/v2';
const CACHE_TTL = 3600;

export async function fetchCard(client: BotClient, cardId: string): Promise<Record<string, unknown> | null> {
  const key = `tcg:card:${cardId}`;
  const cached = await client.redis.get(key);
  if (cached) return JSON.parse(cached);

  try {
    const { data } = await axios.get(`${TCG_BASE}/cards/${cardId}`, {
      headers: { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY },
    });
    await client.redis.set(key, JSON.stringify(data.data), { EX: CACHE_TTL });
    return data.data;
  } catch {
    return null;
  }
}

export async function searchCards(
  client: BotClient,
  query: string,
  page = 1,
  pageSize = 10
): Promise<{ data: Record<string, unknown>[]; totalCount: number }> {
  const key = `tcg:search:${query}:${page}:${pageSize}`;
  const cached = await client.redis.get(key);
  if (cached) return JSON.parse(cached);

  try {
    const { data } = await axios.get(`${TCG_BASE}/cards`, {
      params: { q: query, page, pageSize, orderBy: '-set.releaseDate' },
      headers: { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY },
    });
    const result = { data: data.data, totalCount: data.totalCount };
    await client.redis.set(key, JSON.stringify(result), { EX: CACHE_TTL });
    return result;
  } catch {
    return { data: [], totalCount: 0 };
  }
}

export async function fetchSets(client: BotClient): Promise<Record<string, unknown>[]> {
  const key = 'tcg:sets';
  const cached = await client.redis.get(key);
  if (cached) return JSON.parse(cached);

  try {
    const { data } = await axios.get(`${TCG_BASE}/sets`, {
      params: { orderBy: '-releaseDate' },
      headers: { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY },
    });
    await client.redis.set(key, JSON.stringify(data.data), { EX: CACHE_TTL * 24 });
    return data.data;
  } catch {
    return [];
  }
}

export async function openPack(
  client: BotClient,
  setId?: string
): Promise<Record<string, unknown>[]> {
  const query = setId ? `set.id:${setId}` : 'supertype:Pokémon';
  const { data: allCards } = await searchCards(client, query, 1, 250);

  if (allCards.length === 0) return [];

  const rarityWeights: Record<string, number> = {
    Common: 60,
    Uncommon: 25,
    'Rare Holo': 10,
    Rare: 8,
    'Rare Ultra': 3,
    'Illustration Rare': 2,
    'Special Illustration Rare': 1,
    'Hyper Rare': 0.5,
    'Amazing Rare': 0.5,
  };

  const pack: Record<string, unknown>[] = [];
  const packSize = 10;

  for (let i = 0; i < packSize; i++) {
    const isRareSlot = i >= 8;
    const filtered = isRareSlot
      ? allCards.filter((c) => {
          const r = c.rarity as string;
          return r !== 'Common' && r !== 'Uncommon';
        })
      : allCards;

    const pool = filtered.length > 0 ? filtered : allCards;
    const totalWeight = pool.reduce((sum, c) => sum + (rarityWeights[(c.rarity as string) ?? 'Common'] ?? 1), 0);
    let roll = Math.random() * totalWeight;

    let selected = pool[0];
    for (const card of pool) {
      roll -= rarityWeights[(card.rarity as string) ?? 'Common'] ?? 1;
      if (roll <= 0) { selected = card; break; }
    }
    pack.push(selected);
  }

  return pack;
}
