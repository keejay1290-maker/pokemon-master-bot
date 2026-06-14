# Pack Opening V2 — Design Document

> Written: S9 | Status: APPROVED FOR IMPLEMENTATION

---

## Overview

Replace the current single-embed card dump with a stateful, sequential card reveal system. Each card is revealed one at a time via button press, building anticipation. Anti-abuse protections prevent race conditions and duplicate rewards.

---

## UX Flow

### Phase 0 — Acquisition

| Source | Result |
|--------|--------|
| `/pack buy [set]` | 500 coins deducted → pack added to `UserInventory` |
| `/giftpack` (admin) | Pack added to target's `UserInventory` |

Neither source opens cards immediately. All opening happens through `/pack open`.

### Phase 1 — Inventory Check (`/pack inventory`)

Shows user's unopened packs in a paginated embed:
```
🎒 Your Pack Inventory
━━━━━━━━━━━━━━━━━━━━━
📦 Scarlet & Violet — x3
📦 Base Set — x1
📦 Paldea Evolved — x2

Use /pack open to open a pack
```

### Phase 2 — Pack Selection (`/pack open`)

StringSelectMenu populated from user's inventory:
```
Select a Pack to Open
> Scarlet & Violet (x3)
> Paldea Evolved (x2)
> Base Set (x1)
```

On selection → deduct 1 pack from inventory atomically (within transaction) → create Redis session → show opening embed.

### Phase 3 — Pack Opening Embed (Initial)

```
📦 Scarlet & Violet Pack
━━━━━━━━━━━━━━━━━━━━━━
Cards Remaining: 10 / 10
Progress: ░░░░░░░░░░

[🃏 Reveal Next Card]
```

Set artwork shown as thumbnail if available from TCG API (`set.images.logo`).

### Phase 4 — Sequential Reveal Loop

Each button press → edit same message:

```
Card 3 of 10
━━━━━━━━━━━━
✨ NEW  |  Rare Holo
🃏 Charizard — Base Set #4

Cards Remaining: 7
Progress: ███░░░░░░░

[🃏 Reveal Next Card]
```

- Large card image shown via `embed.setImage(card.imageLarge)`
- `NEW` vs `DUPLICATE` badge based on pre-existing `UserCard` ownership
- Rarity emoji indicator
- Progress bar (10 chars wide, block fill)

Ownership check: `interaction.user.id !== session.userId` → reject silently with ephemeral error.

### Phase 5 — Final Summary (after card 10)

```
📦 Pack Complete — Scarlet & Violet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🃏 Cards Opened: 10
✨ New Cards: 7
♻️  Duplicates: 3
⭐ Best Pull: Charizard ex (Special Illustration Rare)
📊 Set Completion: 47 / 284 (16.5%)

[📦 Open Another Pack]  [📖 View Collection]
```

`Open Another Pack` only active if user has more packs in inventory.

---

## Button Architecture

### customId Scheme

```
pack_reveal:{sessionId}
pack_summary_open_another:{userId}
pack_summary_view_collection:{userId}
```

All IDs are prefixed for routing in `interactionCreate.ts`.

### Session Lifecycle

```
/pack open → select pack → transaction {
  decrement UserInventory quantity
  if quantity reaches 0 → delete row
  fetch 10 cards from openPack()
  persist all 10 cards to UserCard (not incrementing count yet — see Anti-abuse below)
  write Redis session
}
```

**Redis Key:** `pack:session:{sessionId}`
**Value:** JSON object (see State Schema)
**TTL:** 600 seconds (10 minutes). Session expires if user abandons.

### State Schema (Redis)

```typescript
interface PackSession {
  userId: string;
  setName: string;
  setId: string;
  setLogoUrl?: string;
  cards: ResolvedCard[];   // all 10 pre-fetched
  currentIndex: number;    // 0-9, starts at 0
  newCards: string[];      // cardIds that are new
  dupCards: string[];      // cardIds that are duplicates
  revealed: string[];      // cardIds revealed so far
  locked: boolean;         // anti-race mutex
}

interface ResolvedCard {
  id: string;
  name: string;
  rarity: string;
  imageSmall?: string;
  imageLarge?: string;
  number: string;
  isNew: boolean;          // pre-computed at session creation
}
```

### Anti-Abuse: Atomic Deduction

Cards are written to `UserCard` ONE AT A TIME as they are revealed, inside the button handler. This prevents:
1. User clicking away after gaining card 1 but before "completion" → cards 2-10 lost
2. Double-click giving duplicate rewards

**Button handler flow:**
```
1. GET session from Redis
2. Check session.locked === false → if true, reply ephemeral "Already revealing, wait..."
3. SET session.locked = true → SET in Redis (conditional, see race condition note)
4. Read session.currentIndex → get card at that index
5. Write UserCard row for that card (upsert quantity +1)
6. Increment user.cardsCollected +1
7. Increment session.currentIndex
8. SET session.locked = false
9. Edit message with new reveal embed
10. If currentIndex === 10 → show summary, DEL session key
```

