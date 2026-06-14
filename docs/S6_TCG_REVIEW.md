# S6 TCG System Review
Date: 2026-06-14 | Session S6

---

## API Key

`POKEMON_TCG_API_KEY` is set as Railway environment variable (value: 09d3c22f-db75-4f58-bd4f-e89a37b888e1).
Authenticated requests: ~unlimited per day.
Unauthenticated: 1,000/day (not our situation).

---

## Phase 1 Status: Live Card Values — COMPLETE

Market values are persisted on every `/pack` open via `pack.ts`:

```typescript
const tcgprices = c.tcgplayer?.prices as Record<string, Record<string, number>> | null;
const marketValue =
  tcgprices?.holofoil?.market ??
  tcgprices?.normal?.market ??
  tcgprices?.reverseHolofoil?.market ??
  null;

await client.prisma.card.upsert({
  update: { marketValue: marketValue ?? undefined },
  create: { ..., marketValue },
});
```

`Card.marketValue` column: ✅ exists in schema, ✅ populated on pack open.

### Collection Value Display (NEW S6)

`/collection` now shows:
- Per-card market value in the card list (e.g., "Charizard — Rare Holo (x1) — $12.50")
- Aggregate "Est. Value: $XX.XX" field
- Rarity breakdown bar (Hyper Rare: 1 | Rare: 3 | Common: 12)
- Footer: "Market prices from TCGplayer"

Implementation: 3-query pattern (recent 15, total count, full collection for value + rarity).

---

## Phase 2 Status: Set Completion — NOT STARTED

Requirements:
- `/sets` command (paginated set list with user completion %)
- `/set <id>` (cards in set, owned/missing)
- Achievement on set completion: `SET_COMPLETE:{set_id}`

All schema support exists: `UserCard.setId`, `Achievement` model.
No blocker — pure feature work.

**Priority: S7 — 4h estimate**

---

## Phase 3 Status: Silph Market (Card Trading) — PARTIAL

MarketListing.type = "card" is modeled. `/market list type:card` works technically.
But: no card ownership validation. Users can list any card name without owning it.

What's needed:
- Validate `UserCard` exists for userId + cardId before listing
- `/market browse` filter by rarity/set (currently shows all types)
- Auction improvements for cards (same gap as Pokémon auctions)

**Priority: S7 — needs UserCard ownership check first**

---

## Phase 4 Status: Pack EV + Price History — NOT STARTED

Requires `PriceHistory` table (new migration). No schema change done.
Blocked on: Phase 1 needing sufficient data (needs many pack openings first).

**Priority: S8**

---

## Phase 5 Status: Deck Builder — NOT STARTED

Requires `Deck` table. No schema change done.
High effort (8h). Low priority until card collection is deeper.

**Priority: S9**

---

## Phase 6 Status: Collection Achievements — PARTIALLY DONE

Achievements that map to TCG:
- `CARDS_100`, `CARDS_500` — handled by `checkAndAwardAchievements()` via `cardsCollected` field
- `cardsCollected` is incremented in `pack.ts` after every pack open
- Achievement trigger now fires after pack open (NEW S6)

Still missing:
- `SET_COMPLETE:{set_id}` achievement type — needs Phase 2 set tracking
- `LEGENDARY_CARD`, `RAINBOW_RARE` — rarity-specific pulls not checked

**Priority: S7 (partial, depends on Phase 2)**

---

## S6 TCG Summary

| Phase | Status |
|-------|--------|
| 1 — Live card values | ✅ Complete (pack.ts + collection.ts) |
| 2 — Set completion | ❌ Not started |
| 3 — Silph Market | 🟡 Partial (no ownership validation) |
| 4 — Pack EV | ❌ Not started |
| 5 — Deck builder | ❌ Not started |
| 6 — Collection achievements | 🟡 Partial (cardsCollected wired, set/rarity not) |

**Next TCG milestone: Phase 2 set completion + /sets command (S7)**
