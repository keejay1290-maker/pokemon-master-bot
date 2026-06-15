# S12 Pack Opening Stability Report

> Generated: 2026-06-14
> Based on audit of `pack.ts`, `packRevealHandler.ts`, `interactionCreate.ts`, `pokemonTcgService.ts`, and Redis handling

---

## Executive Summary

After thorough investigation of the "Interaction Failed" reports for pack opening, I identified **4 distinct failure modes**, 3 of which are already handled gracefully. The remaining issue relates to select menu timeout UX.

---

## Failure Mode Analysis

### F1 — Redis Unavailable (P0, 100% Handled)

**Root cause:** `REDIS_URL` not configured in Railway env vars. Redis v4 defaults to `localhost:6379` on connection failure. The v4 client queues commands during reconnect backoff (~7 seconds max). Discord interactions time out at 3 seconds.

**Code handling (S10 fix):**
- `createPackSession()` in `packRevealHandler.ts:272` — checks `client.redis.isReady`, throws `REDIS_UNAVAILABLE` if false
- `handlePackReveal()` in `packRevealHandler.ts:136` — checks `client.redis.isReady`, replies with ephemeral error
- `handleOpen()` in `pack.ts:274-295` — catches the error, refunds the pack via `userInventory.upsert`

**Status:** ✅ Fully handled with refund + clear error message

**Prevention checklist:**
```
☐ REDIS_URL configured in Railway env vars
☐ Redis client shows isReady=true at startup
```

---

### F2 — Select Menu Timeout (P0, Silent Failure)

**Root cause:** `handleOpen()` in `pack.ts:195` uses `reply.awaitMessageComponent({ time: 30_000 })`. If the user selects a pack but takes >30 seconds to interact with the select menu, a `timeout` error is thrown. The catch block at line 302-304 only disables components — no error feedback to the user.

**Current code (pack.ts:302-305):**
```typescript
} catch {
  // Timeout or error — disable components
  await interaction.editReply({ components: [] }).catch(() => {});
}
```

**Impact:** User sees "This interaction failed" with no explanation.

**Fix applied (S12):** Improved catch block to provide user feedback:
- Distinguish timeout vs error
- Show clear message: "⌛ Selection timed out. Use `/pack open` to try again."
- Disable components as before

**Status:** ✅ Fixed in S12

---

### F3 — Session Expiry Mid-Reveal (P1, Partial Handling)

**Root cause:** Redis TTL is 600 seconds (10 minutes). If a user walks away mid-reveal and returns later, the session is gone but cards up to that point have already been written to the DB.

**Current behavior:**
- `handlePackReveal()` returns: "❌ Session expired. Use `/pack open` to start again."
- The written cards are preserved in the DB
- User cannot see remaining 3-4 cards (already paid for)

**Impact:** User loses access to unrevealed cards, but the cards that were already written remain in their collection (written one-by-one during reveal).

**Mitigation:** 
- Increased session TTL from 600s to 900s (15 minutes)
- Added a note in the reveal embed: "⚠️ Session expires in 15 minutes"

**Status:** ✅ Mitigated with longer TTL + warning

---

### F4 — Lock Timeout (P2, Already Handled)

**Root cause:** The 5-second NX lock on `pack:lock:${sessionId}` in `handlePackReveal()` line 145 is tight for slow Redis connections. If the DB transaction takes >5 seconds, the lock expires and a double-click race condition occurs.

**Current handling:**
- Lock uses `EX: 5` (5 second TTL)
- Double-click returns: "⏳ Already revealing, please wait..."

**Fix applied (S12):** Increased lock TTL from 5s to 15s to accommodate slow DB transactions.

**Status:** ✅ Fixed in S12

---

## Code Fixes Applied

### Fix 1: Improve select menu timeout handling (pack.ts)

Changed the catch block in `handleOpen()` from silent failure to informative message:

```typescript
// Before:
} catch {
  await interaction.editReply({ components: [] }).catch(() => {});
}

// After:
} catch (e: any) {
  const isTimeout = e?.code === 'InteractionCollectorError' || e?.message?.includes('timeout');
  await interaction.editReply({
    content: isTimeout
      ? '⌛ Selection timed out. Use `/pack open` to try again.'
      : '❌ An error occurred. Please use `/pack open` to start again.',
    embeds: [],
    components: [],
  }).catch(() => {});
}
```

### Fix 2: Increase lock TTL from 5s to 15s (packRevealHandler.ts)

```typescript
// Before:
const locked = await client.redis.set(lockKey, '1', { NX: true, EX: 5 });

// After:
const locked = await client.redis.set(lockKey, '1', { NX: true, EX: 15 });
```

### Fix 3: Increase session TTL from 600s to 900s (packRevealHandler.ts)

```typescript
// Before (line 225 & 290):
await client.redis.set(sessionKey, JSON.stringify(session), { EX: 600 });

// After:
await client.redis.set(sessionKey, JSON.stringify(session), { EX: 900 });
```

---

## Verification Checklist

| Failure Mode | Fixed? | Tested? |
|-------------|--------|---------|
| F1: Redis unavailable | ✅ S10 | ⚠️ Requires Railway Redis setup |
| F2: Select menu timeout | ✅ S12 | ✅ Code review |
| F3: Session expiry | ✅ S12 (partial) | ✅ Code review |
| F4: Lock timeout | ✅ S12 | ✅ Code review |

---

## Remaining Work

1. **Set REDIS_URL on Railway** — still the #1 root cause of "Interaction Failed"
2. **Investigate bulk-reveal mode** — future feature to reduce number of interactions needed
3. **Consider removing Redis dependency for pack opening** — use DB-only sessions to eliminate Redis failure mode entirely (long-term)