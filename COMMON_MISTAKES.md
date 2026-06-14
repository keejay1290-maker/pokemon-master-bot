# COMMON MISTAKES — Pokemon Master Bot

> AI agents working on this bot must read this file at session start.
> Add entries when a non-obvious mistake is made so the pattern is never repeated.

---

## COMMON_MISTAKES #01 — Redis deployment assumptions

**Issue:** A Redis-backed feature (Pack Opening V2, S10) was marked complete without verifying Redis was actually configured and connected in the Railway deployment environment.

**Symptoms:**
- Discord buttons show "Interaction Failed"
- Component interactions timeout with no response
- Session data cannot be created or retrieved
- Pack open appears to deduct the pack but nothing happens

**Root cause:** `REDIS_URL` was not set in Railway env vars. Redis v4 defaults to `localhost:6379` when `REDIS_URL` is absent, then queues all commands during the reconnect backoff window (up to ~7 seconds via `reconnectStrategy`). Discord interaction responses must arrive within 3 seconds — the queued Redis calls never resolved in time.

**Rule:** Any feature using Redis (buttons, select menus, temporary sessions, auction locks, cooldowns, state machines) must be **deployment-verified in Railway** before being marked complete.

**Checklist (must pass before marking complete):**
```
□ REDIS_URL configured in Railway env vars
□ Redis client shows isReady=true in bot logs
□ Session create/read/delete tested via live Discord interaction
□ End-to-end interaction tested on Railway (not local)
□ Graceful degradation tested: bot stays functional if Redis goes offline
```

**Fix applied (S10):** Added `client.redis.isReady` guard at the top of `handlePackReveal` and `createPackSession`. On `REDIS_UNAVAILABLE`, the pack is refunded and the user sees a clear error. The standalone career files (`fisher.ts` etc.) also called `client.redis.ttl()` inside `handleView` without an `isReady` check — this was corrected in career.ts.

**User action required:** Add `REDIS_URL=<redis connection string>` to Railway service environment variables. Options: Railway Redis add-on, Upstash free tier, or any Redis 7+ instance.

---

## COMMON_MISTAKES #02 — Auction settlement: coins transferred, assets not

**Issue (discovered S10):** The auction settlement cron job (`src/jobs/auctionJob.ts`) transferred coins from winner to seller and created a `marketPurchase` record, but never transferred the actual asset (Pokémon, item, or pack) to the winner.

**Rule:** Every market transaction (settlement, buyout, direct sale) must:
1. Transfer coins (`transferBalance`)
2. Transfer asset (pokemon: `userPokemon.update userId`, item/pack: `userInventory.upsert`)
3. Create audit record (`marketPurchase.create`)
4. Notify both parties (DM embed)

The same gap existed in the buyout path of `auction.ts`.

**Fix applied (S10):** Added `transferAsset()` helper in `auctionJob.ts` covering all three asset types. Added identical logic to the buyout block in `auction.ts handleBid`.

---

## COMMON_MISTAKES #03 — No-bid auction escrow not restored

**Issue (discovered S10):** When an auction expired with zero bids, the item/pack that was escrowed on listing creation was never returned to the seller. Pokemon were unaffected (they are never moved on listing). Items and packs quietly disappeared.

**Rule:** The no-bid expiry path must call `restoreEscrow()` before marking status `expired`.

**Fix applied (S10):** Added `restoreEscrow(client, data, sellerId)` helper called in the `bids.length === 0` branch of `auctionJob.ts`.

---

## COMMON_MISTAKES #04 — Auctioned Pokémon released or traded during active auction

**Issue (discovered S10):** A user could `release` or `trade` a Pokémon that was currently listed in an active auction. The auction would then have no valid asset to transfer.

**Rule:** Before any destructive action on a Pokémon (release, trade, evolve), query `marketListing.findFirst` with JSON path filter `{ path: ['userPokemonId'], equals: id }` and `status: 'active', isAuction: true`. Block the action if a match exists.

**Fix applied (S10):** Guards added to `release.ts` (after `isFavorite` check) and both sides of `trade.ts` (after ownership checks).

**Prisma JSON filter syntax:**
```typescript
itemData: { path: ['userPokemonId'], equals: upId }
```

---

## Architecture Reminders

- `addXp(prisma, userId, N)` — never raw `trainerXp: { increment: N }`. Use service function.
- `transferBalance` throws `'INSUFFICIENT_FUNDS'` — always catch, rollback, and reply.
- `checkAndAwardAchievements(client, userId, channelId?, guildId?)` — fire-and-forget after stat increments.
- `incrementQuestProgress(prisma, userId, type, amount)` — after catch/battle/daily/pack/work.
- Pack itemId format: `pack:${setId}` — never use set name as itemId.
- Button customId prefix must be registered in `interactionCreate.ts` `handleButton()` or it silently fails.
- After schema changes: `npx prisma generate` → `npm run build` → `npm run db:push`.
- Framework sets cooldown BEFORE `execute()` — NEVER also call `checkCooldown()` inside `execute()` for the same key.
- UserInventory upsert unique key: `userId_itemId` — confirm in schema before using.
