# TCG Integration Roadmap V2

> Date: 2026-06-14
> API: Pokemon TCG API v2 — `api.pokemontcg.io/v2`
> API key: set as Railway environment variable `POKEMON_TCG_API_KEY` — never print in code or docs
> Existing file: `src/services/pokemonTcgService.ts`
> Existing commands: `/pack`, `/collection`, `/card`

---

## What already works

| Feature | File | Status |
|---|---|---|
| Set listing | `pokemonTcgService.ts:sets()` | ✅ |
| Pack opening (random cards from set) | `pokemonTcgService.ts:openPack()` | ✅ |
| Card search by name | `pokemonTcgService.ts:searchCards()` | ✅ |
| Card rarity detection | `pokemonTcgService.ts` | ✅ `card.rarity` from API |
| TCG image in embeds | `card.images.large` | ✅ |
| `Card.marketValue` column | `prisma/schema.prisma` | ✅ exists, **never populated** |
| `MarketListing.type = "card"` | schema | ✅ card listings modeled |

---

## Phase 1 — Live Card Values (0 schema changes)

**Goal:** Persist real card prices from `tcgplayer.prices.market` into `Card.marketValue`. Enables collection valuation, Silph Market, and leaderboard type.

### TCG API fields available

```json
{
  "tcgplayer": {
    "url": "...",
    "updatedAt": "2024-01-15",
    "prices": {
      "holofoil": { "low": 1.0, "mid": 2.5, "high": 8.0, "market": 2.3, "directLow": 1.8 },
      "normal": { "low": 0.2, "mid": 0.4, "high": 1.2, "market": 0.35 },
      "1stEditionHolofoil": { ... },
      "reverseHolofoil": { ... }
    }
  },
  "cardmarket": {
    "prices": { "averageSellPrice": 1.5, "trendPrice": 1.8, ... }
  }
}
```

### Implementation tasks

- `pokemonTcgService.ts:openPack()` — on pack open, persist `tcgplayer?.prices?.holofoil?.market ?? tcgplayer?.prices?.normal?.market` to `Card.marketValue`
- `pokemonTcgService.ts:searchCards()` — same persistence on `/card` lookup
- `/collection` embed footer: show `SUM(UserCard.quantity × Card.marketValue)` as "Collection Value"
- Add `/leaderboard type:collection_value` — order by collection total descending

**Effort:** ~3h. No schema changes.

---

## Phase 2 — Card Rarity Tracking + Set Completion

**Goal:** Track which cards in each set the user has collected; achievement on set completion.

### TCG API fields available

```
GET /v2/sets → { id, name, total, printedTotal, releaseDate, series }
GET /v2/cards?q=set.id:swsh1 → list all cards in set
```

### Implementation tasks

- New `/sets` command — paginated embed of available TCG sets with completion percentage
- New `/set <set_id>` command — shows cards in set, marks owned/missing in embed
- On `/pack` open: check if user now owns all cards in set → write Achievement
- `Achievement` record type: `SET_COMPLETE:{set_id}` — grants bonus coins + title badge
- `UserCard` already has `setId String` and `setName String` — query is straightforward

**Effort:** ~4h. No schema changes (uses existing `Achievement` + `UserCard` models).

---

## Phase 3 — Silph Market (Card Trading Economy)

**Goal:** P2P card listings and fixed-price market. `MarketListing` is fully modeled.

### Schema already supports this

```prisma
model MarketListing {
  type          String   // "card" | "pokemon" | "item"
  itemData      Json     // { cardId, cardName, setName, rarity, quantity }
  price         Int      // in PokéCoins
  status        String   // "active" | "sold" | "cancelled"
  isAuction     Boolean
  currentBid    Int?
  buyoutPrice   Int?
  bids          Json?    // [{userId, amount, timestamp}]
  auctionEndsAt DateTime?
}
model MarketPurchase { sellerId, buyerId, listingId, price, ... }
```

### Implementation tasks

