# CAREER SYSTEM DESIGN — S4
Generated: 2026-06-14 | Session S4

---

## Overview

6 career commands replacing the single generic /work. Each career has:
- Independent 1h cooldown (2h for /rocket) keyed as `career:<name>`
- Independent job record in `UserJob` (jobName matches career name)
- Level-up every 10 `timesWorked` — higher level unlocks better equipment
- Trainer XP granted on every successful use
- Equipment tier scales rewards and XP multiplier

All use the `UserJob` Prisma model:
```prisma
model UserJob {
  userId      String
  jobName     String
  level       Int      @default(1)
  timesWorked Int      @default(0)
  totalEarned Int      @default(0)
  lastWorked  DateTime?
  @@unique([userId, jobName])
}
```

---

## /fisher — Pokémon Fisher

**File**: `src/commands/economy/fisher.ts`
**Cooldown**: 1h (`career:fisher`)
**Fail Rate**: 8%

### Equipment Tiers
| Level | Equipment | Reward Mult | XP Mult | Unlocks |
|---|---|---|---|---|
| 1–4 | Old Rod | 1.0x | 1.0x | Common fish |
| 5–9 | Good Rod | 1.3x | 1.15x | Medium fish |
| 10–14 | Super Rod | 1.6x | 1.3x | All fish |
| 15+ | Master Rod | 2.2x | 1.6x | All fish + bonus |

### Loot Table
| Catch | Base Reward | Chance | Min Level |
|---|---|---|---|
| Old boots | 0 (fail) | 8% | — |
| Small Magikarp | 150 | 25% | 1 |
| Goldeen | 400 | 20% | 1 |
| Poliwag | 700 | 15% | 1 |
| Staryu | 1200 | 12% | Good Rod |
| Gyarados | 2000 | 8% | Good Rod |
| Lapras | 3500 | 5% | Super Rod |
| Tentacruel | 5000 | 4% | Super Rod |
| Dragonair | 8000 | 2% | Super Rod |
| Legendary hint | 12000 | 1% | Super Rod |

### Upgrade: `/buy old-rod` / `/buy good-rod` / `/buy super-rod`

---

## /researcher — Pokémon Researcher

**File**: `src/commands/economy/researcher.ts`
**Cooldown**: 1h (`career:researcher`)
**Fail Rate**: 0%

### Equipment Tiers
| Level | Equipment | Reward Mult | XP Mult |
|---|---|---|---|
| 1–4 | Notebook | 1.0x | 1.0x |
| 5–9 | Pokédex Scanner | 1.3x | 1.15x |
| 10–14 | Lab Kit | 1.6x | 1.3x |
| 15+ | Professor Kit | 2.2x | 1.6x |

### Loot Table
| Discovery | Base Reward | Chance |
|---|---|---|
| New habitat data | 200 | 30% |
| Breeding behavior note | 400 | 22% |
| Evolution pattern | 700 | 18% |
| Regional variant data | 1200 | 13% |
| Legendary sighting report | 2000 | 9% |
| Ancient fossil data | 3500 | 5% |
| Type interaction chart | 5000 | 2% |
| Mythical Pokémon evidence | 8000 | 1% |

### Upgrade: `/buy research-kit`

---

## /ranger — Pokémon Ranger

**File**: `src/commands/economy/ranger.ts`
**Cooldown**: 1h (`career:ranger`)
**Fail Rate**: 0% (rare pool chance depends on gear)

### Equipment Tiers
| Level | Equipment | Rare Pool % | Reward Mult | XP Mult |
|---|---|---|---|---|
| 1–4 | Net | 5% | 1.0x | 1.0x |
| 5–9 | Tracking Kit | 10% | 1.3x | 1.15x |
| 10–14 | Field Scanner | 15% | 1.6x | 1.3x |
| 15+ | Ranger Gear | 20% | 2.2x | 1.6x |

### Loot Table (Standard)
| Encounter | Base Reward | Chance |
|---|---|---|
| Pidgey flock | 200 | 30% |
| Wild Rattata | 350 | 22% |
| Eevee spotted | 600 | 18% |
| Poliwag pond | 900 | 13% |

### Loot Table (Rare — gear.rarePct)
| Encounter | Base Reward | Chance |
|---|---|---|
| Rare Pokémon tracks | 1800 | 40% |
| Shiny Pokémon sighting | 3500 | 35% |
| Legendary footprints | 6000 | 20% |
| Mythical trace | 10000 | 5% |

