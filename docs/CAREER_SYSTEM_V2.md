# Career System V2 Design
> Date: 2026-06-14 | Session S8
> Reference: dank-bot work/career systems (job equipment, supply shops, upgrade loops)

---

## Current State

The bot has two overlapping career systems:

1. **`/work`** — generic jobs (Pokemon Professor, Ranger, Gym Assistant, etc.) using `UserJob` table with `level`, `totalEarned`, `timesWorked`. Level increases every 10 shifts.

2. **Career-specific commands** — `/fisher`, `/researcher`, `/ranger`, `/breeder`, `/miner`, `/rocket` — each is a standalone command.

**Problem:** The two systems don't connect. Equipment bought in `/shop` (Old Rod, Pickaxe, etc.) has no effect because there was no UserInventory table (fixed in S8). The career commands don't check `UserJob.level` for scaling.

---

## Career Identities (Keep These Six)

| Career | Theme | Equipment | Unique Mechanic |
|--------|-------|-----------|----------------|
| Fisher | Ocean/lake fishing | Old Rod → Good Rod → Super Rod | Rare fish encounters, shinies possible |
| Researcher | Lab/field study | Research Kit | Published papers = big coin bonuses |
| Ranger | Wild patrol | Field Scanner | Rare encounter chance scaling |
| Breeder | Day Care center | Incubator | Egg hatch events, nature bonuses |
| Miner | Underground dig | Pickaxe → Drill | Fossil rewards, gem finds |
| Rocket | Team Rocket heists | Disguise Kit (future) | High risk/reward, can steal items |

---

## V2 Design (Implementation Target: S9)

### Unified Career Entry Point

```
/career view        — show career stats, level, equipment, next milestone
/career leaderboard — top earners per career
/career shop        — buy career-specific upgrades (uses UserInventory)
/career inventory   — view owned career equipment
```

No separate `/fisher`, `/researcher` etc. commands. Consolidate into:
```
/work [career]      — pick career from dropdown, handles all career types
```

### Equipment Tiers (applied when UserInventory has the item)

**Fisher:**
- No equipment: base rewards (100–300 coins)
- Old Rod: 1.3× rewards, unlocks Common fish encounters
- Good Rod: 1.6× rewards, unlocks Rare fish encounters
- Super Rod: 2.0× rewards, unlocks legendary fish encounters

**Miner:**
- No pickaxe: command blocked ("You need a Pickaxe from /shop")
- Pickaxe: base mining rewards (200–500 coins)
- Drill: +fossil encounters, 1.5× rewards

**Researcher:**
- No kit: base 300–600 coins
- Research Kit: +XP, +paper publish chance (2× bonus event)

**Ranger:**
- No scanner: base 200–400 coins, 8% rare encounter
- Field Scanner: 15% rare encounter, 1.4× rewards

### Career Level Progression (via UserJob table)

| Level | Milestones | Bonus |
|-------|-----------|-------|
| 1–4 | Apprentice | Base rewards |
| 5–9 | Journeyman | +10% rewards |
| 10–19 | Expert | +25% rewards, new event pool unlocks |
| 20–49 | Master | +50% rewards |
| 50+ | Legend | +100% rewards, unique title on /career leaderboard |

Scaling formula: `rewardMultiplier = 1.0 + (UserJob.level * 0.05)`

### Rocket Career (Special Rules)

- Heist: high risk (30% failure), high reward (500–2000 coins)
- On failure: lose 200 coins (penalty)
- Success events: steal Pokéballs, coins, rare items
- Requires "Rocket Disguise" (shop item, S10)

---

## Dank-Bot Analogies Applied

| Dank-Bot Concept | Pokemon Bot Equivalent |
|-----------------|----------------------|
| Work equipment scaling reward tiers | Rod/Scanner/Kit equipment tiers |
| Supply shop for work gear | /career shop (uses /shop items) |
| Job level up every 10 uses | UserJob.level every 10 shifts |
| Job-specific rare encounters | Career-specific event pools |
| Long-term progression incentive | Career Legend title at level 50+ |

---

## Not Copied Directly

- No "overtime mode" (dank-bot) — replaced with equipment tiers
- No guild-level job queues — careers are personal
- No degrading tools (durability) — too complex for current scope

---

## S9 Implementation Steps

1. Consolidate `/fisher`, `/ranger`, `/breeder`, `/miner`, `/researcher`, `/rocket` into `/career work [type]`
2. Equipment checks: `prisma.userInventory.findUnique({ where: { userId, itemId: 'old_rod' } })` before reward calc
3. Level scaling: `reward *= (1.0 + userJob.level * 0.05)`
4. `/career view` embed with career stats
5. `/career leaderboard` (group by jobName, sum totalEarned, order desc)
