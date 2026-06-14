# Pokémon TCG Integration Audit

> Generated S2 (2026-06-14). Source: `src/services/pokemonTcgService.ts`, `src/commands/cards/{pack,card,collection}.ts`, Prisma `Card`/`UserCard` models.
> `POKEMON_TCG_API_KEY` is configured as a secret on Railway. Not printed here.

## Current integration (what exists)

| Capability | Status | Notes |
|---|---|---|
| API client | ✅ | `https://api.pokemontcg.io/v2`, `X-Api-Key` header, Redis-cached (1h cards/search, 24h sets). |
| Card lookup (`/card`) | ✅ | `searchCards(name)` → embed. |
| Card search | ✅ (internal) | `searchCards()` with paging + `orderBy=-set.releaseDate`. Not exposed as a rich search command. |
| Sets | ✅ (internal) | `fetchSets()` used for `/pack` autocomplete only. No `/sets` browse command. |
| Images | ✅ | `imageSmall`/`imageLarge` persisted; best-card thumbnail shown on pack open. |
| Pack opening linked to real cards | ✅ | `openPack()` pulls real cards from a set (or all Pokémon), 10-card pack, rare slot for last 2. |
| Rarity synchronization | ✅ (weighted) | Weighted table (Common→Hyper Rare). Cards persisted with real `rarity`. |
| Collection persistence | ✅ | `Card` (catalog) + `UserCard` (qty, `isFoil`) upserts; `cardsCollected` counter. |
| Collection view (`/collection`) | ✅ | Lists owned cards. |
| Pricing / market data | ❌ | **Not used.** API returns `tcgplayer.prices` + `cardmarket.prices` — ignored. |
| Set completion tracking | ❌ | No "X/Y owned in set". |
| Collection value estimation | ❌ | No coin/USD valuation of a collection. |
| Deck builder / sharing | ❌ | None. |
| Card trading validation | ❌ | `/trade` only trades **Pokémon** (not cards); no card trade path. |
| Collection statistics | ❌ | No rarity breakdown / completion %. |
| Daily featured card | ❌ | None. |
| Foil/holo as gameplay | ⚠️ | `isFoil` exists in schema but pack opening always creates `isFoil:false`. |

## Issues found

| # | Severity | Finding |
|---|---|---|
| T1 | 🔴 | **Hard Redis dependency:** every TCG call starts with `redis.get` (unguarded). With Redis down, `/card`,`/pack`,`/collection` throw. Same root issue as the bot-wide Redis gap. |
| T2 | 🟡 | `pack.ts:36-43` debits coins in a transaction, then fetches cards **outside** it; on fetch failure it refunds, but a crash between debit and refund could lose coins. Acceptable but note. |
| T3 | 🟡 | `tcgplayer.prices` available but unused — biggest untapped value (valuation, market, "chase card"). |
| T4 | 🟢 | `isFoil` modeled but never set true — foil pulls are a cheap retention win. |

---

## High-value features NOT implemented (ranked)

| Feature | Difficulty | Gameplay impact | Retention impact | Priority |
|---|---|---|---|---|
| **Collection value estimation** (sum `tcgplayer.prices.market`) | Low | High | High | **P1** |
| **Set completion tracking** (`/collection set:<id>` → X/Y, %) | Low | High | High | **P1** |
| **Live card search command** (`/cards search` w/ filters: type, rarity, set, paging buttons) | Low | Med | Med | **P1** |
| **Foil/shiny pull chance** (set `isFoil` with small odds + sparkle embed) | Low | Med | High | **P1** |
| **Daily featured card** (job posts a rotating card + small reward to claim) | Low | Med | High | **P1** |
| **Card trading + validation** (extend `/trade` to cards; verify ownership/qty atomically) | Med | High | High | **P2** |
| **Collection statistics** (`/collection stats`: rarity breakdown, completion %, top value) | Low | Med | Med | **P2** |
| **Deck builder** (`/deck create/add/view`, 60-card legality) | High | Med | Med | **P3** |
| **Deck sharing** (export/import code or shareable embed) | Med | Low | Med | **P3** |
| **Market/price command** (`/card price <name>` w/ tcgplayer + cardmarket) | Low | Low | Med | **P2** |
| **Pack variety / set rotation shop** (buy specific era packs) | Med | Med | Med | **P2** |
| **Collection achievements** (first holo, complete a set, value milestones) | Low | Med | High | **P2** |

## Benchmark vs market

| Competitor | What they do that this bot doesn't |
|---|---|
| **Pokétwo** | Deep collection mechanics, market with live pricing, trading with locks/confirmation, completion tracking. (Pokétwo is mons not TCG, but the *collection economy* is the bar.) |
| **TCG Pocket** | Pack-opening as the core loop with foil/art rarity flair, wonder pick, daily packs. → adopt **foil pulls + daily pack**. |
| **TCG Live** | Real deck building + legality + ladder. → `/deck` (P3). |
| **General TCG Discord bots** | `/card price`, set completion, collection value leaderboards. → P1/P2 above. |

## NEXT_SESSION_TASKS
- [ ] P1: Add collection value (tcgplayer market price) + set completion to `/collection`.
- [ ] P1: `/cards search` command with paging + rarity/type/set filters.
- [ ] P1: Foil pull odds (set `isFoil`) + daily featured card job.
- [ ] P2: Card trading with atomic ownership validation; `/card price`.
- [ ] Guard all `client.redis.*` in `pokemonTcgService` (T1) or provision Redis.
