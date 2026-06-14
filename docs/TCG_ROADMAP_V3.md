# TCG Roadmap V3
> Date: 2026-06-14 | Session S8
> API Key: 09d3c22f-db75-4f58-bd4f-e89a37b888e1

---

## API Capabilities

**Pokémon TCG API** (`https://api.pokemontcg.io/v2`)
- `/cards` — search cards with `q=set.id:sv1` etc., returns market prices from TCGplayer
- `/sets` — list all sets with `total` card count, `releaseDate`, `images.logo`
- Free tier: 1,000 req/day | Redis cache keeps actual usage low

**Market Values Available:**
- `card.tcgplayer.prices.holofoil.market`
- `card.tcgplayer.prices.normal.market`
- `card.tcgplayer.prices.reverseHolofoil.market`
- All stored in `Card.marketValue` on first pack open (upsert pattern)

---

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Card schema, pack opening, collection display, /giftpack | ✅ Complete (S4–S7) |
| Phase 2 | Set completion tracking, /sets command | ⬜ Next |
| Phase 3 | Card trading via /trade, ownership-validated market listings | ⬜ Planned |
| Phase 4 | Card grading / condition system | ⬜ Planned |
| Phase 5 | Deck builder | ⬜ Future |
| Phase 6 | TCG tournaments | ⬜ Future |

---

## Phase 2 — Set Completion (S9 Priority)

### `/sets` — Browse All Sets

- Fetch `fetchSets(client)` (cached 24h)
- For each set: count unique cards user owns in that set
- Show: set name, release date, total cards, user's completion %
- Sort by: release date (newest first)

```ts
// Efficient set completion query
const ownedBySet = await prisma.userCard.groupBy({
  by: ['card.setId'],
  where: { userId },
  _count: { cardId: true },
});
```

### `/setinfo [set]` — Detailed Set View

- List all cards in the set (paginated, 15/page)
- Mark each as ✅ (owned) or ❌ (missing)
- Show user's quantity if owned
- Highlight rarest owned cards

### Set Completion Achievement

Trigger: on every pack open, after cards are saved
```ts
const setId = /* the set that was opened */;
const setTotal = await fetchSetCardCount(client, setId);
const owned = await prisma.userCard.count({ where: { userId, card: { setId } } });
if (owned >= setTotal) {
  // Create UserAchievement: SET_COMPLETE:{setId}
  // Grant 10,000 coins + 500 XP
}
```

---

## Phase 3 — Card Trading & Market (S9–S10)

**Card listings in /market:**
- Require `cardId` + `quantity` parameter
- Validate ownership: `prisma.userCard.findUnique({ where: { userId, cardId } })`
- Check quantity available before listing
- On purchase: `UserCard.quantity -= listed qty` for seller; `+qty` for buyer

**Card trading in /trade:**
- Add card tab to existing trade UI
- Select menu shows owned cards with quantities
- Both sides confirm → atomic swap

---

## Live Pricing Strategy

**Current:** Market values stored at pack-open time. Stale after 1 hour (Redis TTL).

**Recommended (S9):** Background price refresh job:
```ts
// Every 6 hours: refresh market values for cards owned by at least 5 users
const popularCards = await prisma.userCard.groupBy({ by: ['cardId'], having: { userId: { _count: { gte: 5 } } } });
// Re-fetch each from TCG API, update Card.marketValue
```

---

## Rarity Weighting (Current)

| Rarity | Weight | Notes |
|--------|--------|-------|
| Common | 60 | Slots 0–7 |
| Uncommon | 25 | Slots 0–7 |
| Rare Holo | 10 | Slots 0–7 |
| Rare | 8 | Slots 0–7 |
| Rare Ultra | 3 | Slots 0–7 |
| Illustration Rare | 2 | Slots 0–7 |
| Special Illustration Rare | 1 | Slots 0–7 |
| Hyper Rare | 0.5 | Slots 8–9 only |
| Amazing Rare | 0.5 | Slots 8–9 only |

Slots 8–9 force non-Common/non-Uncommon cards. This guarantees at least 2 rare-or-better cards per 10-card pack.

---

## Deck Builder — Phase 5 (S11+)

**Schema additions needed:**
```prisma
model Deck {
  id        String     @id @default(cuid())
  userId    String
  name      String
  format    String     // standard / expanded / unlimited
  user      User       @relation(...)
  cards     DeckCard[]
  createdAt DateTime   @default(now())
}

model DeckCard {
  id        String   @id @default(cuid())
  deckId    String
  cardId    String
  quantity  Int      @default(1)
  deck      Deck     @relation(...)
  card      Card     @relation(...)
  @@unique([deckId, cardId])
}
```

Commands: `/deck create`, `/deck view`, `/deck add`, `/deck remove`, `/deck test`

---

## API Rate Limit Management

- Free tier: 1,000 req/day
- With Redis caching (sets: 24h, cards: 1h, searches: 1h): actual API calls ~50–200/day for typical server
- If nearing limit: extend set cache to 72h, card cache to 6h
- Monitor: check Railway logs for 429 responses from `api.pokemontcg.io`
