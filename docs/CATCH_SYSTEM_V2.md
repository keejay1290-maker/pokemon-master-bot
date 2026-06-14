# Catch System V2 — Design Document

> Written: S9 | Status: IMPLEMENTED (ball check in hunt.ts)

---

## Overview

The catch system makes Pokéballs a required consumable for catching Pokémon in `/hunt`. Without balls, Pokémon encounters give coin rewards only (Pokémon flees). Balls purchased from `/shop` are stored in `UserInventory` and consumed on catch attempts.

---

## Ball Tiers

| Ball | Shop ID | Price | Catch Rate Multiplier | Notes |
|------|---------|-------|-----------------------|-------|
| Poké Ball | `poke_ball` | 200 | 1.0× (base) | Standard ball |
| Great Ball | `great_ball` | 600 | 1.5× | Better odds |
| Ultra Ball | `ultra_ball` | 1,200 | 2.0× | High success |
| Master Ball | `master_ball` | 100,000 | Guaranteed (1.0) | Never fails |

---

## Hunt Flow (Updated)

```
/hunt called
  → Random encounter roll
  → If no ball in inventory:
      Pokemon flees → coin reward only
  → If ball owned:
      Best ball auto-selected (Master > Ultra > Great > Poke)
      1 ball deducted from UserInventory
      catchChance *= ballMultiplier
      Roll against adjusted catchChance
      If success → UserPokemon created, ball consumed
      If fail → coin consolation reward, ball still consumed
```

**Ball consumption is always atomic** — deduct before creating UserPokemon to prevent free catches on crash.

---

## Catch Rate Table (Base × Ball Multiplier)

| Pokémon | Base Rate | + Poke Ball | + Great Ball | + Ultra Ball | + Master Ball |
|---------|-----------|-------------|--------------|--------------|---------------|
| Pidgey | 90% | 90% | 100% | 100% | 100% |
| Growlithe | 65% | 65% | 97.5% | 100% | 100% |
| Riolu | 40% | 40% | 60% | 80% | 100% |
| Dratini | 35% | 35% | 52.5% | 70% | 100% |
| Beldum | 20% | 20% | 30% | 40% | 100% |

---

## Ball Selection Logic

Always use the BEST ball available (players should manually manage if they want to preserve Master Balls — this can be an option in V3):

```typescript
const BALL_PRIORITY = ['master_ball', 'ultra_ball', 'great_ball', 'poke_ball'];
const BALL_MULTIPLIERS: Record<string, number> = {
  master_ball: 999, ultra_ball: 2.0, great_ball: 1.5, poke_ball: 1.0,
};

let bestBall: string | null = null;
for (const ballId of BALL_PRIORITY) {
  const inv = await prisma.userInventory.findUnique({ where: { userId_itemId: { userId, itemId: ballId } } });
  if (inv && inv.quantity > 0) { bestBall = ballId; break; }
}
```

---

## Future V3 Options

- `/hunt use [ball]` — specify which ball type to use
- Ball durability (e.g., Safari Ball = 3 throws per item)
- Throw accuracy system
- Type-specific balls (Dive Ball for Water types, Net Ball for Bug/Water, etc.)
- Friend Ball, Heal Ball effects on caught Pokémon stats

---

## Collection Separation (Enforced)

The hunt system ONLY creates `UserPokemon` rows. It does NOT interact with `UserCard` or TCG data in any way. See `docs/COLLECTION_ARCHITECTURE_AUDIT.md`.
