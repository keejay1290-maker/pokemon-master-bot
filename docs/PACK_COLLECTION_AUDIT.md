# Pack & Collection Audit
> Date: 2026-06-14 | Session S8

---

## User Report

> "Opening packs does not correctly update collection. Cards are not always reflected correctly. Progression inconsistencies exist."

---

## Code Audit

### pack.ts — UserCard Creation

**Flow verified:**
1. Deduct 500 PokéCoins in `$transaction` (atomic, rolls back on failure)
2. Call `openPack(client, setId)` — returns 10 card objects from TCG API
3. For each card: `prisma.card.upsert()` — ensures the global Card row exists
4. For each card: `prisma.userCard.upsert()` on `(userId, cardId, isFoil)` — increments quantity if already owned
5. `prisma.user.update({ cardsCollected: { increment: cards.length } })`
6. Achievement check (fire-and-forget)
7. Quest increment (fire-and-forget)

**Finding: DB writes are correct.** Upsert logic properly handles duplicate cards by incrementing quantity. Each pack open is an atomic chain of DB operations.

---

### openPack() — Potential Issues Found

**Issue 1: First-page limit**

```ts
const { data: allCards } = await searchCards(client, query, 1, 250);
```

The TCG API `pageSize` is capped at 250 per request. Large sets (e.g. Scarlet & Violet 151 has ~165 cards, but Base Set has 102 and some EX sets exceed 250) could silently truncate. Cards beyond position 250 in a set never appear in packs.

**Severity:** Medium — most sets are under 250 cards. No user-visible error; cards are just limited to first 250.

**Fix path:** Paginate until `totalCount` is satisfied. Defer to S9 — not the source of the reported bug.

**Issue 2: Redis caching stale data**

```ts
const key = `tcg:search:${query}:1:250`;
// TTL = 3600 seconds
```

If a set's card data changes (prices, new cards added), users see cached data for up to 1 hour. Market values also cache at card level for 1 hour. This explains "cards not always reflected correctly" — a user opening a pack right after another user opened from the same set will see the same pool (correct) but with potentially stale prices in `/collection`.

**Severity:** Low — prices are decorative and update within an hour.

---

### collection.ts — Display

**Flow verified:**
1. `userCard.findMany` with `{ include: { card: true } }` — correct join
2. `userCard.count` for total
3. Value = `SUM(quantity × marketValue)` — correct
4. Rarity breakdown from full card set — correct

**Finding: No bugs in collection display.** The command correctly reads from `user_cards` and renders the data.

---

### cardsCollected Stat vs Actual Collection

`cardsCollected` on the User row is incremented by `cards.length` (10) per pack open. It is NOT a count of unique cards — it is a total tally of cards ever received. This is intentional (tracks pack-opening activity). Actual unique card count comes from `userCard.count`.

**Potential confusion:** If a user opens 5 packs and gets duplicate cards, `cardsCollected = 50` but `userCard.count` (unique cards) may be 35 due to duplicates. This discrepancy can confuse users who compare both numbers.

**Severity:** Low — labeling fix only. No data is lost.

---

### giftpack.ts + giveawayJob.ts — Same Card Write Path

Both use the same pattern:
```ts
await client.prisma.card.upsert(...)
await client.prisma.userCard.upsert({ ..., update: { quantity: { increment: 1 } } })
```

**Finding:** Consistent with pack.ts. No divergence in card write logic.

---

## Root Cause of Reported Issue

**The pack logic is correct.** The likely cause of reported "inconsistencies":

1. **Collection display timing**: User opens pack → Discord updates are slightly delayed → user checks `/collection` immediately but the sort is `orderBy: { obtainedAt: 'desc' }` — new cards appear at top. If they scrolled past them or the embed truncated at 15 entries, they may have missed new cards.

2. **`cardsCollected` vs unique count confusion**: Users comparing "cards collected" stat vs unique cards in `/collection`.

3. **1-hour Redis cache for market values**: Prices shown in `/collection` lag 1 hour behind TCGplayer.

4. **Stale card pool (>250 cards)**: Users in sets with more than 250 cards never see later cards, which can feel like "missing" cards.

---

## Fixes Implemented in S8

None required for the core pack write path — it is correct.

**Recommended future fix (S9):**
- Paginate `searchCards` to fetch all cards in large sets (not just first 250)
- Consider labeling `cardsCollected` as "Total Cards Received" vs a separate "Unique Cards" counter

---

## Pack/Collection System Summary

| Component | Status |
|-----------|--------|
| Pack cost deduction | Atomic transaction — correct |
| Card API fetch | Correct, capped at 250/set |
| Card DB write (Card table) | Upsert — correct |
| UserCard DB write | Upsert with increment — correct |
| cardsCollected stat | Tracks total received, not unique — correct by design |
| Collection display | Correct join, correct value calculation |
| Market value freshness | 1-hour Redis cache — acceptable |
| Giftpack / Giveaway write | Identical logic — consistent |
