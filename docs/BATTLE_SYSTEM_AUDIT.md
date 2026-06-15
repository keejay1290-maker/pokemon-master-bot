# Battle System Audit
> Date: 2026-06-15 | Status: FIXED

---

## Symptoms

- Most attacks dealt only 1–5 damage
- Stronger Pokémon felt identical to weaker ones
- Battles ran 40–80+ turns (effectively endless)

---

## Root Cause

`battle.ts` contained an **inline damage formula that was never connected to `calcDamage()`** in `battleService.ts`:

```typescript
// BROKEN (was in battle.ts move handler)
const basePower = 40 + Math.floor(Math.random() * 60); // random 40-100
const damage = Math.max(1, Math.floor(attacker.attack * basePower / (50 * (defender.defense || 1))));
```

For a Lv20 Pokémon (attack=52, defense=80):
```
52 * 70 / (50 * 80) = 3640 / 4000 = 0.91 → Math.floor = 0 → max(1, 0) = 1
```

Always 1 damage. Stat differences, level, STAB, and type effectiveness were all ignored.

Additional gaps in `calcDamage()` itself:
- `stab = 1.0` — hardcoded placeholder, never computed
- `effectiveness = 1.0` — hardcoded placeholder, `getTypeEffectiveness` imported but not called
- `BattlePokemon` had no `types` field — STAB/effectiveness impossible to compute

---

## Fix

### 1. `types/index.ts` — Added fields to `BattlePokemon`
```typescript
types: string[];    // from Pokemon.type1/type2 — needed for STAB
moveData: MoveData[]; // resolved at load time from DB + fallback table
```

### 2. `battleService.ts` — Four changes
- **`loadBattleTeam()`**: Now batch-queries `PokemonMove` table for all team members in one query (no N+1). Falls back to `MOVE_TABLE` for default moves (tackle/growl/ember etc).
- **`MOVE_TABLE`**: Static fallback table covering ~50 common moves with real power/category/type.
- **`getMoveData(name)`**: Exported helper used by battle.ts for fallback.
- **`calcDamage()`**: Real STAB (`attacker.types.includes(move.type) ? 1.5 : 1.0`) and real type effectiveness (`getTypeEffectiveness(move.type, defender.types[0], defender.types[1])`).

### 3. `battle.ts` — Replaced broken formula
```typescript
// NEW — uses DB move data (loaded in loadBattleTeam) + proper calcDamage
const moveInfo = attacker.moveData?.[moveIndex] ?? getMoveData(moveName);
const { damage, effectiveness, isCrit } = calcDamage(attacker, defender, moveInfo, currentState.weather);
```

---

## Simulation Results (`scripts/battle-sim.js`)

Charmeleon Lv20 (SpAtk=60) vs Wartortle Lv20 (SpDef=80) using Ember (Fire Sp. 40):

| | Before | After |
|--|--------|-------|
| Avg damage/hit | 1.0 | 5.2 |
| Type eff applied | no | 0.5x (fire→water) |
| STAB applied | no | 1.5x |
| Turns to KO | ~78 | ~15 |

Wartortle (Atk=63) vs Charmeleon (Def=43) using Bite (Dark Ph. 60):

| | Before | After |
|--|--------|-------|
| Avg damage/hit | 1.5 | 17.7 |
| Turns to KO | ~42 | ~4 |

Level scaling (all using Lv-matched stat-65 base Pokémon, power 40):

| Level | OLD avg dmg | NEW avg dmg | Turns to KO |
|-------|-------------|-------------|-------------|
| Lv10 | 1.0 | 5.2 | ~6 |
| Lv20 | 1.0 | 9.1 | ~6 |
| Lv50 | 1.0 | 17.8 | ~7 |
| Lv100 | 1.0 | 32.8 | ~7 |

Old formula: constant 1 dmg at every level. New formula: level-proportional damage, 6–8 turn KO window.

---

## Move Data Source

Canonical source: `PokemonMove` table (`pokemon_moves`) — has `moveName`, `moveType`, `power`, `accuracy`, `pp`, `category`.
Loaded in `loadBattleTeam()` via one batch query per team load.
Fallback: `MOVE_TABLE` in `battleService.ts` covers tackle, ember, water gun, flamethrower, etc.

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/index.ts` | Added `types`, `moveData` to `BattlePokemon` |
| `src/services/battleService.ts` | `MOVE_TABLE`, `getMoveData`, batch DB load, fixed `calcDamage` |
| `src/commands/battles/battle.ts` | Replaced broken formula with `calcDamage()` |
| `scripts/battle-sim.js` | Proof-of-fix simulation script |