### Race Condition Prevention

Discord can fire duplicate button events on double-click. The Redis lock pattern:

```typescript
// Atomic check-and-set using Redis GETSET or SET NX
const lockKey = `pack:lock:${sessionId}`;
const locked = await redis.set(lockKey, '1', { NX: true, EX: 5 });
if (!locked) {
  await interaction.reply({ content: 'Already revealing...', ephemeral: true });
  return;
}
// ... do work ...
await redis.del(lockKey);
```

`SET NX` (only set if not exists) is atomic in Redis. This guarantees only one handler executes per reveal at any time. TTL of 5s ensures lock auto-releases if the handler crashes.

---

## Inventory Integration

### UserInventory Schema (existing)

```prisma
model UserInventory {
  itemId   String  // e.g. "pack:sv1"
  itemName String  // e.g. "Scarlet & Violet Pack"
  quantity Int
  ...
}
```

Pack items use `itemId: 'pack:{setId}'` convention. This is compatible with the existing shop/buy system — the same table serves items and packs.

### `/pack buy` Flow

```typescript
// Atomic purchase + inventory upsert
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.balance < PACK_COST) throw new Error('INSUFFICIENT_FUNDS');
  await tx.user.update({ where: { id: userId }, data: { balance: { decrement: PACK_COST }, totalSpent: { increment: PACK_COST } } });
  await tx.userInventory.upsert({
    where: { userId_itemId: { userId, itemId: `pack:${setId}` } },
    update: { quantity: { increment: 1 } },
    create: { userId, itemId: `pack:${setId}`, itemName: `${setName} Pack`, quantity: 1 },
  });
});
```

### `/pack open` — Deduction Flow

```typescript
await prisma.$transaction(async (tx) => {
  const inv = await tx.userInventory.findUnique({ where: { userId_itemId: { userId, itemId: `pack:${setId}` } } });
  if (!inv || inv.quantity < 1) throw new Error('NO_PACK');
  if (inv.quantity === 1) {
    await tx.userInventory.delete({ where: { userId_itemId: { userId, itemId: `pack:${setId}` } } });
  } else {
    await tx.userInventory.update({ where: { userId_itemId: { userId, itemId: `pack:${setId}` } }, data: { quantity: { decrement: 1 } } });
  }
});
```

---

## Security Checklist

| Check | Where | Implementation |
|-------|-------|----------------|
| Ownership: only session owner can reveal | Button handler | `if (interaction.user.id !== session.userId) reject` |
| Race condition (double-click) | Button handler | Redis SET NX lock, 5s TTL |
| No duplicate card awards | Button handler | One card written per button press, index tracked in session |
| Pack actually owned before open | `/pack open` select | TX checks inventory before session creation |
| Session expiry on abandon | Redis | TTL 600s; cards NOT written until revealed |
| Interaction token expiry (15 min) | N/A | 10-min session TTL keeps within Discord's window |

---

## Collection Separation

Opening a pack **only** creates `UserCard` rows. It does NOT:
- Create `UserPokemon` rows
- Increment `pokemonCaught`
- Trigger Pokemon spawn events

Catching Pokemon **only** creates `UserPokemon` rows. It does NOT:
- Create `UserCard` rows
- Increment `cardsCollected`

These two systems are completely separate. See `docs/COLLECTION_ARCHITECTURE_AUDIT.md`.

---

## Future-Ready Architecture

### Animation-Ready

The card data object is pre-fetched and includes full image URLs. A future version could:
1. Send the initial pack embed immediately
2. Add a loading GIF while fetching
3. Use a webhook edit to replace with actual card image

No re-architecture needed — just swap the embed builder.

### Booster Box / ETB

A booster box (36 packs) would use a different `itemId` (`boosterbox:${setId}`) and open multiple pack sessions in sequence. The session schema already supports `setName`/`setId` making multi-pack chains straightforward.

### Multi-Pack Opening

Future `/pack open [quantity:5]` would pre-fetch all 50 cards into one session, but reveal 10 at a time with a "Next Pack" button between groups.

### Guaranteed Rarity Slots

The `openPack()` function in `pokemonTcgService.ts` already has rare slots (positions 8-9). Future guaranteed-rare can be added by extending the slot configuration without changing the session or reveal architecture.

### Event Packs

`itemId: 'pack:event:halloween_2026'` — same inventory system, different set resolution in the open handler.

---

## File Plan

| File | Change |
|------|--------|
| `src/commands/cards/pack.ts` | Rewrite: subcommands buy/open/inventory |
| `src/commands/admin/giftpack.ts` | Modify: write to UserInventory instead of opening |
| `src/events/interactionCreate.ts` | Add: button handler router for `pack_reveal:*`, `pack_summary:*` |
| `src/handlers/packRevealHandler.ts` | New: button handler logic for sequential reveal |
| `docs/PACK_OPENING_V2.md` | This file |
