# S7 Trainer Progression Audit
> Date: 2026-06-14 | Session S7

---

## XP Sources (Verified)

| Source | XP Granted | Implementation |
|--------|-----------|----------------|
| Catch (normal) | 25 | `spawnService.ts` → `addXp` |
| Catch (shiny) | 100 | `spawnService.ts` → `addXp` |
| Catch (legendary) | 500 | `spawnService.ts` → `addXp` |
| Battle win | 100 + (turns × 2) | `battleService.ts` → `addXp` |
| Daily claim | 50 + min(streak×5, 100) | `daily.ts` → `addXp` |
| Weekly claim | varies | `weekly.ts` → `addXp` |
| Monthly claim | varies | `monthly.ts` → `addXp` |
| Work | varies by career | career command → `addXp` |
| Fish | varies | `fish.ts` → `addXp` |
| Hunt | varies | `hunt.ts` → `addXp` |
| Release Pokémon | 5 | `release.ts` → `addXp` |
| Quest completion | quest.xpReward | `questService.ts` → `addXp` ✅ NEW S7 |
| Achievement unlock | ach.xpReward | `achievementService.ts` (direct increment) |

---

## Level Progression Formula

`level = floor(sqrt(trainerXp / 100)) + 1`

| Level | Total XP Required |
|-------|------------------|
| 1 | 0 |
| 5 | 1,600 |
| 10 | 8,100 |
| 25 | 57,600 |
| 50 | 240,100 |
| 100 | 970,299 |

---

## Trainer Titles (from userService.ts)

| Level | Title |
|-------|-------|
| 1–9 | Rookie Trainer |
| 10–24 | Youngster |
| 25–49 | Ace Trainer |
| 50–74 | Gym Challenger |
| 75–99 | Gym Leader |
| 100–149 | Elite Four |
| 150+ | Champion |

---

## Pokédex Milestone Rewards (NEW S7)

Implemented in `spawnService.ts`. Triggered on `pokemonCaught` increment.

| Milestone | Coins Rewarded |
|-----------|---------------|
| 10 caught | 500 |
| 25 caught | 1,000 |
| 50 caught | 2,500 |
| 100 caught | 5,000 |
| 250 caught | 15,000 |
| 500 caught | 50,000 |

Milestone reward shown in catch embed if triggered.

---

## Nature Stat Modifiers (Verified Pre-existing)

`calcStat()` in `src/utils/pokemon.ts` applies nature modifiers:
- Boosted stat: ×1.1
- Reduced stat: ×0.9
- Neutral natures (Hardy, Docile, Serious, Bashful, Quirky): ×1.0

All 25 natures mapped in `NATURE_MODIFIERS`. Applied in `calcPokemonStats()` which is called by `loadBattleTeam()` in `battleService.ts`. **Already working — no change needed.**

---

## Identified Gaps (Not Fixed in S7)

| Gap | Severity | Notes |
|-----|----------|-------|
| No rank-up announcement | Medium | `addXp()` returns `{ leveledUp }` but no channel post on title change |
| No trainer title on `/leaderboard` | Low | Leaderboard shows level but not title |
| No evolution command | Medium | Schema supports it (`evolutionLevel`, `evolvesFromId`) — S8 priority |
| Pokédex milestones only cover catches | Low | No milestone for shinies caught, legendaries caught separately |
