// ── Pack Tier Configuration ──────────────────────────────────────────────────
// Maps TCG set IDs to economy tiers for pricing and pull rate adjustments.

export type PackTier = 'S' | 'A' | 'B' | 'C' | 'D';

export interface PackTierConfig {
  tier: PackTier;
  cost: number;
  packSize: number;
  description: string;
  maxRarity: string; // Highest rarity available in this tier
}

export const TIER_CONFIGS: Record<PackTier, PackTierConfig> = {
  S: { tier: 'S', cost: 10000, packSize: 10, description: 'Premium Vintage — highest jackpots', maxRarity: 'Secret Rare' },
  A: { tier: 'A', cost: 3000, packSize: 10, description: 'Retro/Ex — rare finds', maxRarity: 'Special Illustration Rare' },
  B: { tier: 'B', cost: 1500, packSize: 10, description: 'Mid Era — solid value', maxRarity: 'Illustration Rare' },
  C: { tier: 'C', cost: 500, packSize: 10, description: 'Modern — standard packs', maxRarity: 'Rare Ultra' },
  D: { tier: 'D', cost: 200, packSize: 5, description: 'Budget — beginner friendly', maxRarity: 'Rare Holo' },
};

// Set ID → Tier mapping
// Covers all major TCG sets. Unknown sets default to Tier C (500 coins).
const SET_TIERS: Record<string, PackTier> = {
  // ── Tier S: Premium Vintage ────────────────────────────────────────────────
  'base1': 'S',    // Base Set
  'base2': 'S',    // Jungle
  'base3': 'S',    // Fossil
  'base4': 'S',    // Base Set 2
  'base5': 'S',    // Team Rocket
  'ecard1': 'S',   // Expedition Base
  'ecard2': 'S',   // Aquapolis
  'ecard3': 'S',   // Skyridge
  'neo1': 'S',     // Neo Genesis
  'neo2': 'S',     // Neo Discovery
  'neo3': 'S',     // Neo Revelation
  'neo4': 'S',     // Neo Destiny

  // ── Tier A: Retro/Ex ───────────────────────────────────────────────────────
  'gym1': 'A',     // Gym Heroes
  'gym2': 'A',     // Gym Challenge
  'ex1': 'A',      // Ruby & Sapphire
  'ex2': 'A',      // Sandstorm
  'ex3': 'A',      // Dragon
  'ex4': 'A',      // Team Magma vs Team Aqua
  'ex5': 'A',      // Hidden Legends
  'ex6': 'A',      // Fire Red & Leaf Green
  'ex7': 'A',      // Team Rocket Returns
  'ex8': 'A',      // Deoxys
  'ex9': 'A',      // Emerald
  'ex10': 'A',     // Unseen Forces
  'ex11': 'A',     // Delta Species
  'ex12': 'A',     // Legend Maker
  'ex13': 'A',     // Holon Phantoms
  'ex14': 'A',     // Crystal Guardians
  'ex15': 'A',     // Dragon Frontiers
  'ex16': 'A',     // Power Keepers
  'dp1': 'A',      // Diamond & Pearl
  'dp2': 'A',      // Mysterious Treasures
  'dp3': 'A',      // Secret Wonders
  'dp4': 'A',      // Great Encounters
  'dp5': 'A',      // Majestic Dawn
  'dp6': 'A',      // Legends Awakened
  'dp7': 'A',      // Stormfront
  'pl1': 'A',      // Platinum
  'pl2': 'A',      // Rising Rivals
  'pl3': 'A',      // Supreme Victors
  'pl4': 'A',      // Arceus

  // ── Tier B: Mid Era ────────────────────────────────────────────────────────
  'hgss1': 'B',    // HeartGold SoulSilver
  'hgss2': 'B',    // Unleashed
  'hgss3': 'B',    // Undaunted
  'hgss4': 'B',    // Triumphant
  'hgss5': 'B',    // Call of Legends
  'bw1': 'B',      // Black & White
  'bw2': 'B',      // Emerging Powers
  'bw3': 'B',      // Noble Victories
  'bw4': 'B',      // Next Destinies
  'bw5': 'B',      // Dark Explorers
  'bw6': 'B',      // Dragons Exalted
  'bw7': 'B',      // Boundaries Crossed
  'bw8': 'B',      // Plasma Storm
  'bw9': 'B',      // Plasma Freeze
  'bw10': 'B',     // Plasma Blast
  'bw11': 'B',     // Legendary Treasures
  'xy1': 'B',      // XY
  'xy2': 'B',      // Flashfire
  'xy3': 'B',      // Furious Fists
  'xy4': 'B',      // Phantom Forces
  'xy5': 'B',      // Primal Clash
  'xy6': 'B',      // Roaring Skies
  'xy7': 'B',      // Ancient Origins
  'xy8': 'B',      // BREAKthrough
  'xy9': 'B',      // BREAKpoint
  'xy10': 'B',     // Fates Collide
  'xy11': 'B',     // Steam Siege
  'xy12': 'B',     // Evolutions

  // ── Tier C: Modern ─────────────────────────────────────────────────────────
  'sm1': 'C',      // Sun & Moon
  'sm2': 'C',      // Guardians Rising
  'sm3': 'C',      // Burning Shadows
  'sm4': 'C',      // Crimson Invasion
  'sm5': 'C',      // Ultra Prism
  'sm6': 'C',      // Forbidden Light
  'sm7': 'C',      // Celestial Storm
  'sm8': 'C',      // Lost Thunder
  'sm9': 'C',      // Team Up
  'sm10': 'C',     // Unbroken Bonds
  'sm11': 'C',     // Unified Minds
  'sm12': 'C',     // Cosmic Eclipse
  'swsh1': 'C',    // Sword & Shield
  'swsh2': 'C',    // Rebel Clash
  'swsh3': 'C',    // Darkness Ablaze
  'swsh4': 'C',    // Vivid Voltage
  'swsh5': 'C',    // Battle Styles
  'swsh6': 'C',    // Chilling Reign
  'swsh7': 'C',    // Evolving Skies
  'swsh8': 'C',    // Fusion Strike
  'swsh9': 'C',    // Brilliant Stars
  'swsh10': 'C',   // Astral Radiance
  'swsh11': 'C',   // Lost Origin
  'swsh12': 'C',   // Silver Tempest
  'swsh13': 'C',   // Crown Zenith
  'sv1': 'C',      // Scarlet & Violet
  'sv2': 'C',      // Paldea Evolved
  'sv3': 'C',      // Obsidian Flames
  'sv4': 'C',      // Paradox Rift
  'sv5': 'C',      // Temporal Forces
  'sv6': 'C',      // Twilight Masquerade
  'sv7': 'C',      // Stellar Crown
  'sv8': 'C',      // Surging Sparks
  'sv9': 'C',      // Journey Together
  'sv10': 'C',     // Prismatic Evolutions
  'sv11': 'C',     // Mega Voltage? (placeholder)

  // ── Tier D: Budget ─────────────────────────────────────────────────────────
  'smp': 'D',      // Sun & Moon Promos
  'swshp': 'D',    // Sword & Shield Promos
  'svp': 'D',      // Scarlet & Violet Promos
  'cel25': 'D',    // Celebrations
  'mcd19': 'D',    // McDonald's 2019
  'mcd20': 'D',    // McDonald's 2020
  'mcd21': 'D',    // McDonald's 2021
};

/**
 * Get the tier for a given set ID.
 * Unknown sets default to Tier C (Modern, 500 coins).
 */
export function getPackTier(setId: string): PackTier {
  return SET_TIERS[setId] ?? 'C';
}

/**
 * Get the cost for a pack of a given set.
 */
export function getPackCost(setId: string): number {
  const tier = getPackTier(setId);
  return TIER_CONFIGS[tier].cost;
}

/**
 * Get the tier config for a given set ID.
 */
export function getTierConfig(setId: string): PackTierConfig {
  const tier = getPackTier(setId);
  return TIER_CONFIGS[tier];
}

/**
 * Get pack size for a given set (differs for Tier D which has 5 instead of 10).
 */
export function getPackSize(setId: string): number {
  const tier = getPackTier(setId);
  return TIER_CONFIGS[tier].packSize;
}