# Trainer vs TCG Progression — Separation Audit
> Date: 2026-06-14 | Session S8

---

## Design Principle

Two completely separate systems. No crossover. No shared XP. No shared inventory.

| Dimension | Trainer Path | TCG Path |
|-----------|-------------|---------|
| Source | Catches, battles, evolutions, work | Packs, giveaways, giftpack |
| Inventory | Pokémon (UserPokemon table) | Cards (UserCard table) |
| Progression | Trainer XP → Trainer Level → Title | cardsCollected stat, collection value |
| Commands | /pokemon /box /team /battle /evolve /pokedex | /collection /card /pack /giftpack |
| Rewards | Pokédex milestones, rank-ups | Achievement for cardsCollected milestones |

---

## Code Audit — Are They Separated?

### UserPokemon table
- Created only by: catch button handler (`spawnService.ts`)
- Entries contain: `pokemonId`, `level`, `ivs`, `evs`, `nature`, `moves`
- Never populated from card operations

### UserCard table
- Created only by: `openPack()` via pack.ts, giftpack.ts, giveawayJob.ts
- Entries contain: `cardId`, `quantity`, `isFoil`
- Never populated from Pokémon catches or battles

### Shared elements (intentional, not crossover)

| Element | Shared? | Notes |
|---------|---------|-------|
| `balance` (PokéCoins) | Yes — single economy | Correct. Both paths earn/spend the same currency |
| `trainerXp` / `trainerLevel` | No | Only Trainer Path advances XP |
| `cardsCollected` stat | No | Only TCG Path increments this |
| `achievementService` | Yes | Achievements fire for both paths with different triggers |
| `questService` | Yes | Quest types: `catch` (Trainer) vs `open_pack` (TCG) — separate |

---

## Findings

### No Crossover Found

**Pack cards NEVER become Pokémon.** Verified: `openPack()` in `pokemonTcgService.ts` creates `UserCard` rows only. No `UserPokemon` rows are created.

**Caught Pokémon NEVER become cards.** Verified: `spawnService.ts` catch handler creates `UserPokemon` rows only. No `UserCard` rows are created.

### Potential Confusion Points (UX, not architecture)

1. `/box` shows Pokémon. `/collection` shows cards. Names are distinct — no confusion.
2. `cardsCollected` is on the `User` table alongside `pokemonCaught` — both are counters, no shared pool.
3. The market (`/market`) accepts both Pokémon and cards as listing types (`type` field in `MarketListing`). This is intentional and correct — it's a shared marketplace, not shared inventory.

---

## Auction System Note

Current `MarketListing.itemData` is a JSON blob with no ownership validation. A user can type any string as item description. This is a separate issue documented in `AUCTION_SYSTEM_REWORK.md`.

---

## Verdict

Trainer and TCG paths are cleanly separated in both schema and code. No fixes required for the separation itself.

The only recommended improvement: add `/evolve` XP to the progression audit table (done in S8).