- `/market list card <card_id> <quantity> <price>` — create fixed-price listing
- `/market browse [rarity] [set] [page]` — paginated embed filtered by rarity/set
- `/market buy <listing_id>` — instant buy; `transferBalance()` → create `MarketPurchase`
- `/auction place card <card_id> <startBid> <hours>` — create auction listing
- `/auction bid <listing_id> <amount>` — outbid; refund previous bidder
- `/auction view <listing_id>` — current state embed with time remaining
- Auction end job: check expired auctions every 5 minutes; settle winning bid

**Effort:** ~6h. No schema changes.

---

## Phase 4 — Pack EV Calculator + Market Analytics

**Goal:** Show expected value (EV) per pack before purchase. Requires price history.

### Implementation tasks

- `PriceHistory` table (new, 1 column): `{ cardId, marketValue, recordedAt }` — snapshot on each pack open
- `/packvalue <set>` command: calculates average pack EV from recent `PriceHistory` for cards in set
- `/card <name>` embed: add price trend chart (last 7 days from `PriceHistory`)
- Market listing embed: show `Card.marketValue` next to asking price as reference

**Effort:** ~4h. Requires 1 new table (`PriceHistory`).

---

## Phase 5 — Deck Builder + Competitive Format Support

**Goal:** Let trainers assemble legal TCG decks from their collection; deck scoring.

### TCG API fields available

- `card.legalities` — `{ standard: "Legal", expanded: "Legal", unlimited: "Legal" }`
- `card.subtypes` — `["Basic", "Stage 1", "Stage 2", "GX", "V", "VMAX", ...]`

### Implementation tasks

- New `Deck` table: `{ userId, name, cards: Json, format: String }` (60-card legal deck)
- `/deck create <name>` — start a new deck
- `/deck add <deck_id> <card_id> <quantity>` — add card (checks collection; enforces 4-copy rule)
- `/deck validate <deck_id>` — checks format legality via `card.legalities`; reports illegal cards
- `/deck score <deck_id>` — rates deck by average market value (budget / mid / premium tier)
- Future: `/deck vs <deck_id_1> <deck_id_2>` — simulate matchup

**Effort:** ~8h. Requires 1 new table (`Deck`).

---

## Phase 6 — Collection Achievements + Social Showcase

**Goal:** Gamify collection milestones; let players show off.

### Implementation tasks

- Achievement types (all use existing `Achievement` model):
  - `CARDS_100`, `CARDS_500`, `CARDS_1000` — collection size milestones
  - `SET_COMPLETE:{set_id}` — complete a full set
  - `LEGENDARY_CARD` — pull a card with rarity = "Rare Secret" or "LEGEND"
  - `RAINBOW_RARE` — pull a Rainbow Rare
  - `COLLECTION_VALUE_1000` — collection worth 1000+ PokéCoins
- `/profile` embed: add "Top Card" field — highest `Card.marketValue` in user's collection
- `/collection` embed: add rarity distribution bar (Common X | Uncommon X | Rare X | ...)
- Announce in guild channel when user pulls a card worth > 100 PokéCoins

**Effort:** ~3h. No schema changes.

---

## Phase summary

| Phase | Feature | Schema changes | Effort | Key dependency |
|---|---|---|---|---|
| 1 | Live card values + collection total | 0 | 3h | Pokemon TCG API `tcgplayer.prices` |
| 2 | Set completion + achievements | 0 | 4h | Phase 1 (card values) |
| 3 | Silph Market + Auction House | 0 | 6h | Phase 1 + `/buy` command |
| 4 | Pack EV + price history | 1 (`PriceHistory`) | 4h | Phase 1 + Phase 3 |
| 5 | Deck builder | 1 (`Deck`) | 8h | Phase 2 |
| 6 | Collection achievements + social | 0 | 3h | Phase 1 + Phase 2 |

**Zero-schema total: Phases 1, 2, 3, 6 = ~16h for a complete TCG economy.**

---

## API rate limits (verified)

- Pokemon TCG API v2: 1,000 requests/day unauthenticated; ~unlimited authenticated
- API key is set — no rate limit concern at current scale
- Cache card data in `Card` table to avoid redundant API calls on every `/collection` view
