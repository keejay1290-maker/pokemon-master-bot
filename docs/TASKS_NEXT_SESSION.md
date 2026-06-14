# Tasks — Next Session (S10)

> Updated: 2026-06-14 (S9 wrap-up)
> Bot: 62 commands, build tsc clean
> Start by reading: `docs/S9_SESSION_HANDOFF.md`

---

## P0 — Auction Settlement Job (CRITICAL)

Auctions expire with no winner payout or asset transfer.

**Steps:**
1. Cron (or per-minute setInterval): `marketListing.findMany({ where: { isAuction: true, status: 'active', auctionEndsAt: { lt: new Date() } } })`
2. Top bidder = last entry in `bids` JSON array
3. Coins: `transferBalance(prisma, topBidder.userId, listing.sellerId, topBid.amount)`
4. Asset transfer:
   - `pokemon` → `userPokemon.update({ where: { id: itemData.userPokemonId }, data: { userId: topBidder.userId } })`
   - `item/pack` → `userInventory.upsert` for winner
5. Mark `status: 'sold'`
6. DM winner and seller
7. No-bids: restore escrow to seller, mark `status: 'expired'`

---

## P1 — Career V2 Full Implementation

Design doc: `docs/CAREER_REWORK_V2.md`.

**Steps:**
1. `/career work [type]` replaces /fisher, /ranger, /breeder, /miner, /researcher, /rocket
2. `/career view` — stats, level, equipment, next milestone
3. `/career leaderboard` — top earners per career type
4. `/career shop` — buy equipment tiers (check UserInventory)
5. Level scaling: `reward *= (1.0 + userJob.level × 0.05)`
6. Delete: fisher, ranger, breeder, miner, researcher, rocket, fish.ts
7. `npm run deploy:commands`
8. Target: 62 → 55 commands

---

## P2 — Bank/Rewards Consolidation

From `docs/COMMAND_ARCHITECTURE_REVIEW.md`:
- `/balance` + `/deposit` + `/withdraw` → `/bank view/deposit/withdraw`
- `/daily` + `/weekly` + `/monthly` → `/rewards daily/weekly/monthly`
- Net: -4 commands → target 55 → 51
- `npm run deploy:commands` after

---

## P3 — /rob Pokémon Drops

- On successful rob: 5% chance attacker gains a common Pokémon
- On failed rob: small item consolation chance

---

## P4 — Audit Log for Channel Commands

Add `logModAction` to: `/purge`, `/lock`, `/unlock`, `/slowmode`, `/config`.

---

## P5 — Pokemon Auction Lock

When a Pokémon is listed, block `/release` and `/trade`.
Options: `auctionListed: Boolean` on UserPokemon, OR query `marketListing` active check before those actions.

---

## NEW S9 Discovery — Creator Persona Architecture

The bot may need to support creator-specific deployments (e.g., GrimRipperCards or similar TCG streamers). Planning tasks:

- [ ] Creator profile config layer (name, avatar, socials, WhatNot handle, live status)
- [ ] No hardcoded creator values — all from config/DB
- [ ] WhatNot integration research: Firecrawl scrape? Playwright? Webhook? Scheduled sync?
- [ ] Creator knowledge base (pinned FAQ, promo links, creator-specific commands)
- [ ] Creator live-status system (show when creator is live on WhatNot)
- [ ] Creator reviews aggregation
- [ ] Creator clips/shop integration

**Write `docs/CREATOR_PERSONA_ARCHITECTURE.md` before implementing.**

---

## NEW S9 Discovery — Pack Opening UX Improvements (V3)

Currently working (sequential reveal per button press). Future improvements:
- [ ] Large card image (already in V2 design — verify image size in embed)
- [ ] Animation-ready embed structure (placeholder for future JS/webhook updates)
- [ ] Multi-pack mode (open 10 at once — fast mode)
- [ ] Booster box support (12 packs in one purchase)
- [ ] ETB (Elite Trainer Box) support (8 packs + accessories)

---

## Carry-Forward Bugs

| ID | File | Description |
|----|------|-------------|
| AUC-SETTLE | New scheduler | Auction expiry → no settlement |
| QUEST-SILENT | questService.ts | No DM/notification on quest completion |
| RANKUP-ANNOUNCE | userService.ts | addXp leveledUp=true but no channel post |

---

## Command Count Target

| Session | Count |
|---------|-------|
| S8 end | 61 |
| S9 end | 62 |
| S10 target (Career V2) | 55 |
| S10 target (+ Bank/Rewards) | 51 |

---

## Arch Reminders (S10)

- `addXp(prisma, userId, N)` — never raw `trainerXp: { increment: N }`
- `transferBalance` throws `'INSUFFICIENT_FUNDS'` — always catch
- `checkAndAwardAchievements(client, userId, channelId?, guildId?)` — after stat increments
- `incrementQuestProgress(prisma, userId, type, amount)` — after catch/battle/daily/pack
- After schema changes: `npx prisma generate` → `npm run build` → `npm run db:push`
- Framework sets cooldown BEFORE `execute()` — NEVER also call `checkCooldown()` inside `execute()`
- UserInventory upsert: `upsert({ where: { userId_itemId: { userId, itemId } }, update: { quantity: { increment: qty } }, create: {...} })`
- Pack itemId format: `pack:${setId}` — never use set name as itemId
- Button customId prefix must be registered in `interactionCreate.ts` handleButton() or it silently ignores
