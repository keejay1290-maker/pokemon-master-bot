# Pack Opening V3 Design

> Generated: 2026-06-14
> Based on audit of `packRevealHandler.ts`, `pack.ts`, `interactionCreate.ts`

---

## Current State (V2)

### What works
- Sequential card reveal via buttons
- Per-card DB write on reveal
- Summary screen at end
- Progress bar (10-char)
- Open Another / View Collection buttons
- Redis session storage with 600s TTL
- Redis lock prevents double-click
- Pack refund on Redis failure
- Rarity emoji display

### Root Cause of "This interaction failed"

From the code audit:

1. **Redis not connected**: `createPackSession()` throws `REDIS_UNAVAILABLE` if `client.redis.isReady` is false → pack refunded, clean handling exists
2. **Session expiry mid-reveal**: 600s TTL means 10 min to open 10 cards. If user walks away and comes back, session is gone. Card is already written to DB though.
3. **Button collector timeout in pack.ts**: The `awaitMessageComponent` in `handleOpen()` has a 30s timeout. If user doesn't select a pack in 30s, it silently fails. This is the most likely cause of "interaction failed" — user sees the selector but doesn't pick in time.
4. **Railway Redis env**: `REDIS_URL` not configured → `createClient` defaults to `redis://localhost:6379` which fails → Redis unavailable → any pack open attempt fails with `REDIS_UNAVAILABLE` refund

**Recommendation for the Railway issue**: Document it as COMMON_MISTAKES #01. The code handles it gracefully with refunds.

---

## V3 Design Goals

### Goal 1: Full-Size Card Images
**Current**: Embed uses `setImage(card.imageLarge)` — but it's a small thumbnail in the embed header
**V3**: Cards fill most of the embed area

Solution:
```typescript
// Build embed with larger image
const embed = new EmbedBuilder()
  .setImage(card.imageLarge)  // Already done — improve embed layout
  .setThumbnail(session.setLogoUrl)
  // Remove extra fields that push image down
```

**Embed content** should show OVER the image or to the side:
```
┌─────────────────────────┐
│  Card 4 of 10           │
│  ⭐ Rare Ultra          │
│  Charizard VMAX         │
│  ┌─────────────────┐    │
│  │                 │    │
│  │   CARD IMAGE    │    │
│  │   (large)       │    │
│  │                 │    │
│  └─────────────────┘    │
│  HP: 330 | Type: 🔥     │
│  Stage: VMAX            │
│  Attack: Max Wildfire    │
│  Weakness: 💧 x2        │
│  Set: Sword & Shield     │
│  Est. Value: 15,000      │
│  ████░░░░░░ 4/10         │
└─────────────────────────┘
```

### Goal 2: Full Card Details
**Current**: Embed shows name, rarity, set, card number
**V3**: Show full card data:

| Field | Source |
|-------|--------|
| Pokémon Name | `card.name` |
| HP | From TCG API `card.hp` |
| Type(s) | From TCG API `card.types` |
| Stage | From TCG API `card.subtypes` |
| Attacks | From TCG API `card.attacks` |
| Weakness | From TCG API `card.weaknesses` |
| Retreat Cost | From TCG API `card.retreatCost` |
| Set | `session.setName` |
| Rarity | `card.rarity` |
| Market Value | From `cardValueService` |

**Need to pass full card data through `ResolvedCard` interface**:
```typescript
interface ResolvedCard {
  id: string;
  name: string;
  rarity: string;
  imageSmall?: string | null;
  imageLarge?: string | null;
  number: string;
  isNew: boolean;
  // NEW FIELDS:
  hp?: string;
  types?: string[];
  subtypes?: string[];
  attacks?: Array<{ name: string; damage: string; cost: string[] }>;
  weaknesses?: Array<{ type: string; value: string }>;
  retreatCost?: number;
  marketValue?: number;
}
```

### Goal 3: Progress Indicator
**Current**: `████░░░░░░ 4/10`
**V3**: Same pattern but more visual:
- Color-coded bar (green = fast, yellow = half, red = last card)
- "Card X of Y — Z remaining"
- Estimated time remaining

### Goal 4: Final Summary Screen
**Current**: Cards opened, new cards, duplicates, best pull
**V3**:

