# S5 XP and Progression Audit
Date: 2026-06-14 | Session: S5

---

## XP System Overview

- **Source**: `User.trainerXp` (Int, cumulative)
- **Level formula**: `level = floor(sqrt(trainerXp / 100)) + 1`
- **Level-up**: `addXp()` in `userService.ts` checks new level after increment, updates `trainerLevel` if changed
- **Rank titles**: 7-tier ladder in `getTrainerTitle(level)`

---

## Level Thresholds

| Level | XP Required (cumulative) | Title |
|-------|--------------------------|-------|
| 1 | 0 | Rookie Trainer |
| 2 | 100 | Rookie Trainer |
| 3 | 400 | Rookie Trainer |
| 5 | 1,600 | Rookie Trainer |
| 10 | 8,100 | Youngster |
| 15 | 19,600 | Youngster |
| 25 | 57,600 | Ace Trainer |
| 50 | 240,100 | Gym Challenger |
| 75 | 548,100 | Gym Leader |
| 100 | 980,100 | Elite Four |
| 150 | 2,250,100 | Champion |

---

## XP Sources — Verified After S5

| Action | XP Amount | File | Status |
|--------|-----------|------|--------|
| /daily claim | +50 to +150 (random) | economy/daily.ts | ✅ Wired S4 |
| /weekly claim | +75 | economy/weekly.ts | ✅ Wired S5 |
| /monthly claim | +200 | economy/monthly.ts | ✅ Wired S4 |
| /work (any job) | +25 min (scaled to reward) | economy/work.ts | ✅ Wired S4 |
| /fish | +10 to +20 | economy/fish.ts | ✅ Wired S4 |
| /hunt | +10 to +25 | economy/hunt.ts | ✅ Wired S4 |
| /beg (reward > 0) | +5 | economy/beg.ts | ✅ Wired S5 |
| Pokemon catch (normal) | +25 | services/spawnService.ts | ✅ Fixed S5 (was direct increment) |
| Pokemon catch (shiny) | +100 | services/spawnService.ts | ✅ Fixed S5 |
| Pokemon catch (legendary) | +500 | services/spawnService.ts | ✅ Fixed S5 |
| Battle win | +100 + (turns × 2) | services/battleService.ts | ✅ Wired S4 |
| /trade (both traders) | +50 each | pokemon/trade.ts | ✅ Wired S5 |
| /fisher career | +20–200 (scaled, rod bonus) | economy/fisher.ts | ✅ Wired S4 |
| /researcher career | +30–150 | economy/researcher.ts | ✅ Wired S4 |
| /ranger career | +20–100 | economy/ranger.ts | ✅ Wired S4 |
| /breeder career | +20–100 | economy/breeder.ts | ✅ Wired S4 |
| /miner career | +20–120 | economy/miner.ts | ✅ Wired S4 |
| /rocket career | +30–200 | economy/rocket.ts | ✅ Wired S4 |

---

## XP NOT Yet Wired

| Action | Recommended XP | Priority | Reason |
|--------|----------------|----------|--------|
| /pack open | +10 per card | P2 | Natural engagement |
| /trade coins-only | +15 | P3 | Less effort than Pokemon trade |
| Achievement unlock | Per achievement config | P2 | `Achievement.xpReward` exists in schema |
| Quest completion | Per quest config | P2 | `Quest.xpReward` exists in schema |
| Pokémon evolve | +50 | P3 | Evolution system not yet built |
| Raid/event participation | +100-500 | P4 | Events not yet live |

---

## Level-Up Announcement

**Current state**: `addXp()` returns `{ leveledUp: boolean, newLevel: number, user }`. Callers check `leveledUp` and add a field to the response embed if true.

**Gap**: Level-up only announced in the command that triggered it. No server-wide announcement or DM. For high-impact milestones (level 10, 25, 50 — rank title changes), a channel announcement or DM would be valuable.

**Recommendation (S6)**: Add `announceRankUp(client, guildId, userId, newLevel)` function that posts to `guild.trainerHubChannelId` when the trainer crosses a title threshold.

---

## Rank Title Display

Title appears in `/profile` as a description line. No rank role assignment yet.

| Title | Level | Display |
|-------|-------|---------|
| Rookie Trainer | 1–9 | `*Rookie Trainer*` |
| Youngster | 10–24 | `*Youngster*` |
| Ace Trainer | 25–49 | `*Ace Trainer*` |
| Gym Challenger | 50–74 | `*Gym Challenger*` |
| Gym Leader | 75–99 | `*Gym Leader*` |
| Elite Four | 100–149 | `*Elite Four*` |
| Champion | 150+ | `*Champion*` |

---

## Progression Pacing Assessment

| Range | XP needed | Estimated time at casual rate |
|-------|-----------|-------------------------------|
| 1 → 10 | 8,100 | ~5 days (daily + 2x careers) |
| 10 → 25 | 49,500 | ~2 weeks |
| 25 → 50 | 182,500 | ~6 weeks |
| 50 → 100 | 722,500 | ~6 months |
| 100 → 150 | 1,270,000 | ~1+ year |

Pacing is reasonable for a progression system. Rookie → Youngster in ~5 days is achievable. Champion is long-term prestige.
