# Card Economy Rework — Rarity, Pull Values, and Market Design

> Generated: 2026-06-14
> Goal: Rare cards should actually feel rare

---

## Current Problems

1. **Card.marketValue is never populated** — the field exists in Prisma but is always null
2. **All rarities are flat** — pull rates don't correlate with market value
3. **No weighted distribution** — every card in a pack has equal-ish rarity
4. **No set tier factoring** — a common from Base Set is worth the same as a common from SV Base
5. **No sell price multiplier** — `/shop sell` doesn't differentiate card values

---

## Rarity → Market Value Multiplier

| Rarity | Market Value Multiplier | Sell Price Mult | Pull Weight | Feels |
|--------|----------------------|-----------------|-------------|-------|
| Common | 1× | 1× | 50% | Bulk |
| Uncommon | 2× | 1.5× | 25% | Slightly better |
| Rare | 5× | 3× | 15% | Nice |
| Rare Holo | 15× | 5× | 7% | Good pull |
| Rare Ultra (V/GX) | 50× | 10× | 2% | Exciting |
| Illustration Rare | 100× | 15× | 0.5% | Amazing |
| Special Illustration Rare | 300× | 20× | 0.3% | God pack territory |
| Hyper Rare (Gold) | 500× | 25× | 0.15% | Whale |
| Secret Rare | 1000× | 30× | 0.05% | Legendary |

---

## Set Tier Multiplier

| Set Tier | Base Value Multiplier | Example |
|----------|----------------------|---------|
| S (Premium Vintage) | 10× | Base Set 1st Edition |
| A (Retro) | 5× | Team Rocket, Neo Genesis |
| B (Mid Era) | 2× | HGSS, Black & White |
| C (Modern) | 1× (baseline) | SV, SWSH |
| D (Budget) | 0.5× | McDonald's, Vending |

---

## Card Value Formula

```
Card Market Value = BASE_VALUE × rarity_mult × set_tier_mult × desirability_mod × alt_art_mod

Where:
  BASE_VALUE         = 100 (1 PokéCoin = ~$0.001 equivalent)
  rarity_mult        = from table above (Common=1x, Secret Rare=1000x)
  set_tier_mult      = from table above (S=10x, A=5x, B=2x, C=1x, D=0.5x)
  desirability_mod   = Pokémon popularity multiplier (0.5–3.0)
  alt_art_mod        = 1.0 (normal), 1.5 (alt art), 2.0 (special art)
```

### Examples

| Card | Rarity | Set Tier | Desirability | Value |
|------|--------|----------|-------------|-------|
| Pikachu Common | Common (1×) | C (1×) | 1.5× (popular) | 150 |
| Charizard V Alt Art | Rare Ultra (50×) | C (1×) | 3.0× (god tier) | 15,000 |
| Moonbreon VMAX Alt | Special Illust. Rare (300×) | C (1×) | 3.0× (legendary) | 90,000 |
| Base Set Zard Holo | Rare Holo (15×) | S (10×) | 3.0× (iconic) | 45,000 |
| Magikarp Common | Common (1×) | C (1×) | 0.5× (joke) | 50 |

---

## Pull Distribution per Pack Tier

### Tier C Pack (10 cards, current default)
```
Card 1:  Common (100%)
Card 2:  Common (100%)
Card 3:  Common (80%) / Uncommon (20%)
Card 4:  Uncommon (70%) / Rare (30%)
Card 5:  Uncommon (100%)
Card 6:  Uncommon (60%) / Rare Holo (40%)
Card 7:  Common (100%)
Card 8:  Rare (50%) / Rare Holo (40%) / Rare Ultra (10%)
Card 9:  Common (100%)
Card 10: Rare Holo (60%) / Rare Ultra (30%) / Illustration Rare (8%) / SIR (1.5%) / Hyper Rare (0.4%) / Secret Rare (0.1%)
```

### Tier S Pack (10 cards)
```
Slots 1-9: Same structure but each slot has higher rare weights
Slot 10:   Rare Ultra (40%) / Illustration Rare (30%) / SIR (20%) / Hyper Rare (7%) / Secret Rare (3%)
```

### Tier D Pack (5 cards)
```
Slots 1-4: Commons and Uncommons only
Slot 5:    Rare (60%) / Rare Holo (35%) / Rare Ultra (5%) — NO Illustration Rare or above
```

---

## Sell Price to Shop

When a user sells a card to the bot shop:

```
Sell Price = floor(Card.marketValue × sellPriceMult)
```

| Rarity | Sell Price Mult |
|--------|----------------|
| Common | 1× |
| Uncommon | 1.5× |
| Rare | 3× |
| Rare Holo | 5× |
| Rare Ultra | 10× |
| Illustration Rare | 15× |
| SIR | 20× |
| Hyper Rare | 25× |
| Secret Rare | 30× |

---

## Auction Recommendations

When listing a card on the market/auction:

```
Starting Bid = floor(marketValue × 0.5)
Buyout Price = floor(marketValue × 1.5)
Min Bid Increment = floor(marketValue × 0.05)
```

---

## Implementation Plan

### Step 1: Populate marketValue on Card insert
In `packRevealHandler.ts` `handlePackReveal()`, after `prisma.card.upsert()`:
```typescript
const marketValue = calculateMarketValue(card.rarity, setTier, pokemonName);
// Add marketValue to the upsert data
```

### Step 2: Create value calculation service
`src/services/cardValueService.ts`:
```typescript
export function calculateMarketValue(
  rarity: string, 
  setTier: SetTier, 
  cardName: string, 
  subtype?: string
): number;
```

### Step 3: Add desirability data
Create `src/config/card-desirability.json`:
```json
{
  "Charizard": { "multiplier": 3.0 },
  "Pikachu": { "multiplier": 1.5 },
  "Magikarp": { "multiplier": 0.5 },
  "Eevee": { "multiplier": 1.8 },
  ...
}
```

### Step 4: Update pack summary to show estimated value
Modify `buildSummaryEmbed()` in `packRevealHandler.ts` to sum card values.

### Step 5: Add sell command integration
Modify `/shop` or create `/cards sell` to use `card.marketValue`.

---

## Data Migration

Existing cards in DB need market values backfilled:
```sql
-- Run once to update all existing cards
UPDATE cards SET market_value = ... WHERE market_value IS NULL;
```

Or create a script `scripts/backfill-card-values.ts` that:
1. Reads all cards from DB
2. Assigns values based on rarity + set + name heuristic
3. Writes back to DB

---

## Future Enhancements

- **Time-based value decay**: Card values decrease slightly over time (inflation)
- **Weekly value updates**: Background job that adjusts values
- **Rarity-based achievements**: "Collect all 10 Secret Rares from Tier C"
- **Card trading floor**: Player-to-player market with dynamic pricing
- **Completing sets**: Bonus for collecting all cards in a set