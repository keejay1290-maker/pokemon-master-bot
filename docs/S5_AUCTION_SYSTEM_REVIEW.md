# S5 Auction System Review
Date: 2026-06-14 | Session: S5

---

## Architecture

Both `/market` and `/auction` share the `MarketListing` schema. The `isAuction` boolean differentiates fixed-price vs. timed auction listings.

```
MarketListing
  id (cuid)
  sellerId
  guildId
  type (pokemon | card | item)
  itemData (JSON — name, metadata)
  price (starting bid or fixed price)
  currentBid (Int? — auction only)
  buyoutPrice (Int? — optional)
  bids (JSON array of {userId, username, amount, at})
  isAuction (Boolean)
  auctionEndsAt (DateTime?)
  status (active | sold | cancelled | expired)
```

---

## Market (/market) — Verified Working

| Subcommand | Logic | Status |
|-----------|-------|--------|
| browse | Paginated, filterable by type, page parameter | ✅ |
| list | Creates MarketListing, 10-listing cap per user | ✅ |
| buy | shortId lookup, transferBalance(), creates MarketPurchase | ✅ |
| cancel | Seller-only, marks status='cancelled' | ✅ |

**Gaps:**
- `itemData.name` is a free-text string — no ownership validation. User can list "Pikachu" without owning a Pikachu.
- No fee (listings are free). Could add 5% listing fee in S6.
- `shortId` lookup uses `endsWith` which could theoretically match multiple listings if IDs collide at 6 chars.

---

## Auction (/auction) — Verified Working

| Subcommand | Logic | Status |
|-----------|-------|--------|
| place | Creates isAuction=true listing with auctionEndsAt | ✅ |
| bid | Validates amount > currentBid, appends to bids JSON, instant buyout if ≥ buyoutPrice | ✅ |
| view | Shows current bid, time remaining, top bidder, bid count | ✅ |
| browse | Top 10 active auctions by soonest end time | ✅ |

---

## Auction Settlement Job — NEW S5

**File**: `src/jobs/auctionJob.ts`

**Schedule**: `*/5 * * * *` (every 5 minutes)

**Logic**:
1. Query all `MarketListing` where `isAuction=true, status='active', auctionEndsAt < now()`
2. For each expired listing:
   - No bids → mark `status='expired'`
   - Has bids → find winner (highest `amount` in bids array)
   - Call `transferBalance(prisma, winner.userId, sellerId, winningAmount)`
   - Mark `status='sold'`
   - Create `MarketPurchase` record
   - DM winner and seller (best-effort, DMs may be closed)

**Error handling**: Each listing settled in its own try/catch. One failure does not abort remaining settlements.

---

## Known Limitations

| Limitation | Impact | Priority |
|-----------|--------|---------|
| Outbid refunds not implemented | Losing bidders' coins are not reserved or refunded | High — S6 |
| itemData is free-text, no ownership check | Users can list items they don't own | Medium — S6 |
| No auction extension on last-minute bids | Sniping possible | Low — S7 |
| No search/filter on auction browse | Browse shows newest 10 only | Low — S6 |
| Winner DM is best-effort (no notification if DMs closed) | Winner may miss notification | Low |

---

## Outbid Refund Design (S6 Recommendation)

When a new bid beats the previous high bidder:
1. Find previous highest bidder from `bids` array
2. Call `addBalance(prisma, previousBidderId, previousBidAmount)` (refund)
3. Call `addBalance(prisma, newBidderId, -newBidAmount)` (reserve new bid)

This requires holding coins in escrow. Current schema supports this by tracking `bids` JSON with userId+amount.

---

## Summary

Market and auction systems are functional and correctly wired to `transferBalance()` for payment. The S5 auction settlement job completes the lifecycle that was missing: auctions now auto-settle within 5 minutes of expiry. The primary remaining gap is outbid refunds.
