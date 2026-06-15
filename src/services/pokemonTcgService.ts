import axios from 'axios';
import type { BotClient } from '../types/index.js';
import { getPackTier, getTierConfig, type PackTier } from '../config/pack-tiers.js';

const TCG_BASE = 'https://api.pokemontcg.io/v2';
const CACHE_TTL = 3600;

// Maximum rarity allowed per tier — tiers with higher costs get access to higher rarities
const TIER_RARITY_CAPS: Record<PackTier, number> = {
  S: 10,  // Secret Rare
  A: 8,   // Special Illustration Rare
  B: 6,   // Illustration Rare
  C: 5,   // Rare Ultra
  D: 4,   // Rare Holo
};

const RARITY_ORDER: Record<string, number> = {
  'Common': 1,
  'Uncommon': 2,
  'Rare': 3,
  'Rare Holo': 4,
  'Rare Ultra': 5,
  'Illustration Rare': 6,
  'Amazing Rare': 7,
  'Special Illustration Rare': 8,
  'Hyper Rare': 9,
  'Rare Secret': 10,
  'Rare Rainbow Alt': 8,
  'LEGEND': 7,
};

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

  const tier = setId ? getPackTier(setId) : 'C';
  const tierConfig = getTierConfig(setId ?? 'sv1');
  const rarityCap = TIER_RARITY_CAPS[tier];

  // Filter cards to only those allowed in this tier
  const tierCards = allCards.filter((c) => {
    const rarityRank = RARITY_ORDER[(c.rarity as string) ?? 'Common'] ?? 1;
    return rarityRank <= rarityCap;
  });

  const pool = tierCards.length > 0 ? tierCards : allCards;

  // Tier-adjusted weights — higher tiers shift weight towards rares
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

  // Tier S/A get boosted rare weights
  if (tier === 'S' || tier === 'A') {
    rarityWeights['Rare Ultra'] = 6;
    rarityWeights['Illustration Rare'] = 4;
    rarityWeights['Special Illustration Rare'] = 2;
    rarityWeights['Hyper Rare'] = 1;
  }

  // Tier D gets reduced rare weights
  if (tier === 'D') {
    rarityWeights['Rare Holo'] = 5;
    rarityWeights['Rare'] = 5;
    rarityWeights['Rare Ultra'] = 1;
  }

  const pack: Record<string, unknown>[] = [];
  const packSize = tierConfig.packSize;

  for (let i = 0; i < packSize; i++) {
    const isRareSlot = i >= Math.floor(packSize * 0.8);
    const slotPool = isRareSlot
      ? pool.filter((c) => {
          const r = (c.rarity as string) ?? 'Common';
          return r !== 'Common' && r !== 'Uncommon' && RARITY_ORDER[r] <= rarityCap;
        })
      : pool;

    const finalPool = slotPool.length > 0 ? slotPool : pool;
    const totalWeight = finalPool.reduce((sum, c) => sum + (rarityWeights[(c.rarity as string) ?? 'Common'] ?? 1), 0);
    let roll = Math.random() * totalWeight;

    let selected = finalPool[0];
    for (const card of finalPool) {
      roll -= rarityWeights[(card.rarity as string) ?? 'Common'] ?? 1;
      if (roll <= 0) { selected = card; break; }
    }
    pack.push(selected);
  }

  return pack;
}
