# S6 XP Audit
Date: 2026-06-14 | Session S6

---

## XP Source Status (Post-S6)

| Source | XP Amount | Status | File |
|--------|-----------|--------|------|
| /daily | 50 + min(streak×5, 100) | ✅ Wired | commands/economy/daily.ts |
| /weekly | +75 XP | ✅ Wired (S5) | commands/economy/weekly.ts |
| /monthly | +200 XP | ✅ Wired | commands/economy/monthly.ts |
| /work | max(25, reward/20) | ✅ Wired | commands/economy/work.ts |
| /fish | max(10, reward/50) | ✅ Wired | commands/economy/fish.ts |
| /hunt | max(10, reward/40) | ✅ Wired | commands/economy/hunt.ts |
| /beg | +5 XP (on reward > 0) | ✅ Wired (S5) | commands/economy/beg.ts |
| /fisher | max(20, reward/30) × equipMult | ✅ Wired | commands/economy/fisher.ts |
| /researcher | max(30, reward/25) × equipMult | ✅ Wired | commands/economy/researcher.ts |
| /ranger | max(25, reward/30) × equipMult | ✅ Wired | commands/economy/ranger.ts |
| /breeder | max(25, reward/30) × equipMult | ✅ Wired | commands/economy/breeder.ts |
| /miner | max(25, reward/30) × equipMult | ✅ Wired | commands/economy/miner.ts |
| /rocket | max(30, reward/25) | ✅ Wired | commands/economy/rocket.ts |
| /catch (common) | +25 XP | ✅ Wired (S5) | services/spawnService.ts |
| /catch (shiny) | +100 XP | ✅ Wired (S5) | services/spawnService.ts |
| /catch (legendary) | +500 XP | ✅ Wired (S5) | services/spawnService.ts |
| /battle (win) | 100 + turn×2 XP | ✅ Wired | services/battleService.ts |
| /trade (both parties) | +50 XP each | ✅ Wired (S5) | commands/pokemon/trade.ts |
| /release | +5 XP | ✅ NEW S6 | commands/pokemon/release.ts |

---

## Level Formula (Verified)

```
level = floor(sqrt(trainerXp / 100)) + 1
```

Implemented in: `src/services/userService.ts → addXp()`

Level-up check: after every XP grant, `addXp()` recalculates level and updates `User.trainerLevel` if changed.
Returns `{ leveledUp: boolean, newLevel: number }` — all callers show level-up embed field when true.

---

## Rank Titles (Verified in userService.ts)

| Level Range | Title |
|-------------|-------|
| 1–9 | Rookie Trainer |
| 10–24 | Youngster |
| 25–49 | Ace Trainer |
| 50–74 | Gym Challenger |
| 75–99 | Gym Leader |
| 100–149 | Elite Four |
| 150+ | Champion |

---

## XP Pacing Assessment

| Milestone | XP Required | How Long (casual: ~10 catches/day) |
|-----------|-------------|-------------------------------------|
| Youngster (Lv 10) | 8,100 | ~3 days |
| Ace Trainer (Lv 25) | 57,600 | ~2–3 weeks |
| Gym Challenger (Lv 50) | 240,100 | ~2–3 months |
| Gym Leader (Lv 75) | 540,400 | ~6 months |
| Champion (Lv 150) | 2,160,400 | ~2 years |

Pacing feels appropriate. Casual players can reach Ace Trainer in weeks without grinding. Champion is a long-term status symbol.

---

## Gaps Remaining

| Gap | Severity | Notes |
|-----|----------|-------|
| Rank-up announcement (public channel embed) | Low | Level-up shown in ephemeral embed only |
| Pokemon level-up in battle (UserPokemon.xp) | Low | Pokemon xp incremented but level-up never checked |
