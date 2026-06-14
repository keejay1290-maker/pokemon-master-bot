# Auction Ownership Audit — S9

> Written: S9 | Status: VULNERABILITY FIXED

---

## Pre-S9 Vulnerability

The old `/auction place` command accepted the item name/ID via **text input** — no ownership verification. A user could type any Pokémon or item name and create a listing for something they did not own. The listing was created without touching their inventory or Pokémon table.

**Severity: HIGH** — economic exploit. Any user could sell assets they don't have.

---

## Fix Applied (S9)

### 1. Select Menu Shows Only Owned Assets

Instead of free-text input, the user first selects the `type` (`pokemon | item | pack`), then sees a `StringSelectMenu` populated **exclusively** from their own data:

| Type | Source Query |
|------|-------------|
| `pokemon` | `userPokemon.findMany({ where: { userId } })` |
| `item` | `userInventory.findMany({ where: { userId, quantity: {gt:0}, itemId: { not: {startsWith:'pack:'} } } })` |
| `pack` | `userInventory.findMany({ where: { userId, quantity: {gt:0}, itemId: {startsWith:'pack:'} } })` |

Empty result → immediate `ephemeral` reply, no listing created.

### 2. Re-validation at Listing Time

Between select-menu display and `marketListing.create`, the code re-queries ownership:
- **Pokemon**: `userPokemon.findUnique({ where: { id: selectedValue } })` + verify `pokemon.userId === interaction.user.id`
- **Item/Pack**: `userInventory.findUnique` + verify `quantity >= 1`

This closes the TOCTOU window between select and submit.

### 3. Escrow on Listing Creation

| Type | Escrow Action |
|------|--------------|
| item | `userInventory.update({ data: { quantity: { decrement: 1 } } })` |
| pack | Decrement or delete if quantity === 1 |
| pokemon | No escrow — `userPokemonId` stored in `itemData`, ownership enforced by userId check. Pokémon stays in UserPokemon until bid settlement. |

### 4. Cancel Restores Escrow

`/auction cancel`:
- Only seller or `ManageGuild` mod can cancel.
- Blocked if any bids placed.
- Restores item/pack to inventory via `userInventory.upsert`.
- Pokemon: no restoration needed (ownership never transferred).

### 5. Outbid DM Notification

On each new bid that exceeds the previous top bid, a DM is sent to the previous top bidder:
- `client.users.fetch(previousTopBidder.userId)`
- Embed: "You've Been Outbid!" + item name + new top bid + auction ID
- Wrapped in `.catch(() => {})` — silent if DMs closed.

---

## Remaining Gaps (S10)

| Issue | Risk | Priority |
|-------|------|----------|
| No auction settlement job | Winner never receives asset; seller never gets coins (auctions expire but nothing happens) | HIGH |
| Pokemon ownership not locked | User can still trade/release a listed Pokemon between listing creation and settlement | MEDIUM |
| No bid refund on cancel | If cancel is blocked when bids exist, bidder funds are not at risk — but no escrow on bids either | LOW |
| Buyout balance not pre-checked | Bid amount checked at bid time, but balance could drop between bid and settlement for non-buyout bids | LOW |

**S10 must implement:** Scheduled auction settlement job (cron or per-minute check on `auctionEndsAt`).