### Upgrade: `/buy field-scanner`

---

## /breeder — Pokémon Breeder

**File**: `src/commands/economy/breeder.ts`
**Cooldown**: 1h (`career:breeder`)
**Fail Rate**: 0%

### Equipment Tiers
| Level | Equipment | Reward Mult | XP Mult |
|---|---|---|---|
| 1–4 | Incubator | 1.0x | 1.0x |
| 5–9 | Incubator+ | 1.25x | 1.15x |
| 10–14 | Nursery Pass | 1.5x | 1.3x |
| 15+ | Breeding Kit | 2.0x | 1.6x |

### Loot Table
| Outcome | Base Reward | Chance |
|---|---|---|
| Common Egg hatched | 300 | 30% |
| Nature Mint found | 500 | 22% |
| IV Boost item | 800 | 18% |
| Rare Egg hatched | 1500 | 12% |
| Shiny Egg possibility | 2500 | 8% |
| Perfect IV Pokémon | 4000 | 6% |
| Nursery Pass | 5500 | 3% |
| Legendary Egg sighting | 8000 | 1% |

### Upgrade: `/buy incubator`

---

## /miner — Underground Miner

**File**: `src/commands/economy/miner.ts`
**Cooldown**: 1h (`career:miner`)
**Fail Rate**: 0% (tool tier gates access to better finds)

### Equipment Tiers
| Level | Equipment | Tier | Reward Mult | XP Mult |
|---|---|---|---|---|
| 1–4 | Pickaxe | 1 | 1.0x | 1.0x |
| 5–9 | Steel Pickaxe | 2 | 1.3x | 1.15x |
| 10–14 | Drill | 3 | 1.6x | 1.3x |
| 15+ | Excavation Gear | 4 | 2.2x | 1.6x |

### Loot Table
| Find | Base Reward | Chance | Min Tool Tier |
|---|---|---|---|
| Stone chunks | 200 | 30% | 1 |
| Fire Stone shard | 500 | 20% | 1 |
| Water Stone shard | 500 | 18% | 1 |
| Rare gem | 900 | 12% | 2 |
| Thunder Stone | 1500 | 9% | 2 |
| Old Amber fossil | 2500 | 6% | 3 |
| Dome Fossil | 3500 | 3% | 3 |
| Moon Stone vein | 5000 | 2% | 4 |

### Upgrade: `/buy pickaxe` / `/buy drill`

---

## /rocket — Team Rocket Operative

**File**: `src/commands/economy/rocket.ts`
**Cooldown**: 2h (`career:rocket`)
**Fail Rate**: 30% base, -1% per Rocket level, min 10%

### Rank Benefits
- Higher level = lower fail chance
- `reward *= (1 + level * 0.05)` — scaled heist pay
- Promote every 10 successful operations

### Heist Table
| Operation | Base Reward | Fine | Chance |
|---|---|---|---|
| Petty theft | 500 | 200 | 35% |
| Poké Ball stockpile raid | 900 | 400 | 25% |
| TM smuggling run | 1500 | 700 | 18% |
| Silph Co. intel breach | 2500 | 1200 | 10% |
| Legendary transport intercept | 4000 | 2000 | 7% |
| Master Ball heist | 7500 | 4000 | 4% |
| Rare artifact theft | 12000 | 6000 | 1% |

On failure: fine deducted (balance zeroed if insufficient). No negative balance.
On success: balance + totalEarned incremented, addXp called.

---

## Career Level Progression

All careers: `level += 1` every 10 `timesWorked`.

The level is checked post-upsert:
```typescript
if ((newRecord.timesWorked + 1) % 10 === 0) {
  await prisma.userJob.update({ data: { level: { increment: 1 } } });
  jobLeveledUp = true;
}
```

Level-up shown in embed footer when triggered.

---

## S5 Recommendations

1. Add `/career` overview command showing all 6 jobs, their levels, and timesWorked
2. Add equipment inventory check — player should own the rod/kit to use higher tiers (currently level-gated only)
3. Career achievement badges for reaching level 10/20 in any career
4. Leaderboard subcategory: "Top Fishers", "Top Miners" etc. by totalEarned per jobName
