# Pack Economy V2 — TCG Market Research & Pricing Strategy

> Generated: 2026-06-14
> Sources: TCGPlayer, PriceCharting, eBay sold listings, PokemonPrice, CardMarket

---

## Current Problem

- All packs cost **500 PokéCoins**
- All sets are treated equally
- No correlation with real TCG market value
- Rare sets (e.g., Base Set 1st Edition) cost the same as modern (Scarlet & Violet)
- No set-tier pricing → no economy depth

---

## Proposed Pack Tiers

### Tier S — Premium Vintage (Cost: 5,000–10,000 PokéCoins)
| Set | Est. Sealed Value | Pull Value Potential | Why |
|-----|------------------|---------------------|-----|
| Base Set (1st Edition) | $5,000–$20,000+ | Ultra high | Holo Charizard, Blastoise, Venusaur |
| Base Set (Shadowless) | $1,000–$5,000 | Very high | Same chase cards, lower price |
| Neo Destiny (1st Ed) | $2,000–$8,000 | Very high | Shining Pokémon, Dark Espeon |
| Skyridge | $1,500–$5,000 | Very high | Crystal Holos, rarest modern-ish set |
| Expedition Base | $500–$2,000 | High | Rare holos, unique artwork |
| Aquapolis | $800–$3,000 | High | Crystal types |

**Pack cost: 10,000 PokéCoins**
**Pack weight: Rare (sold rarely, special drops)**

### Tier A — Retro/Ex (Cost: 2,000–4,000 PokéCoins)
| Set | Est. Sealed Value | Pull Value Potential |
|-----|------------------|---------------------|
| Team Rocket (1st Ed) | $300–$1,000 | High |
| Gym Heroes/Challenge | $200–$800 | Medium-high |
| Neo Genesis | $300–$1,200 | High |
| Neo Revelation | $200–$800 | Medium-high |
| EX Sandstorm | $150–$500 | Medium |
| EX Dragon | $200–$600 | Medium-high |
| EX Deoxys | $150–$400 | Medium |
| Platinum (Arceus) | $100–$300 | Medium |

**Pack cost: 3,000 PokéCoins**
**Pack weight: Common in special events**

### Tier B — Mid Era (Cost: 1,000–1,500 PokéCoins)
| Set | Est. Sealed Value | Pull Value Potential |
|-----|------------------|---------------------|
| HeartGold SoulSilver | $100–$400 | Medium |
| Call of Legends | $80–$300 | Medium |
| Black & White Base | $50–$150 | Low-medium |
| Boundaries Crossed | $40–$120 | Low-medium |
| XY Base | $40–$100 | Low-medium |
| Furious Fists | $30–$80 | Low-medium |
| BREAKpoint | $25–$60 | Low |

**Pack cost: 1,500 PokéCoins**
**Pack weight: Available in shop**

### Tier C — Modern (Cost: 500 PokéCoins)
| Set | Est. Sealed Value | Pull Value Potential |
|-----|------------------|---------------------|
| Sun & Moon Base | $10–$30 | Low-medium |
| Burning Shadows | $15–$40 | Medium (Charizard) |
| Sword & Shield Base | $8–$20 | Low |
| Evolving Skies | $15–$50 | High (Moonbreon) |
| Fusion Strike | $8–$20 | Low-medium |
| Brilliant Stars | $10–$25 | Medium (Charizard V) |
| Crown Zenith | $15–$35 | Medium-high |
| Scarlet & Violet Base | $5–$15 | Low |
| Paldean Fates | $10–$25 | Medium (Shiny Zard) |
| Twilight Masquerade | $8–$20 | Low-medium |
| Surging Sparks | $10–$25 | Medium (Pikachu) |

**Pack cost: 500 PokéCoins** (current price, unchanged)
**Pack weight: Always available in shop**

