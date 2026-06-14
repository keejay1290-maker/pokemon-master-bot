# S6 Rank System Review
Date: 2026-06-14 | Session S6

---

## Current Trainer Rank System

### Titles (getTrainerTitle in userService.ts)

| Level | Title | Theme |
|-------|-------|-------|
| 1–9 | Rookie Trainer | Starting out |
| 10–24 | Youngster | Classic NPC reference |
| 25–49 | Ace Trainer | Mid-game competency |
| 50–74 | Gym Challenger | Ready for gym circuit |
| 75–99 | Gym Leader | Community leader level |
| 100–149 | Elite Four | Elite-level dedication |
| 150+ | Champion | Endgame prestige |

Assessment: Titles are well-themed and form a natural progression. No changes needed to the title list.

---

## Where Rank is Displayed

| Location | Display | Quality |
|----------|---------|---------|
| /profile | Title + level + XP progress bar | Good |
| /catch embed | Level-up field when leveling | Good |
| All economy commands | Level-up field when leveling | Good |
| /career view | Not shown — career-specific | N/A |
| /leaderboard | Not shown | Gap |

### Gap: Leaderboard doesn't show trainer title

`/leaderboard` should include rank title next to each entry. Currently shows username + stat only.

---

## Progress Visibility Assessment

| Feature | Status |
|---------|--------|
| XP shown on /profile | ✅ Yes — trainerXp field |
| Current level shown | ✅ Yes |
| XP to next level shown | ✅ Yes — xpToNextLevel() helper |
| Title shown on profile | ✅ Yes |
| Level-up notification on XP gain | ✅ Yes — ephemeral embed field |
| Public level-up announcement | ❌ Not implemented |
| IV% shown on box | ✅ NEW S6 |
| Nickname shown in box/battle | ✅ Yes |

---

## Improvements Made in S6

1. IV% display in /box — trainers can now evaluate Pokémon quality at a glance
2. /nickname — trainers can express personality through Pokémon names
3. /release — box management enables intentional collection building

---

## Recommendations for S7

1. **Public rank-up announcement** — when `getTrainerTitle(newLevel) !== getTrainerTitle(oldLevel)`, post channel embed: "Trainer reached Gym Challenger!" — drives engagement and social pressure
2. **Title on leaderboard** — add rank title next to username in /leaderboard entries
3. **Badge wall on /profile** — show count of achievements earned as a visual indicator of depth
