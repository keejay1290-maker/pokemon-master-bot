# TRAINER PROGRESSION SYSTEM — S4
Generated: 2026-06-14 | Session S4

---

## Rank Titles (S4 Spec)

```
Level 1–9:   Rookie Trainer
Level 10–24: Youngster
Level 25–49: Ace Trainer
Level 50–74: Gym Challenger
Level 75–99: Gym Leader
Level 100–149: Elite Four
Level 150+:  Champion
```

Implementation: `src/services/userService.ts → getTrainerTitle(level: number): string`

---

## Level Formula

```
level = floor(sqrt(trainerXp / 100)) + 1
```

Controlled by `addXp()` in `userService.ts`. Each call:
1. Increments `User.trainerXp`
2. Recalculates level
3. If `newLevel > trainerLevel`, updates `User.trainerLevel` and returns `{ leveledUp: true, newLevel }`

XP to reach level N: `(N - 1)^2 * 100`

| Level | XP Required |
|---|---|
| 1 | 0 |
| 5 | 1,600 |
| 10 | 8,100 |
| 25 | 57,600 |
| 50 | 240,100 |
| 75 | 540,400 |
| 100 | 960,100 |
| 150 | 2,160,400 |

---

## XP Sources (post-S4)

| Source | XP Granted | Notes |
|---|---|---|
| /daily | 50 + min(streak*5, 100) | Max +150 at streak 20+ |
| /weekly | ❌ Not wired | S5 backlog |
| /monthly | 200 | Flat |
| /work | max(25, reward/20) | ~25–50 XP |
| /fish | max(10, reward/50) | ~10–20 XP |
| /hunt | max(10, reward/40) | ~10–25 XP |
| /beg | ❌ Not wired | S5 backlog |
| /fisher | max(20, reward/30) * equipMult | ~20–60 XP |
| /researcher | max(30, reward/25) * equipMult | ~30–80 XP |
| /ranger | max(25, reward/30) * equipMult | ~25–70 XP |
| /breeder | max(25, reward/30) * equipMult | ~25–70 XP |
| /miner | max(25, reward/30) * equipMult | ~25–70 XP |
| /rocket | max(30, reward/25) | ~30–80 XP |
| /battle (win) | 100 + turn*2 | ~100–200 XP |
| /trade | ❌ Not wired | S5 backlog |

---

## Profile Display

`src/commands/social/profile.ts` shows:
- Trainer title (from `getTrainerTitle(trainerLevel)`)
- XP progress bar
- `xpToNextLevel()` helper: `((trainerLevel)^2 * 100) - trainerXp`

---

## S5 Recommendations

1. Wire addXp to /weekly (+75 XP), /beg (+5 XP), /trade (+50 XP)
2. Add XP to /catch (+20–40 XP based on rarity)
3. Consider XP bonus for first daily win in /battle (streak bonus)
4. Add rank-up announcement embed when player hits a new title threshold
