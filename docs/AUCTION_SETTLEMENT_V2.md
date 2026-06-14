# Auction Settlement V2 — Architecture Decision

> Written: S10 | Status: DECIDED + IMPLEMENTED

---

## Problem Summary

Two settlement gaps exist after S9:

| Gap | Severity | Location |
|-----|----------|----------|
| `auctionJob.ts` transfers coins but never transfers the actual asset (Pokémon/item/pack) to the winner | CRITICAL | `src/jobs/auctionJob.ts` |
| Buyout path in `handleBid` transfers coins but never transfers asset | CRITICAL | `src/commands/economy/auction.ts` |
| Listed Pokémon can be traded/released while auction is active | MEDIUM | `release.ts`, `trade.ts` |

---

## Architecture Decision — Pokemon Lock

### Option A: Escrow Table
Move listed Pokémon into a new `AuctionEscrow` table, removing from `UserPokemon` until settlement.

**Pros:** Zero chance of trade/release after listing.
**Cons:** Schema migration, Pokémon disappears from `/box`/`/pokemon` view, no established escrow table.

### Option B: `isAuctionLocked` flag on UserPokemon
Add `isAuctionLocked: Boolean @default(false)` to schema, set on listing, clear on settlement/cancel.

**Pros:** Pokémon stays visible in collection. Cons: Schema migration required.

### Option C: Query-based Guard (NO schema change)
Before `/release` or `/trade`, query `marketListing.findFirst` for any active auction referencing `userPokemonId`. If found, reject the action.

**Pros:** Zero schema changes, zero migration, works today.
**Cons:** Extra DB query per release/trade (acceptable — both are low-frequency actions).

**Decision: Option C** — query-based guard. No schema migration needed. Release and trade are rare enough that the extra query is negligible.

---

## Asset Transfer Logic (Settlement Job)

```
listing.itemData.type === 'pokemon'
  → userPokemon.update({ where: { id: itemData.userPokemonId }, data: { userId: winnerId } })

listing.itemData.type === 'item'
  → userInventory.upsert({ where: { userId_itemId: { userId: winnerId, itemId: itemData.itemId } },
      update: { quantity: { increment: 1 } },
      create: { userId: winnerId, itemId: itemData.itemId, itemName: itemData.name, quantity: 1 } })

listing.itemData.type === 'pack'
  → same as item (pack:${setId} itemId format)
```

Item/pack escrow was deducted from seller at listing time — nothing to restore on seller side.
Pokemon escrow was not taken (userId not changed) — after transfer, new owner is winner.

---

## No-Bid Escrow Restore

When expired with zero bids:
- `pokemon`: no action needed (userId never changed)
- `item/pack`: `userInventory.upsert` to restore 1 unit to seller

---

## Buyout Settlement Path

When `isBuyout === true` in `handleBid`:
- Transfer coins ✅ (already done)
- Mark status 'sold' ✅ (already done)
- **Transfer asset** ❌ (missing — added S10)
- Create `marketPurchase` ✅ (already done)
- DM winner and seller ❌ (missing — added S10)

---

## Files Changed (S10)

| File | Change |
|------|--------|
| `src/jobs/auctionJob.ts` | + asset transfer per type; + no-bid item/pack restore |
| `src/commands/economy/auction.ts` | + asset transfer + DMs in buyout path |
| `src/commands/pokemon/release.ts` | + auction lock guard (query check) |
| `src/commands/economy/trade.ts` | + auction lock guard (query check) |
