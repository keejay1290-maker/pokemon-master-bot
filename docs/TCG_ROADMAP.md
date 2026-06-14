# TCG Roadmap — Pokémon Master Bot

> Source: `docs/POKEMON_TCG_INTEGRATION_AUDIT.md` (S2) + competitor benchmarking.
> `POKEMON_TCG_API_KEY` confirmed set on Railway. API returns `tcgplayer.prices` + `cardmarket.prices` — not yet consumed.

---

## Current state (what already works)

| Feature | Status |
|---|---|
| Real card API (`api.pokemontcg.io`) | ✅ Redis-cached (1h cards, 24h sets) |
| 10-card pack opening with rarity weighting | ✅ |
| Set autocomplete for `/pack` | ✅ |
| Card & set images | ✅ persisted, thumbnail shown |
| Collection persistence (`Card` + `UserCard` tables) | ✅ qty + `isFoil` field |
| `/collection` view | ✅ |
| `/card` lookup | ✅ |

---

## P1 — Highest-value additions (build first)

### P1-TCG-01: Collection value estimation
**What:** Sum `tcgplayer.prices.market` across all owned cards and show in `/collection`.
**Why:** Single highest-leverage addition — uses data already in API response, zero new infra.
**How:**
- When inserting a `Card`, persist `tcgplayer_price` (market USD).
- `/collection` footer: "Estimated value: $X.XX USD".
- `/profile` stat: "Collection value".
- Prisma migration: add `Float? tcgplayerMarketPrice` to `Card` model.

### P1-TCG-02: Set completion tracking
**What:** `/collection set:<id>` shows X/Y cards owned + completion %.
**Why:** Directly drives repeat pack purchasing (Pokétwo's core collection-loop mechanic).
**How:**
- `fetchSets()` already returns total card count per set.
- Count `UserCard` where `card.setId = setId` and `quantity > 0`.
- Show completion bar embed: `[████░░] 34/102 (33%)`.

### P1-TCG-03: Foil / shiny pull chance
**What:** Pack opening sets `isFoil: true` with configurable odds (default 5% for rare, 1% for common).
**Why:** Visual differentiation drives retention — foils feel special in `/collection`.
**Schema change:** None needed — `isFoil` already on `UserCard`.
**How:** In `openPack()`, after rarity roll: `isFoil = Math.random() < foilChance[rarity]`. Add sparkle ✨ to embed for foil pulls.

### P1-TCG-04: Daily featured card
**What:** `giveawayJob`-style daily cron picks one card and posts it to the configured spawn channel with a "Claim" button. First claimer gets the card.
**Why:** Daily active user driver (same mechanic as `/daily` coins but for TCG).
**How:** Add `featuredCardJob` in `src/services/jobService.ts`. Uses existing `UserCard` upsert.

### P1-TCG-05: Live card search command
**What:** `/cards search name:<q> rarity:<r> type:<t> set:<s>` with paginated results (5 per page, prev/next buttons).
**Why:** Closes discovery loop — users can find specific cards to chase.
**How:** Extend `searchCards()` with additional API filters. Buttons use existing collector pattern.

---

## P2 — Strong value additions

### P2-TCG-06: Collection statistics
**What:** `/collection stats` — rarity breakdown (Common X, Uncommon Y …), completion % across all sets, most valuable card.
**How:** Aggregate `UserCard` grouped by `Card.rarity`.

### P2-TCG-07: Card price command
**What:** `/card price <name>` — shows `tcgplayer.prices` (normal/holofoil market, low, high) and `cardmarket.prices`.
**How:** `searchCards()` already returns this. Format into embed with TCGPlayer link.

### P2-TCG-08: Card trading
**What:** Extend `/trade` to optionally trade `UserCard` items instead of (or alongside) Pokémon.
**How:** Add `tradeType: 'pokemon' | 'card'` option. Atomic: check qty ≥ 1, deduct from sender, upsert to receiver — same `$transaction` pattern as pack.

### P2-TCG-09: Collection value leaderboard
**What:** `/leaderboard type:collection` ranks users by sum of card market values.
**How:** Materialize in a daily job into a `leaderboard_cache` table, or compute with a Prisma aggregate.

### P2-TCG-10: Pack variety shop
**What:** `/shop` lists era-based packs at different prices (Base Set pack = 3000 coins, modern set = 1000 coins). Integrate with P1-F01 `/buy`.
**How:** Parameterize `openPack(setId)` — already accepts `set?` option.

### P2-TCG-11: Collection achievements
**What:** Unlock achievements for: first holo, first legendary, complete one set, collection value > $10/$100.
**How:** Hook into existing achievement system; trigger after pack-open.

---

## P3 — Depth features

### P3-TCG-12: Deck builder
**What:** `/deck create <name>`, `/deck add <card_id>`, `/deck view <name>`, `/deck share`.
**Legality:** 60-card limit; 4x copy limit per card name (standard TCG rules).
**Schema:** New `Deck` + `DeckCard` tables.
**Why P3:** High implementation effort; not the core loop.

### P3-TCG-13: Deck sharing / export
**What:** Generate a deck code string or shareable embed link.
**Dependency:** P3-TCG-12.

### P3-TCG-14: Crafting / fusion sink
**What:** Combine N duplicates of the same card into a higher-rarity version.
**Why:** Economy sink for duplicate cards — extends longevity.

---

## Schema changes needed (summary)

| Change | Affects | Priority |
|---|---|---|
| `Card.tcgplayerMarketPrice Float?` | FUNCTIONAL_TEST F-collection-value | P1 |
| `Card.cardmarketPrice Float?` | `/card price` | P2 |
| `Card.setId String` + `Card.setName String` | Set completion | P1 (already likely present) |
| `Deck` + `DeckCard` tables | Deck builder | P3 |

---

## Implementation order

```
P1-TCG-03 (foil odds)        ← zero schema change, 15 min
P1-TCG-01 (collection value) ← one column add + /collection update
P1-TCG-02 (set completion)   ← no schema change
P1-TCG-04 (daily featured)   ← new job, reuse existing patterns
P1-TCG-05 (card search cmd)  ← new command file
P2-TCG-07 (card price cmd)   ← new command, data already in API
P2-TCG-06 (collection stats) ← /collection subcommand
P2-TCG-08 (card trading)     ← extend /trade
P2-TCG-09 (value leaderboard)← extend /leaderboard
P3-TCG-12 (deck builder)     ← new schema + 3 commands
```
