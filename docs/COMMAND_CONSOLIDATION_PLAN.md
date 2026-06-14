# Command Consolidation Plan
> Date: 2026-06-14 | Session S8
> Current command count: 59 (after S8 adds /inventory + /evolve, removes nothing)

---

## Current Command Inventory

### Economy (15)
`/auction`, `/balance`, `/beg`, `/breeder`, `/buy`, `/career`, `/daily`, `/deposit`, `/fish`, `/fisher`, `/hunt`, `/inventory` (new S8), `/market`, `/miner`, `/monthly`, `/pay`, `/ranger`, `/researcher`, `/rob`, `/rocket`, `/shop`, `/weekly`, `/withdraw`, `/work`

### Pokémon (8)
`/box`, `/catch`, `/evolve` (new S8), `/favorite`, `/nickname`, `/pokedex`, `/pokemon`, `/release`, `/team`, `/trade`

### Cards (3)
`/card`, `/collection`, `/giftpack`, `/pack`

### Social (4)
`/achievements`, `/leaderboard`, `/profile`, `/quests`

### Utility (5)
`/help`, `/ping`, `/professor`, `/setup`, `/welcome`

### Admin (2)
`/config`, `/giftpack`

### Moderation (9)
`/ban`, `/kick`, `/lock`, `/purge`, `/slowmode`, `/timeout`, `/unban`, `/unlock`, `/warn`, `/warnings`

### Giveaways (1)
`/giveaway`

---

## Consolidation Opportunities

### HIGH VALUE — Do in S9

#### 1. Career Commands → `/career work [type]`

Current: `/work`, `/fish`, `/fisher`, `/hunt`, `/ranger`, `/breeder`, `/miner`, `/researcher`, `/rocket` = 9 commands

Proposed: `/career work <type>` (select menu) + `/career view` + `/career leaderboard` + `/career shop` = 4 commands

**Saves: 5 commands** | UX win: single entry point for all career work

#### 2. Economy Subcommands

Current `/balance`, `/deposit`, `/withdraw`, `/pay` = 4 commands

Proposed: `/bank balance` | `/bank deposit <amount>` | `/bank withdraw <amount>` | `/pay <user> <amount>` (keep as-is)

Actually `/pay` is distinct (player-to-player transfer). Keep as-is. Merge bank operations:
- `/bank view` (was /balance)
- `/bank deposit`
- `/bank withdraw`

**Saves: 1 command** | moderate UX benefit

#### 3. Moderation → Subcommands Already Make Sense

Moderation commands are intentionally separate per Discord UX norms. Each has a distinct permission level. **Keep as-is.**

---

### MEDIUM VALUE — Consider in S10

#### 4. `/daily` + `/weekly` + `/monthly` → `/rewards`

Current: 3 commands. Proposed: `/rewards daily` | `/rewards weekly` | `/rewards monthly`

**Saves: 2 commands** | Small UX improvement

#### 5. `/auction` already has subcommands

`/auction create`, `/auction bid`, `/auction list`, `/auction end` — already well consolidated. Keep as-is.

---

### LOW VALUE — Do Not Change

- `/giveaway` — subcommands already well structured
- `/profile`, `/achievements`, `/leaderboard`, `/quests` — all distinct enough to keep separate
- `/pokemon`, `/box`, `/team` — distinct views, all used frequently
- `/professor` — unique UX, keep as standalone
- `/setup`, `/config`, `/welcome` — admin setup, keep clear

---

## Target After S9 Consolidation

| Phase | Commands | Delta |
|-------|---------|-------|
| S8 (current) | 59 | +2 (inventory, evolve) |
| S9 (target) | 53 | -6 (career consolidation + bank) |
| S10 (target) | 51 | -2 (rewards consolidation) |

---

## Implementation Notes

- Career consolidation (S9) is the biggest win. Do this when implementing Career V2.
- Always run `npm run deploy:commands` after any structural command change.
- Discord slash command limit is 100 global commands. Current count (59) is safe.
