# Tasks — Next Session (S11)

> Updated: 2026-06-14 (S10 wrap-up)
> Bot: 62 commands, build tsc clean
> Start by reading: `docs/S10_SESSION_HANDOFF.md` and `COMMON_MISTAKES.md`

---

## P0 — Career V2 Deploy (START HERE)

Career V2 code is written and compiles. Must deploy:

**Steps:**
1. Delete standalone files: `fisher.ts`, `ranger.ts`, `breeder.ts`, `miner.ts`, `researcher.ts`, `rocket.ts`, `fish.ts` from `src/commands/economy/`
2. Check `src/events/interactionCreate.ts` for any imports of deleted files
3. `npm run build` — verify clean
4. `npm run deploy:commands` — registers `/career work/shop/view/leaderboard`, deregisters 7 old commands
5. Verify command count: 62 → ~55
6. Commit and push

**Cooldown keys carry over** — existing user cooldowns not broken (`career:fisher` etc. same as standalone files).

---

## P0 — Redis URL on Railway (BLOCKING pack open)

Pack opening shows "Interaction Failed" on Railway because `REDIS_URL` is not set.

**Action:** Add `REDIS_URL=<connection string>` to Railway service env vars.
- Railway Redis add-on (easiest)
- Upstash free tier (external option)
- Any Redis 7+ instance

**COMMON_MISTAKES #01** documents this incident fully.

---

## P1 — Bank + Rewards Consolidation

From `docs/COMMAND_CONSOLIDATION_PLAN.md`:
- `/balance` + `/deposit` + `/withdraw` → `/bank view/deposit/withdraw`
- `/daily` + `/weekly` + `/monthly` → `/rewards daily/weekly/monthly`
- Delete 6 files, create 2 new command files
- `npm run deploy:commands`
- Target: 55 → 51 commands

---

## P2 — Creator Persona Platform

**Write `docs/CREATOR_PLATFORM_ARCHITECTURE.md` BEFORE implementing.**

Design:
- `src/config/creator-profile.ts` — provider abstraction (no hardcoded creator values)
- `StaticCreatorProvider` — file-config driven
- `WhatnotCreatorProvider` — Firecrawl/Playwright scheduled scrape for live status, recent sales, reviews
- `FutureCustomProvider` — DB-driven per-guild
- Commands: `/creator`, `/reviews`, `/clips`, `/store`, `/live`
- Research Whatnot API first — may have public endpoints

---

## P3 — Pack/Card Economy Rework

**Write docs first, then implement.**

- `docs/PACK_ECONOMY_V2.md` — TCG market tiers (S/A/B/C) with real pricing
  - Tier S: Base Set, Base Set Shadowless, 1st Edition, Neo Destiny, Skyridge
  - Tier A: Team Rocket, Gym Heroes, Neo Genesis, Neo Revelation
  - Tier B: EX Era, Diamond & Pearl, Platinum, HGSS
  - Tier C: Sun & Moon, Sword & Shield, Scarlet & Violet
  - Research actual prices: TCGPlayer, PriceCharting, eBay sold, PokemonPrice, CardMarket

- `docs/CARD_ECONOMY_REWORK.md` — weighted rarity value tables
  - Rarity × set tier × desirability × pull rate × alt art × legendary/mythical status
  - Examples: Moonbreon = very high, Gold Star Charizard = ultra high, SV commons = low

---

## P4 — Pack Opening V3

Current V2 is sequential card reveal (working). V3 improvements:

- [ ] Pack summary embed shows total estimated pull value
- [ ] Progress: "Card 4 / 10 — 6 cards remaining" (partial in V2)
- [ ] Multi-pack fast-open mode (all 10 cards at once)
- [ ] ETB support (8 packs + accessories)
- [ ] Booster box support (12 packs)

---

## Carry-Forward Bugs

| ID | File | Description | Priority |
|----|------|-------------|----------|
| REDIS-URL-RAILWAY | Railway env | `REDIS_URL` not set → pack open broken | 🔴 P0 |
| QUEST-SILENT | questService.ts | No DM/notification on quest completion | 🟡 P1 |
| RANKUP-ANNOUNCE | userService.ts | Level up event not announced to channel | 🟡 P1 |

---

## Arch Reminders for S11

- `addXp(prisma, userId, N)` — never raw `trainerXp: { increment: N }`
- `transferBalance` throws `'INSUFFICIENT_FUNDS'` — always catch and rollback
- `checkAndAwardAchievements(client, userId, channelId?, guildId?)` — after stat increments
- `incrementQuestProgress(prisma, userId, type, amount)` — after catch/battle/daily/pack/career work
- Pack itemId format: `pack:${setId}` — never use set name as itemId
- Button customId prefix must be registered in `interactionCreate.ts` `handleButton()` or silently ignored
- After schema changes: `npx prisma generate` → `npm run build` → `npm run db:push`
- Redis: always check `client.redis.isReady` before any Redis call — see COMMON_MISTAKES #01

---

## Command Count Tracker

| Session | Count | Notes |
|---------|-------|-------|
| S8 end | 61 | |
| S9 end | 62 | Auction ownership fix, pack reveal, @mention AI |
| S10 end | 62 | Career V2 code written, standalone not yet deleted |
| S11 target (Career deploy) | ~55 | -7 standalone, /career gains 2 new subcommands |
| S11 target (Bank/Rewards) | ~51 | -4 more commands |