| Field | Description |
|-------|-------------|
| 🃏 Cards Opened | Total count |
| ✨ New Cards | Count |
| ♻️ Duplicates | Count |
| 💰 Estimated Value | Sum of all card market values |
| ⭐ Best Pull | Highest rarity card |
| 🏆 Best Value | Highest market value card |
| 📈 Set Progress | % of set completed (from collection) |
| 📦 Pack Tier | S/A/B/C/D badge |

### Goal 5: Multi-Pack Fast Open Mode
Button option to "Open All" — reveals all 10 cards at once:
```
🗂️ Pack Summary — 10 Cards Opened
Common: 5
Uncommon: 3
Rare: 1
Rare Ultra: 1 ⭐ Charizard VMAX
Est. Value: 23,400 PokéCoins
```

Implementation:
- New button: `pack_open_all:{sessionId}`
- Skips individual reveal, goes straight to summary
- Writes all cards to DB in a single transaction

### Goal 6: ETB & Booster Box Support
**Elite Trainer Box** (ETB):
- 8 packs + 1 guaranteed Rare Holo+ bonus card
- Higher price (e.g., 5,000 coins)
- Special ETB-only card pool

**Booster Box**:
- 12 packs at bulk discount (e.g., 5,000 coins for 12 = ~417/pack)
- 1 guaranteed Illustration Rare+ per box

---

## Pack Reveal Roadmap

| Feature | V2 | V3 Target |
|---------|-----|-----------|
| Card image in embed | ✅ | ✅ Larger, centered |
| Card name | ✅ | ✅ |
| Rarity display | ✅ | ✅ |
| Progress bar | ✅ | ✅ Color-coded |
| New/duplicate badge | ✅ | ✅ |
| Summary screen (basic) | ✅ | ✅ |
| HP, Type, Stage, Attacks | ❌ | ✅ New |
| Weakness/Retreat | ❌ | ✅ New |
| Est. Market Value | ❌ | ✅ New |
| Multi-pack fast open | ❌ | ✅ New |
| ETB support | ❌ | ✅ New |
| Booster box support | ❌ | ✅ New |
| Set progress tracking | ❌ | ✅ New |

---

## Technical Changes Required

### 1. Modify `ResolvedCard` interface in `packRevealHandler.ts`
Add all new fields from TCG API response.

### 2. Update `pack.ts` to pass full card data
In `handleOpen()`, extract TCG card data before creating session:
```typescript
const resolvedCards: ResolvedCard[] = rawCards.map((c) => ({
  // ... existing fields
  hp: card.hp as string,
  types: card.types as string[],
  attacks: card.attacks as Attack[],
  marketValue: await getCardValue(client, card.id, card.rarity, setId),
}));
```

### 3. Update `pokemonTcgService.ts` `openPack()`
Ensure the function returns full card objects from TCG API (not just id/name/rarity/images).

### 4. Create `cardValueService.ts`
Service to calculate and cache card market values.

### 5. Modify `buildRevealEmbed()`
New layout with full card details.

### 6. Add `bulkReveal()` handler
For fast-open mode.

---

## Missing Image Sources

| Aspect | Status |
|--------|--------|
| TCG API image small | ✅ Always included |
| TCG API image large | ✅ Always included |
| Set logos | ✅ Fetched from `/sets` endpoint |
| Custom card backs | ❌ Not implemented |
| Shiny/holo card effect | ❌ Not implemented |

**For full-size card display, `card.imageLarge` from Pokemon TCG API should be sufficient.** Most cards have high-res images available.

---

## Implementation Priority

1. **P0**: Full card data pass-through (HP, type, attacks, etc.)
2. **P0**: Market value in summary
3. **P1**: Improved embed layout
4. **P2**: Multi-pack fast open
5. **P3**: ETB/Booster box support
6. **P3**: Set progress tracking

---

## Root Cause: "This interaction failed" Still Happening

After auditing the code, the most probable causes in order:

1. **Button interaction timeout (most common)**: User clicks "Reveal Next Card" but `awaitMessageComponent` in `interactionCreate.ts` → `handleButton()` has no timeout on the button handler itself. However, if Redis is slow/unreachable during the reveal, the 5-second lock timeout in `packRevealHandler.ts` causes interaction failure.

2. **Redis disconnected mid-session**: If Redis connection drops, `client.redis.get()` returns null → "Session expired" returned.

3. **5-second pack lock**: The NX lock on `pack:lock:${sessionId}` with EX=5 is tight. If the transaction takes >5s, the lock expires and a double-click might proceed.

**Fix**: Increase lock TTL from 5s to 15s, and add a retry mechanism.