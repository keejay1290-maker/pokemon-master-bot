# Auction System Rework
> Date: 2026-06-14 | Session S8

---

## Current State

The auction system (`/auction`) uses `MarketListing` with these fields:
- `type` — string (Pokémon / Card / Item / Pack — free text)
- `itemData` — JSON blob (free text description, no validation)
- `isAuction` — boolean
- `currentBid`, `bids`, `auctionEndsAt`

**Core problem:** Users can list anything, even things they don't own. `itemData` is just `{ description: "..." }` — a string the seller types. There is no ownership check.

---

## Required Changes

### 1. Ownership Validation

Auctions should only allow listing of assets the user actually owns:

| Asset Type | Ownership Source | Validation Query |
|-----------|-----------------|-----------------|
| Pokémon | `UserPokemon` table | `findUnique({ where: { id: pokemonId, userId: sellerId } })` |
| Cards | `UserCard` table | `findUnique({ where: { userId_cardId_isFoil: {...} } })` |
| Items | `UserInventory` table (NEW in S8) | `findUnique({ where: { userId_itemId: {...} } })` |
| Packs | N/A — packs are not stored | Do not allow pack listings; award packs via giveaway/giftpack |

### 2. Inventory Freeze on Listing

When a user lists a Pokémon, it should be marked as `isListed = true` (or removed from active team) so they can't trade it while it's listed. Same for cards and items.

**Short-term approach** (S9): Check ownership at bid resolution time rather than locking inventory up front. Note the gap and add a comment.

### 3. Select Menus Over Free Text

Instead of typing item descriptions, the create flow should:

```
/auction create
  → Choose type: [Pokémon | Card | Item]
  → Select menu auto-loads user's owned assets
  → Set starting bid + optional buyout
```

This eliminates the free-text `itemData` field entirely.

### 4. Duplicate Active Listing Prevention

Before creating a new listing, check:
```ts
const existing = await prisma.marketListing.findFirst({
  where: {
    sellerId, status: 'active', isAuction: true,
    itemData: { path: ['id'], equals: assetId }
  }
});
if (existing) throw 'ALREADY_LISTED';
```

### 5. Outbid DM Notification

When a new bid is placed, look up the previous highest bidder from `bids` JSON array and DM them:
> "You were outbid on [Pokémon Name]! Current bid: X PokéCoins. Auction ends <t:timestamp:R>."

---

## Implementation Roadmap

| Priority | Task | Effort |
|---------|------|--------|
| P1 (S9) | Ownership validation at list time (Pokémon + Card + Item) | 2h |
| P1 (S9) | Select menus in /auction create | 2h |
| P2 (S9) | Duplicate listing prevention | 30min |
| P2 (S9) | Outbid DM notification | 1h |
| P3 (S10) | Inventory freeze mechanism (isListed flag on UserPokemon) | 2h |

---

## Schema Changes Required (S9)

```prisma
// On UserPokemon — track if listed
isListed  Boolean  @default(false)
listingId String?  // FK to MarketListing

// On UserCard — track if listed
isListed  Boolean  @default(false)
```

---

## Current Risk

A seller can list a Pokémon they don't own. A buyer pays the bid. The auction job distributes coins to the seller. The buyer receives nothing (or the system crashes trying to transfer a non-existent asset).

**Severity:** High. Prevent by adding ownership check at list time (S9 priority).
