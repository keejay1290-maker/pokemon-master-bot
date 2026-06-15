import { getPackTier, type PackTier } from '../config/pack-tiers.js';
import { getDesirability } from '../config/card-desirability.js';

// ── Rarity Value Configuration ────────────────────────────────────────────────

const RARITY_MULTIPLIERS: Record<string, number> = {
  'Common': 1,
  'Uncommon': 2,
  'Rare': 5,
  'Rare Holo': 15,
  'Rare Ultra': 50,
  'Illustration Rare': 100,
  'Special Illustration Rare': 300,
  'Hyper Rare': 500,
  'Amazing Rare': 200,
  'Rare Secret': 1000,
  'Rare Rainbow Alt': 400,
  'LEGEND': 250,
};

const SET_TIER_MULTIPLIERS: Record<PackTier, number> = {
  S: 10,
  A: 5,
  B: 2,
  C: 1,
  D: 0.5,
};

const SELL_PRICE_MULTIPLIERS: Record<string, number> = {
  'Common': 1,
  'Uncommon': 1.5,
  'Rare': 3,
  'Rare Holo': 5,
  'Rare Ultra': 10,
  'Illustration Rare': 15,
  'Special Illustration Rare': 20,
  'Hyper Rare': 25,
  'Amazing Rare': 12,
  'Rare Secret': 30,
  'Rare Rainbow Alt': 18,
  'LEGEND': 15,
};

const BASE_VALUE = 100;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calculate the market value of a single card.
 *
 * Formula:
 *   Card Value = BASE_VALUE × rarity_mult × set_tier_mult × desirability_mult
 *
 * @param rarity - The card's rarity string (e.g. 'Common', 'Rare Holo')
 * @param setId - The TCG set ID (e.g. 'base1', 'sv1')
 * @param cardName - The card's name (e.g. 'Charizard VMAX')
 * @param altArtMod - Optional modifier for alt art/special art (default 1.0)
 * @returns The calculated market value in PokéCoins
 */
export function calculateMarketValue(
  rarity: string,
  setId: string,
  cardName: string,
  altArtMod = 1.0
): number {
  const rarityMult = RARITY_MULTIPLIERS[rarity] ?? 1;
  const tier = getPackTier(setId);
  const setTierMult = SET_TIER_MULTIPLIERS[tier] ?? 1;
  const desirabilityMult = getDesirability(cardName);

  const value = Math.floor(BASE_VALUE * rarityMult * setTierMult * desirabilityMult * altArtMod);
  return Math.max(value, 10); // minimum value of 10 coins
}

/**
 * Calculate the sell price (to bot shop) for a card.
 *
 * Formula:
 *   Sell Price = floor(marketValue × sellPriceMult)
 *
 * @param marketValue - The card's calculated market value
 * @param rarity - The card's rarity string
 * @returns The price the bot shop will pay
 */
export function calculateSellPrice(marketValue: number, rarity: string): number {
  const mult = SELL_PRICE_MULTIPLIERS[rarity] ?? 1;
  return Math.floor(marketValue * mult);
}

/**
 * Get auction recommendation prices for a card.
 */
export function getAuctionPrices(marketValue: number): {
  startingBid: number;
  buyoutPrice: number;
  minBidIncrement: number;
} {
  return {
    startingBid: Math.floor(marketValue * 0.5),
    buyoutPrice: Math.floor(marketValue * 1.5),
    minBidIncrement: Math.floor(marketValue * 0.05),
  };
}

/**
 * Get the total pack estimated value from an array of card market values.
 */
export function getTotalPackValue(cardValues: number[]): number {
  return cardValues.reduce((sum, v) => sum + v, 0);
}

/**
 * Get rarity sell price multiplier.
 */
export function getSellPriceMultiplier(rarity: string): number {
  return SELL_PRICE_MULTIPLIERS[rarity] ?? 1;
}