# Common Mistakes — Pokemon Master Bot

> AI agents working on this bot must read this file at session start.
> Add entries when a non-obvious mistake is made so the pattern is never repeated.

---

## Common Mistakes #01 — Redis deployment assumptions

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
☐ REDIS_URL configured in Railway env vars
☐ Redis client shows isReady=true in bot logs
☐ Session create/read/delete tested via live Discord interaction
☐ End-to-end interaction tested on Railway (not local)
☐ Graceful degradation tested: bot stays functional if Redis goes offline
```

**Fix applied (S10):** Added `client.redis.isReady` guard at the top of `handlePackReveal` and `createPackSession`. On `REDIS_UNAVAILABLE`, the pack is refunded and the user sees a clear error. The standalone career files (`fisher.ts` etc.) also called `client.redis.ttl()` inside `handleView` without an `isReady` check — this was corrected in career.ts.

**User action required:** Add `REDIS_URL=<redis connection string>` to Railway service environment variables. Options: Railway Redis add-on, Upstash free tier, or any Redis 7+ instance.

---

## Common Mistakes #02 — Auction settlement: coins transferred, assets not

**Issue (discovered S10):** The auction settlement cron job (`src/jobs/auctionJob.ts`) transferred coins from winner to seller and created a `marketPurchase` record, but never transferred the actual asset (Pokémon, item, or pack) to the winner.

**Rule:** Every market transaction (settlement, buyout, direct sale) must:
1. Transfer coins (`transferBalance`)
2. Transfer asset (pokemon: `userPokemon.update userId`, item/pack: `userInventory.upsert`)
3. Create audit record (`marketPurchase.create`)
4. Notify both parties (DM embed)

The same gap existed in the buyout path of `auction.ts`.

**Fix applied (S10):** Added `transferAsset()` helper in `auctionJob.ts` covering all three asset types. Added identical logic to the buyout block in `auction.ts handleBid`.

---

## Common Mistakes #03 — No-bid auction escrow not restored

**Issue (discovered S10):** When an auction expired with zero bids, the item/pack that was escrowed on listing creation was never returned to the seller. Pokemon were unaffected (they are never moved on listing). Items and packs quietly disappeared.

**Rule:** The no-bid expiry path must call `restoreEscrow()` before marking status `expired`.

**Fix applied (S10):** Added `restoreEscrow(client, data, sellerId)` helper called in the `bids.length === 0` branch of `auctionJob.ts`.

---

## Common Mistakes #04 — Auctioned Pokémon released or traded during active auction

**Issue (discovered S10):** A user could `release` or `trade` a Pokémon that was currently listed in an active auction. The auction would then have no valid asset to transfer.

**Rule:** Before any destructive action on a Pokémon (release, trade, evolve), query `marketListing.findFirst` with JSON path filter `{ path: ['userPokemonId'], equals: id }` and `status: 'active', isAuction: true`. Block the action if a match exists.

**Fix applied (S10):** Guards added to `release.ts` (after `isFavorite` check) and both sides of `trade.ts` (after ownership checks).

**Prisma JSON filter syntax:**
```typescript
itemData: { path: ['userPokemonId'], equals: upId }
```

---

## Common Mistakes #05 — Pack interaction failures assumed to be code bug

**Issue (S11):** Pack opening "This interaction failed" errors were investigated as a code bug when the actual root cause was more nuanced. Multiple failure modes exist.

**Root causes:**
1. **Redis unavailable (P0):** `REDIS_URL` not set → `client.redis.isReady` false → `REDIS_UNAVAILABLE` thrown → pack refunded
2. **Selector timeout:** `awaitMessageComponent` in `pack.ts handleOpen()` has 30s timeout. If user selects a pack but takes >30s to interact → silent failure
3. **Session expiry mid-reveal:** 600s TTL in Redis. If user walks away and comes back >10min later, session is gone (cards already written to DB)
4. **Lock timeout:** 5-second NX lock on `pack:lock:{sessionId}` too tight for slow Redis connections

**Checklist:**
```
☐ Redis isReady=true at startup
☐ Select menu timeout handled gracefully (not silent)
☐ Session TTL longer than max reveal time (currently 600s for 10 cards)
☐ Lock TTL sufficient for DB transaction (currently 5s — increase to 15s)
☐ Card written to DB AFTER session save, not before (prevents partial writes)
```

---

## Common Mistakes #06 — Deleting commands without verifying replacements

**Issue (S11):** Attempting to delete legacy career commands before verifying Career V2 fully covers all features.

**Rule:** Before deleting any command:
1. Verify V2 has all subcommands the legacy commands had
2. Verify V2 uses the same DB tables and cooldown keys
3. Check `interactionCreate.ts` for any imports of the deleted file
4. Check `deploy-commands.ts` for the same
5. Run `npm run build` before deploying
6. Verify command count reduction

**S11 career cleanup confirmation:**
- 7 legacy files use same `UserJob` table and `career:*` cooldown keys
- `/career work` covers all 6 careers
- `/career shop` covers equipment upgrades
- `/career view` shows per-user career progress
- `/career leaderboard` shows rankings
- No imports from deleted files
- `npm run build` verified clean

---

## Common Mistakes #07 — Assuming Redis is available for cooldown checks

**Issue (S11 audit):** The `handleView` function in `career.ts` calls `client.redis.ttl()` inside a loop over all careers, but `handleView` in the legacy standalone career files did the same check without an `isReady` guard.

**Rule:** Every Redis read/write operation must be guarded by `if (!client.redis.isReady) { /* fallback */ }`.

**Fixed in:** `career.ts handleView()` uses `const redisReady = client.redis.isReady;` before the loop.

---

## Common Mistakes #08 — Creator platform hardcoding

**Issue (S11 design):** It's tempting to hardcode a specific creator (GrimRipperCards) into the bot logic.

**Rule:** All creator-specific values must live ONLY in `src/config/creator-profile.ts`. The core bot must never import creator-specific strings, URLs, or images directly. Use the `IDataProvider` interface for all external data.

**Test:** If you change `creator-profile.ts` to a different creator and the bot doesn't work without code changes, you've hardcoded something.

---

## Common Mistakes #09 — Battle damage formula in battle.ts bypassed calcDamage()

**Issue (S13B):** `battle.ts` had an inline damage formula that was never connected to `calcDamage()` in `battleService.ts`:

```typescript
// BROKEN — was in battle.ts move handler
const basePower = 40 + Math.floor(Math.random() * 60);
const damage = Math.max(1, Math.floor(attacker.attack * basePower / (50 * (defender.defense || 1))));
```

For a Lv20 Pokémon (attack=52, defense=80): `52 * 70 / (50 * 80) = 0.91` → always 1 damage. Battles ran 40-80+ turns regardless of level.

**Rule:** All battle damage must go through `calcDamage()` in `battleService.ts`. Never compute damage inline in a command file.

**Fix (commit 1feb448):** `battle.ts` now uses:
```typescript
const moveInfo = attacker.moveData?.[moveIndex] ?? getMoveData(moveName);
const { damage, effectiveness, isCrit } = calcDamage(attacker, defender, moveInfo, currentState.weather);
```

---

## Common Mistakes #10 — STAB and type effectiveness were hardcoded to 1.0

**Issue (S13B):** `calcDamage()` had placeholder values for both STAB and type effectiveness — neither was actually computed:

```typescript
const stab = 1.0;         // placeholder, never computed
const effectiveness = 1.0; // placeholder, getTypeEffectiveness() was imported but never called
```

`BattlePokemon` had no `types` field, so STAB/effectiveness computation was structurally impossible.

**Rule:** After fixing any damage formula, verify: (1) STAB is computed from `attacker.types`, (2) type effectiveness calls `getTypeEffectiveness()` with real defender types, (3) `BattlePokemon` carries `types[]` populated from `Pokemon.type1/type2`.

**Fix (commit 1feb448):** Added `types: string[]` to `BattlePokemon`. Batch-loads `PokemonMove` for all team members in `loadBattleTeam()`. Real STAB and effectiveness in `calcDamage()`.

---

## Common Mistakes #11 — PokemonMove is the canonical move source; seed.ts does not populate it

**Discovery (S13B):** `seed.ts` does NOT seed the `PokemonMove` table. It only seeds `Pokemon`, `Achievement`, `Quest`, and `Event` tables. `PokemonMove` is populated only when a Pokémon is caught (`spawnService.ts`/`hunt.ts`) and ONLY if the API returned learnset data for that specific Pokémon.

**Consequence:** Most live Pokémon have only the fallback moves `['tackle', 'growl', 'scratch', 'quick-attack']` because `pokemonMove.findMany()` returns `[]` for them.

**Rule:** Do not assume `PokemonMove` rows exist. Battle team loading must always fall back to the static `MOVE_TABLE` in `battleService.ts` for moves not found in DB. The static table covers ~50 common moves with real power/category/type.

**Also:** `PokemonMove` schema has NO `effectChance`, `statusInflict`, or `priority` fields. Status effects cannot come from move definitions without a schema migration + PokeAPI re-seed. See `docs/MOVE_DATA_AUDIT.md` for full field inventory.

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
- Always check `client.redis.isReady` before any Redis call.
- Card.marketValue is NEVER populated by default — must be calculated after card insert.
- Pack select menu `awaitMessageComponent` timeout is silently ignored — always catch `InteractionCollectorError` and inform user.
- Pack lock TTL (5s) is insufficient for slow Redis connections — use 15s minimum.
- Session TTL (600s) may expire mid-reveal for users who walk away — use 900s.
- When deleting legacy commands, always verify build and check interactionCreate.ts imports first.
- Creator config lives ONLY in `src/config/creator-profile.ts` — never hardcode creator values in commands.
