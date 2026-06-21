# Pack Experience Upgrade

Date: 2026-06-21

## Live Issues Addressed

### Card ownership

All cards are now persisted in the same PostgreSQL transaction that creates the
pack session. The inventory pack is consumed first; if card/session creation
fails, the pack is refunded. Once the session exists, reveal clicks never grant
or remove ownership.

This means:

- abandoning a reveal does not lose cards;
- restarting the bot does not lose unrevealed cards;
- Redis outages do not affect canonical ownership;
- duplicate pulls increment quantity;
- a failed Discord message update cannot refund a successfully awarded pack.

Legacy sessions created before this deployment retain their safe per-reveal
grant behavior.

### Images and reveal pacing

- Image URLs are normalized to HTTPS.
- Missing API artwork derives the canonical high-resolution
  `images.pokemontcg.io/<set>/<number>_hires.png` URL.
- Every reveal uses the large embed image position consistently.
- The final card remains visible until the player presses
  **View Pack Results**. It is no longer immediately replaced by the summary.
- Pokémon TCG API requests use bounded retries and timeouts.
- Redis card/set caching is best-effort rather than a hard dependency.

### Seamless journey

The journey is now:

```text
Buy Pack → Open Pack button → pack selector → reveal cards
→ View Pack Results → View Collection or Open Another Pack
```

- Purchase and inventory screens include an **Open Pack** button.
- **View Collection** renders the collection directly in the current message.
- **Open Another Pack** renders a persistent pack selector.
- The collection view includes artwork, unique-card count, total-copy count,
  PokéCoin value, rarity breakdown, and an **Open Another Pack** button.

## Verification

Regression coverage verifies:

- upfront atomic ownership;
- restart-safe PostgreSQL reveal continuation;
- no duplicate grant during resumed reveals;
- stable image URL normalization and fallback generation;
- PostgreSQL remains the reveal concurrency authority.
