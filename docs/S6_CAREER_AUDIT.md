# S6 Career Audit
Date: 2026-06-14 | Session S6

---

## Career System Summary

6 careers, each in its own file under `src/commands/economy/`. All use `UserJob` Prisma model.
Level-up every 10 `timesWorked`. Equipment tier changes at levels 5, 10, 15.

---

## Career-by-Career Audit

### /fisher
**File:** commands/economy/fisher.ts
**Cooldown:** 1h | **Fail rate:** 8% (Old Boots catch = failure)
**Equipment tiers:** Old Rod → Good Rod → Super Rod → Master Rod

| Metric | Assessment |
|--------|-----------|
| Reward scaling | Appropriate — 150 to 12,000 with equipment gating |
| XP scaling | max(20, reward/30) × equipMult — reasonable |
| Equipment progression | Clearly telegraphed names (rods) |
| Distinctiveness | Unique loot table with aquatic theme |
| Issues | None found |

### /researcher
**File:** commands/economy/researcher.ts
**Cooldown:** 1h | **Fail rate:** 0%
**Equipment tiers:** Notebook → Pokédex Scanner → Lab Kit → Professor Kit

| Metric | Assessment |
|--------|-----------|
| Reward scaling | 200 to 8,000 — slightly lower ceiling than fisher |
| XP scaling | max(30, reward/25) × equipMult — highest base XP of all careers |
| Equipment progression | Logical academic ladder |
| Distinctiveness | Flavor text differentiates (habitat data, evolution pattern, etc.) |
| Issues | 0% fail rate makes it risk-free; could benefit from rare "failed experiment" variant |

### /ranger
**File:** commands/economy/ranger.ts
**Cooldown:** 1h | **Fail rate:** 0%
**Equipment tiers:** Net → Tracking Kit → Field Scanner → Ranger Gear

| Metric | Assessment |
|--------|-----------|
| Reward scaling | Dual pool (standard + rare pool gated by gear) — elegant design |
| XP scaling | max(25, reward/30) × equipMult |
| Equipment progression | Rare pool unlock at level 5+ is a meaningful gate |
| Distinctiveness | Shiny sighting in rare pool is on-theme |
| Issues | Rare pool at level 1 still available at 5% — correct |

### /breeder
**File:** commands/economy/breeder.ts
**Cooldown:** 1h | **Fail rate:** 0%
**Equipment tiers:** Incubator → Incubator+ → Nursery Pass → Breeding Kit

| Metric | Assessment |
|--------|-----------|
| Reward scaling | 300 to 8,000 |
| XP scaling | max(25, reward/30) × equipMult |
| Equipment progression | Subtle (Incubator → Incubator+) — could use more distinct naming |
| Distinctiveness | Egg and nature flavoring is strong |
| Issues | "IV Boost item" and "Nursery Pass" in loot table don't go anywhere — no UserInventory |

### /miner
**File:** commands/economy/miner.ts
**Cooldown:** 1h | **Fail rate:** 0%
**Equipment tiers:** Pickaxe → Steel Pickaxe → Drill → Excavation Gear

| Metric | Assessment |
|--------|-----------|
| Reward scaling | 200 to 5,000 — lowest ceiling; compensated by 0% fail rate |
| XP scaling | max(25, reward/30) × equipMult |
| Equipment progression | Min tool tier gating (e.g., Rare gem requires Steel Pick) — good |
| Distinctiveness | Underground reference, stone/fossil theme is strong |
| Issues | Moon Stone vein (5,000) only available at Excavation Gear (level 15) — long grind |

### /rocket
**File:** commands/economy/rocket.ts
**Cooldown:** 2h | **Fail rate:** 30% base (scales down with level, min 10%)
**Equipment tiers:** Grunt → Agent → Elite → Executive

| Metric | Assessment |
|--------|-----------|
| Reward scaling | 500 to 12,000 — highest ceiling, highest risk |
| XP scaling | max(30, reward/25) — no equipMult, reward×level instead |
| Equipment progression | Rank names are thematic (Rocket org structure) |
| Distinctiveness | Only career with meaningful fail chance + fine penalty |
| Issues | 2h cooldown vs 1h for others — correct, reflects higher risk/reward |

---

## Overall Career System Assessment

**Strengths:**
- 6 distinct career identities with different loot tables
- Equipment tier gating creates long-term progression goal
- Rocket's fail/fine mechanic adds risk/reward decision
- /career view (S5) + /career leaderboard (S6) provide visibility

**Gaps:**
- Loot table items (IV Boost, Nursery Pass) don't persist anywhere — no UserInventory
- Career achievements not implemented (reach level 10/20 in a career)
- No career-specific equipment purchase validation (level-gated, not item-gated)
- Breeder "Incubator+" naming is uninspired vs other careers

---

## S7 Recommendations

1. **UserInventory table** — items from careers go somewhere; enables equipment ownership
2. **Career achievement badges** — "Master Fisher" (level 10), "Grand Master Fisher" (level 20) — uses existing achievement system
3. **Career combo bonuses** — unlocked in multiple careers? Unlock "Field Expert" title bonus
4. **Rename Breeder tiers** — "Nursery Aide → Breeding Mentor → Head Breeder → Nursery Master" for clarity
