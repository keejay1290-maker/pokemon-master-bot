# Leveling & Progression Comparison — pokemon-master-bot vs dank-bot

> Source: direct scan of both repos (2026-06-14).
> Files: `src/events/messageCreate.ts`, `src/services/userService.ts`, `src/utils/pokemon.ts`,
> `prisma/schema.prisma`, `lib/ranks.js`, `lib/dankpass.js`, `commands/economy.js` (dank-bot).

---

## Feature parity table

| Progression System | pokemon-master-bot | dank-bot | Notes |
|---|---|---|---|
| **Message XP** | ✅ | ❌ | 5-20 XP/msg, 60s per-guild Redis cooldown. `GuildUser.xp/level`. |
| **Trainer level (global)** | ✅ | ❌ | `User.trainerLevel`, quadratic: `xpToNext = 100 × level²`. Triggers via `addXp()` in `userService.ts`. |
| **Per-guild XP level** | ✅ | ❌ | `GuildUser.xp` — separate from trainer XP. No level-up announce yet. |
| **Combat/Kill streak** | ❌ | ✅ | `players.streak` + `max_streak` in `db.js`. Kill milestone posts to CH_ECONOMY at 5/10/25. Score bonus: `streak × 15`. |
| **20-tier military rank** | ❌ | ✅ | `lib/ranks.js` — Recruit→General. Score = `kills×100 + longestBonus + streakBonus − deaths×20`. Displayed in all kill embeds. |
| **Battle rank (ELO-like)** | ✅ | ❌ | `User.rankedPoints` starts 1000. `User.rankedTier` (Bronze→Master). Updated in `saveBattleResult()`. |
| **Daily streak** | ✅ | ✅ | PMB: +50/day bonus coins, cap +1000 (48h window). dank-bot: same. |
| **Weekly streak** | ✅ (schema + `lastWeekly`) | ✅ | PMB: schema present; weekly command exists; streak not shown in UI yet. |
| **Monthly streak** | ✅ (schema + `lastMonthly`) | ✅ | PMB: schema present; no `/monthly` command yet. |
| **Battle pass / seasonal** | ❌ | ✅ | dank-bot DankPass: 50 tiers, quadratic XP curve (total ≈ 616k XP), season resets, tier rewards (coins/roles/items/titles). |
| **XP multipliers** | ❌ | ❌ | Neither has passive XP multipliers (e.g. 2× for boosted roles). |
| **Voice XP** | ❌ | ❌ | Neither tracks voice chat. |
| **Prestige system** | ❌ | ❌ | Neither has prestige/rebirth after max level. |
| **Role rewards from XP** | ❌ | ✅ | DankPass tier rewards include Discord role assign. PMB schema has `Guild.marketplaceChannelId` etc., but no role-on-level logic. |
| **Job leveling** | ✅ | ❌ | `UserJob.level` increments per use; affects earnings. |
| **Trainer titles** | ✅ | ✅ | PMB: Rookie→Pokemon Master (7 tiers). dank-bot: DankPass title rewards (Survivor, Raider, Veteran, Warlord…). |
| **Ranked leaderboard** | ✅ | ✅ | PMB: `/leaderboard type:ranked` (rankedPoints). dank-bot: `/leaderboard` (kills, balance). |
| **Achievement system** | ✅ | ✅ | Both have `achievements` table and unlock logic. |
| **Quest system** | ✅ | ✅ | Both have daily/weekly quests with XP/coin rewards. |
| **Pokemon IV/EV system** | ✅ (schema + calc functions) | ❌ | `UserPokemon` has full IV (0-31) and EV (0-252) columns. `calcStat()` and `calcPokemonStats()` in `pokemon.ts`. Not yet exposed in `/box` UI. |
| **Pokemon nature** | ✅ (schema + `randomNature()`) | ❌ | `UserPokemon.nature` stored. `NATURE_MODIFIERS` applies ±10% stat multiplier. Not shown in UI. |
| **Pokemon level/XP growth** | ✅ | ❌ | `UserPokemon.level`, `UserPokemon.xp`. Level-up not currently triggered in code. |
| **Shiny mechanic** | ✅ (spawn + configurable rate) | ❌ | `Guild.shinyRate` (default 0.2%), `UserPokemon.isShiny`, `User.shinyCaught`. |
| **Legendary rarity** | ✅ | ❌ | `Guild.legendaryRate` (0.1%), `User.legendariesCaught`. |

**Parity score: 11/22 systems (50%)**

---

## Detail: pokemon-master-bot progression systems

### Trainer XP (global)
```
Source: src/services/userService.ts:60
- addXp(prisma, userId, xp): increments trainerXp, checks for level-up
- Level formula: level = floor(sqrt(xp / 100)) + 1
- XP to next level: 100 × level²  (level 1 → 100 XP, level 10 → 10k XP, level 100 → 1M XP)
- Titles: Rookie(1), Youngster(10), Trainer(20), Ace(40), Leader(60), Elite Four(80), Master(100)
- NOT currently incremented on battle win — only called from economy commands
```