### Tier D — Budget (Cost: 100–250 PokéCoins)
| Set | Est. Sealed Value | Pull Value Potential |
|-----|------------------|---------------------|
| Champion's Path | $5–$15 | Low (only 1 rare per box) |
| Shining Fates | $8–$20 | Low-medium |
| Vending Series (repro) | $5–$10 | Very low |
| McDonald's promos | $2–$5 | Niche |

**Pack cost: 200 PokéCoins**
**Pack weight: Always available, beginner-friendly**

---

## Expected Value (EV) Per Tier

| Tier | Pack Cost | Avg Pull Value | EV Multiple | Cards per Pack |
|------|-----------|----------------|-------------|----------------|
| S | 10,000 | ~3,000–5,000 | ~0.3–0.5× | 10 |
| A | 3,000 | ~1,000–1,500 | ~0.33–0.5× | 10 |
| B | 1,500 | ~500–800 | ~0.33–0.53× | 10 |
| C | 500 | ~150–300 | ~0.3–0.6× | 10 |
| D | 200 | ~50–100 | ~0.25–0.5× | 5 |

**Design principle:** Packs should average ~30–60% EV (expected value as fraction of cost).
The rest is gambling/house edge. Higher tier = same EV range but with **higher variance** (bigger jackpots).

---

## Rarity Tier Definitions (for Pull Rates)

| In-Game Rarity | Symbol | Pull Chance (Tier C) | Market Value Multiplier |
|----------------|--------|---------------------|----------------------|
| Common | ⚪ | 50% | 1× (base) |
| Uncommon | 🟢 | 25% | 2–3× |
| Rare | 🔵 | 15% | 5–10× |
| Rare Holo | 🔷 | 7% | 10–30× |
| Rare Ultra (V/GX) | 🟣 | 2% | 30–100× |
| Illustration Rare | 🌟 | 0.5% | 50–200× |
| Special Illustration Rare | 💎 | 0.3% | 100–500× |
| Hyper Rare (Gold) | 🌈 | 0.15% | 200–1,000× |
| Secret Rare | ⭐ | 0.05% | 500–5,000× |

**Pull rates shift per tier:**
- Tier S: Higher chance of Rare+ pulls (jackpot potential)
- Tier C: Lower rare pulls, more commons
- Tier D: No secret rares, capped at Rare Ultra

---

## Set Rarity Classes

```
TIER     COST     RARITY POOL
S        10,000   Common, Uncommon, Rare, Rare Holo, Rare Ultra, Illustration Rare, SIR, Hyper Rare, Secret Rare
A        3,000    Common, Uncommon, Rare, Rare Holo, Rare Ultra, Illustration Rare, SIR
B        1,500    Common, Uncommon, Rare, Rare Holo, Rare Ultra, Illustration Rare
C        500      Common, Uncommon, Rare, Rare Holo, Rare Ultra
D        200      Common, Uncommon, Rare, Rare Holo
```

---

## Implementation Plan

### Phase 1: Set Tier Assignment
1. Add `setTier` field to pack metadata (or derive from setId → tier map)
2. Map all known sets to S/A/B/C/D tiers
3. Default unknown sets to Tier C (500 coins)

### Phase 2: Dynamic Pricing
1. Replace `PACK_COST = 500` with `getPackCost(setId)` function
2. Use tier map to determine cost
3. Display tier in pack buy menu

### Phase 3: Tier-Locked Pull Rates
1. Modify `openPack()` in `pokemonTcgService.ts` to accept tier parameter
2. Adjust pull rate weights per tier
3. Ensure Tier D never drops Secret Rares

### Phase 4: Special Drops
1. Tier S packs are rare — only obtainable via events, achievements, or admin gifts
2. Tier A available in limited weekly shop rotation
3. Tiers B–D always available in regular shop

---

## Source References

- TCGPlayer pricing: https://www.tcgplayer.com/
- PriceCharting: https://www.pricecharting.com/
- PokemonPrice: https://www.pokemonprice.com/
- eBay sold listings (search "pack [set name] sealed")
- CardMarket (EU): https://www.cardmarket.com/