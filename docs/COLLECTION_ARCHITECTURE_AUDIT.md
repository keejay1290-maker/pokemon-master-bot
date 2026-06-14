# Collection Architecture Audit

> Written: S9 | Status: VERIFIED CLEAN

---

## Two Separate Collections

### Pokemon Collection (Trainer side)

| Model | Purpose |
|-------|---------|
| `UserPokemon` | Caught Pokémon owned by a user |
| `Pokemon` | Species data (Dex entry, stats, evolution) |

**Increment points:**
- `/hunt` → `userPokemon.create` + `user.pokemonCaught++`
- `/catch` (spawn button) → `userPokemon.create` + `user.pokemonCaught++`
- `/beg` (3% gift chance) → `userPokemon.create` + `user.pokemonCaught++`
- `/trade` → transfer `userPokemon.userId`
- `/release` → `userPokemon.delete`

### TCG Card Collection

| Model | Purpose |
|-------|---------|
| `UserCard` | Cards owned by a user |
| `Card` | Card data (TCG API, rarity, market value) |

**Increment points:**
- `/pack open` (new sequential reveal) → `userCard.upsert` per card revealed (one at a time in button handler)
- `/pack buy` → does NOT open cards, only adds pack to `UserInventory`
- `/giftpack` → adds pack to `UserInventory` (does NOT open)

---

## Verified Separation (S9 Audit)

| Action | UserPokemon | UserCard | Pokemon | cardsCollected | pokemonCaught |
|--------|-------------|----------|---------|----------------|---------------|
| `/pack open` (reveal button) | ❌ Never | ✅ Yes | ❌ Never | ✅ +1 | ❌ Never |
| `/hunt` catch | ✅ Yes | ❌ Never | ✅ ref | ❌ Never | ✅ +1 |
| `/beg` gift | ✅ Yes | ❌ Never | ✅ ref | ❌ Never | ✅ +1 |
| `/catch` spawn | ✅ Yes | ❌ Never | ✅ ref | ❌ Never | ✅ +1 |
| `/giftpack` | ❌ Never | ❌ Never | ❌ Never | ❌ Never | ❌ Never |
| `/pack buy` | ❌ Never | ❌ Never | ❌ Never | ❌ Never | ❌ Never |

**Result: CLEAN.** No cross-contamination found. The two systems are fully separate.

---

## Pack Inventory (Bridge)

`UserInventory` with `itemId: 'pack:${setId}'` is the bridge between economy and TCG. It holds unopened packs as items. When opened, it calls TCG-side logic only.

**Key invariant:** An unopened pack in `UserInventory` has zero effect on `UserCard` or `UserPokemon` until `/pack open` is called and a reveal button is pressed.

---

## Risk: Old giftpack.ts (Fixed S9)

Before S9, `giftpack.ts` opened packs immediately and wrote to `UserCard` directly (bypassing the reveal system). This was fixed — giftpack now only writes to `UserInventory`.

---

## Future-Proof Rules

1. **Never** create `UserPokemon` from any pack opening path.
2. **Never** create `UserCard` from any Pokémon catch path.
3. The `cardsCollected` counter is incremented ONLY in `packRevealHandler.ts` (per revealed card).
4. The `pokemonCaught` counter is incremented ONLY in spawn catch, hunt catch, and beg gift paths.
