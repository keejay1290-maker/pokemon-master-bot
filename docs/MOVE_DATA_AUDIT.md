# Move Data Audit
> Date: 2026-06-15 | Scope: PokemonMove schema + population status

---

## PokemonMove Schema — Complete Field List

```prisma
model PokemonMove {
  id          String    @id @default(cuid())
  pokemonId   Int
  moveName    String
  moveType    String
  power       Int?
  accuracy    Int?
  pp          Int
  category    String         // 'Physical' | 'Special' | 'Status'
  description String?
  isLearnset  Boolean   @default(true)
  learnLevel  Int?
  pokemon     Pokemon   @relation(fields: [pokemonId], references: [id], onDelete: Cascade)
}
```

### Available for Battle
| Field | Available | Used in Battle |
|-------|-----------|----------------|
| `moveName` | Yes | Yes (display) |
| `moveType` | Yes | Yes (STAB, type effectiveness) |
| `power` | Yes (nullable) | Yes (damage formula) |
| `accuracy` | Yes (nullable) | **Not yet — Phase 2** |
| `pp` | Yes | No (Discord battles don't track PP) |
| `category` | Yes | Yes (Physical/Special/Status split) |
| `description` | Yes (nullable) | No |
| `learnLevel` | Yes | No |

### Missing Fields (Not in Schema)
| Field | Status | Impact |
|-------|--------|--------|
| `effectChance` | **MISSING** | Cannot determine burn/paralysis/etc. chance from DB |
| `statusInflict` | **MISSING** | Cannot determine which status a move inflicts from DB |
| `priority` | **MISSING** | Quick Attack, Extreme Speed cannot go first |
| `recoilPercent` | **MISSING** | Recoil moves (Take Down, Double-Edge) can't deal recoil |
| `healPercent` | **MISSING** | Recover, Soft-Boiled, Roost not implementable |
| `target` | **MISSING** | All battles are 1v1 so low priority |
| `statChanges` | **MISSING** | Growl/Leer can't reduce stats |

---

## Population Status

`seed.ts` does **not** seed `PokemonMove`. The table is populated only if a separate move-import script exists or was run manually.

When `pokemonMove.findMany({ where: { pokemonId } })` returns `[]`, the catch code falls back to:
```typescript
moves: ['tackle', 'growl', 'scratch', 'quick-attack']
```

Most live Pokémon almost certainly have only these four default moves unless PokemonMove was seeded separately.

**Conclusion**: Battle V2 cannot assume `PokemonMove` rows exist with rich data. The MOVE_TABLE static fallback in `battleService.ts` is currently the only reliable data source for move power and category.

---

## Status Effects — Current State

The current `tryInflictStatus()` in `battleService.ts` (added this session) infers status from move type:
- Fire → burn, Poison → poison, Electric → paralysis, Ice → freeze

**This is wrong per the user's directive.** Not every fire move burns. Ember has 10% burn; Flamethrower has 10% burn; Heat Wave has 10% burn — but Flame Charge has 0% burn. The same applies to all types.

**What's needed**: `statusInflict String?` and `effectChance Int?` on `PokemonMove`, seeded from PokeAPI.

---

## PokeAPI Move Endpoint (for reference)

`https://pokeapi.co/api/v2/move/{name}` returns:

```json
{
  "power": 90,
  "accuracy": 100,
  "pp": 15,
  "priority": 0,
  "damage_class": { "name": "special" },
  "meta": {
    "ailment": { "name": "burn" },
    "ailment_chance": 10,
    "flinch_chance": 0,
    "stat_chance": 0,
    "crit_rate": 0,
    "drain": 0,
    "healing": 0,
    "min_hits": null,
    "max_hits": null
  }
}
```

This provides: `ailment` (status), `ailment_chance`, `priority`, `drain` (recoil), `healing` — everything needed for Battle V2 Full.

---

## Recommendations

### Battle V2 Lite — Implement Now
> Code-only changes, no schema migration, no re-seed.

| Feature | Source | Complexity |
|---------|--------|------------|
| Accuracy check (use PokemonMove.accuracy) | DB field exists (nullable, default to 100) | Low |
| Speed-based turn order every round | Add `roundLeaderId` to BattleState | Low |
| Status DoT in battle (burn/poison called each turn) | `applyStatusDamage()` exists, just not called | Very Low |
| Coin rewards for winning | `saveBattleResult()` update | Very Low |
| Status infliction from moves | **Use static MOVE_TABLE** (not DB — field doesn't exist) | Low |
| Better battle log with emojis | UI change only | Very Low |

**Effort**: ~4 hours. No DB migration. Safe to ship immediately.

**Limitation**: Status effects must come from static MOVE_TABLE (a curated list of known status moves). This covers: Ember, Flamethrower, Fire Blast (burn), Thunderbolt, Thunder (paralysis), Toxic (poison), Blizzard/Ice Beam (freeze). Unknown moves get no status effect.

### Battle V2 Full — Requires Schema Work
> Schema migration + PokeAPI re-seed + code changes.

**Schema additions needed:**
```prisma
model PokemonMove {
  // existing fields...
  statusInflict   String?   // e.g. "burn", "poison", "paralysis"
  effectChance    Int?      // 0-100
  priority        Int       @default(0)
  recoilPercent   Float?    // e.g. 25 for 25% recoil
  healPercent     Float?    // e.g. 50 for Recover
}
```

**Re-seed requirements:**
- Fetch `https://pokeapi.co/api/v2/move/{name}` for every move in the learnset
- Store `meta.ailment.name`, `meta.ailment_chance`, `priority`, `meta.drain`, `meta.healing`
- Likely 500-1000 unique moves across all Pokémon

**Code additions:**
- Status from move definition (not type inference)
- Priority move handling (Quick Attack attacks before normal)
- Recoil damage application after attacking
- Stat stage changes from Status moves (Growl reduces attack)

**Effort**: 1-2 days. Requires schema migration + PokeAPI re-seed script (~500 API calls).

---

## Recommended Path

**Ship V2 Lite first** (accuracy, speed per round, status DoT, coins). These are pure code wins with no schema risk.

**Plan V2 Full as a separate session** after deciding whether to extend PokemonMove schema. Key decision: do we seed ALL moves from PokeAPI, or only moves used in battles? Seeding all moves is more complete but requires more time and storage.

The MOVE_TABLE static fallback ensures battles work correctly for common moves (tackle/ember/thunderbolt/etc.) even before V2 Full is implemented. It is NOT a long-term solution for accurate effect chances — but it is correct for the ~50 moves it covers.