### Per-guild XP (message XP)
```
Source: src/events/messageCreate.ts:16
- 5-20 XP per message, 60s Redis cooldown per user per guild
- Stored in GuildUser.xp + GuildUser.level (separate from trainer XP)
- No level-up announcement implemented yet
- Now works (Redis connected S3)
```

### Daily streak
```
Source: src/commands/economy/daily.ts:36
- 48h window: diff < 172800000ms → streak + 1, else reset to 1
- Bonus: min(streak × 50, 1000) PokéCoins/day
- UI shows streak + bonus in embed
```

### IV/EV system (hidden depth)
```
Source: prisma/schema.prisma:298-313 + src/utils/pokemon.ts:43-75
- Full IV model: ivHp, ivAttack, ivDefense, ivSpAttack, ivSpDefense, ivSpeed (0-31 each)
- Full EV model: evHp, evAttack, evDefense, evSpAttack, evSpDefense, evSpeed (0-252 each, total 510)
- Nature modifiers: 25 natures, ±10% to one stat pair
- calcStat(base, iv, ev, level, nature): game-accurate formula
- calcHp(base, iv, ev, level): separate HP formula
- calcPokemonStats(pokemon, userPokemon): returns {hp, attack, defense, spAttack, spDefense, speed}
STATUS: Computed but NOT shown in /box or /pokemon commands — invisible to users
```

---

## Detail: dank-bot progression systems

### Military rank (kill-based)
```
Source: lib/ranks.js
- 20 tiers: Recruit, Private, Corporal, Sergeant, Staff Sergeant, Warrant Officer I-V,
  Lieutenant, Captain, Major, Lieutenant Colonel, Colonel, Brigadier General,
  Major General, Lieutenant General, General
- Score = pvp_kills × 100 + longestKillBonus + streakBonus − pvp_deaths × 20
- longestKillBonus: >300m = +750, >200m = +400, >100m = +150
- streakBonus: max_streak × 15
- Displayed in kill embeds, /player, /leaderboard
```

### DankPass (battle pass)
```
Source: lib/dankpass.js
- 50 tiers, 60-day seasons, quadratic XP curve
- Total XP to tier 50: ≈ 616,000 XP
- Rewards per tier: coins, Discord roles, item drops, title strings
- XP sources: quests, achievements, economy events
- Season resets tier progress (not player data)
- Admin can set Discord role per tier via /dankpass admin-setrole
```

### Kill streak
```
Source: index.js:1098-1133
- Milestone posts at kill streaks: 5, 10, 25 (configurable)
- players.streak + max_streak in SQLite
- Economy reward: stockKill({ streak }) feeds into coin awards
```

---

## Recommendations for pokemon-master-bot

### High priority — expose hidden depth

1. **Show IVs/EVs in `/box` and `/pokemon`** — the engine exists; just add fields to embeds.
   `calcPokemonStats(pokemon, userPokemon)` returns real stats. Display as a mini-stat block.

2. **Wire `addXp()` to battle wins** — currently battle completion (`saveBattleResult`) does not call `addXp()`. Simple fix: add `await addXp(prisma, winnerId, 50 + turns)` in `battleService.ts`.

3. **Level-up announcement** — `addXp()` already returns `{ leveledUp, newLevel }`. Wire to a channel post or ephemeral DM when triggered via `/work`, `/battle`, or message XP.

4. **Show monthly streak** — schema has `monthlyStreak`, `lastMonthly`, `lastMonthly`. Add `/monthly` command (copy `/weekly`, extend cooldown to 30 days). Currently 0% utilized.

### Medium priority — new systems

5. **Pokemon level-up from battles** — `UserPokemon.xp` and `UserPokemon.level` are modeled. After each battle, grant XP to participant Pokémon. Triggers evolution path later.

6. **Role rewards on trainer level** — `addXp()` returns `newLevel`. On level milestone (10, 20, 40, 60, 80, 100), assign a configured Discord role. Use `Guild` channels table or a new `GuildLevelRole` table.

7. **Ranked season reset** — `User.season` is tracked. Add a `/admin reset-season` or automated seasonal job that resets `rankedPoints` to 1000, bumps `season`, grants rewards for peak tier achieved.

8. **PokéPass (battle pass)** — model after DankPass: 40-50 tier seasonal pass. XP sources: quests, battles, daily streaks, pack openings. Rewards: coins, card packs, rare Pokémon encounters, role assignments.

### Low priority

9. **XP multipliers** — e.g. 2× XP for the first hour of daily login (streak bonus). Store as `multiplierUntil DateTime?` on `User`.

10. **Prestige system** — after Trainer level 100, offer prestige (reset + cosmetic reward). Adds long-term retention.
