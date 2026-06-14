# Career System V2 — Design Document

> Written: S9 | Status: DESIGN APPROVED, IMPLEMENTATION S10

---

## Goal

Transform the current flat work command into a 6-career progression system where equipment from the shop actually matters, levels scale rewards, and each career has its own shop and identity.

---

## Career Overview

| Career | Theme | Core Activity | Primary Reward |
|--------|-------|---------------|----------------|
| Fisher | Water/coastal | Catch fish, find items | Coins + items + rare encounters |
| Researcher | Academia | Lab experiments, data collection | Coins + XP bonus |
| Ranger | Wilderness | Patrol, rescue operations | Coins + Pokémon encounters |
| Breeder | Day Care | Egg care, breeding cycles | Coins + eggs + items |
| Miner | Underground | Rock extraction, gem hunting | Coins + evolution stones |
| Rocket | Criminal | Heists, black market | High risk/high reward |

---

## Command Structure

**Current (fragmented):** `/fisher`, `/ranger`, `/breeder`, `/miner`, `/researcher`, `/rocket`, `/work`, `/fish`, `/hunt`

**Target (consolidated):**

```
/career work [type]     — do career work (select menu if no type)
/career view            — career stats, level, equipment, next milestone
/career leaderboard     — top earners per career
/career shop [career]   — buy career-specific equipment
```

Command count reduction: 6 standalone + 3 generic = 9 → 4 = saves 5 commands.

---

## Equipment Tiers Per Career

### Fisher
| Tier | Item | Cost | Bonus |
|------|------|------|-------|
| 1 | Old Rod | 500 | base fish catches |
| 2 | Good Rod | 2,000 | +25% coin reward |
| 3 | Super Rod | 8,000 | +50% + rare fish |
| 4 | Master Rod | 25,000 | +100% + legendary chance |

### Ranger
| Tier | Item | Cost | Bonus |
|------|------|------|-------|
| 1 | Basic Balls (10x) | 300 | basic catch rate |
| 2 | Great Balls (10x) | 1,000 | +20% catch success |
| 3 | Ultra Balls (10x) | 3,000 | +50% catch success |
| 4 | Master Ball (1x) | 20,000 | guaranteed catch |

### Breeder
| Tier | Item | Cost | Bonus |
|------|------|------|-------|
| 1 | Basic Incubator | 1,000 | hatch common eggs |
| 2 | Improved Incubator | 5,000 | +rare egg chance |
| 3 | Advanced Incubator | 15,000 | +shiny egg chance |
| 4 | Perfect Incubator | 50,000 | IV boost on hatched |

### Researcher
| Tier | Item | Cost | Bonus |
|------|------|------|-------|
| 1 | Field Notes | 500 | base research |
| 2 | Research Kit | 2,000 | +30% XP from work |
| 3 | Data Analyzer | 8,000 | +50% XP + rare data |
| 4 | Pokedex Pro | 25,000 | +100% XP + bonus coins |

### Miner
| Tier | Item | Cost | Bonus |
|------|------|------|-------|
| 1 | Old Pickaxe | 500 | basic mining |
| 2 | Iron Pickaxe | 2,000 | +evolution stone chance |
| 3 | Steel Pickaxe | 8,000 | +rare gem chance |
| 4 | Diamond Drill | 25,000 | +guaranteed stone per shift |

### Rocket
| Tier | Item | Cost | Bonus |
|------|------|------|-------|
| 1 | Disguise | 1,000 | basic heist |
| 2 | Gadget Kit | 5,000 | +success rate |
| 3 | Hacking Tools | 15,000 | +big score chance |
| 4 | Master Plan | 40,000 | +extreme risk/reward |

---

## Level Scaling

`reward *= (1.0 + userJob.level × 0.05)`

Level 1 = base. Level 10 = 1.5× base. Level 20 = 2.0× base.

Level up every 10 uses (existing `timesWorked % 10` logic retained).

---

## Equipment Check Pattern

```typescript
const hasEquipment = await prisma.userInventory.findFirst({
  where: { userId, itemId: { in: FISHER_RODS } },
  orderBy: { itemId: 'desc' }, // highest tier wins
});
const tier = hasEquipment ? FISHER_ROD_TIERS[hasEquipment.itemId] : 0;
reward = Math.floor(reward * TIER_MULTIPLIERS[tier]);
```

---

## Pokémon Encounter Integration

When `rareEncounterChance` triggers:
- Check career type → pull from career-specific encounter table
- Use `spawnService.createManualSpawn()` (to be built S10)
- Ranger gets highest encounter rate
- Rocket gets rarest/criminal-themed Pokémon

---

## S10 Implementation Steps

1. Add `CareerShop` data structure (replaces hardcoded JOBS array)
2. Consolidate 6 standalone career files → delete them
3. Create `/career` command with 4 subcommands
4. Wire equipment tier check into reward calculation
5. Add level scaling multiplier
6. `npm run deploy:commands` — remove deleted commands from Discord
7. Command count: 61 → ~55

---

## Data Migration

`UserJob` table already exists with `jobName`, `level`, `totalEarned`, `timesWorked`.
No schema changes required for V2.
Career shop items use existing `UserInventory` table.
