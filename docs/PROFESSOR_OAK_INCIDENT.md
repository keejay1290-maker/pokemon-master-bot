# Professor Oak Incident Report
> Date: 2026-06-14 | Session S8 | Status: RESOLVED

---

## User Report

> "Professor Oak is busy" on every attempt.

Users reported that `/professor ask` always returned a "busy" cooldown message regardless of how long they waited.

---

## Investigation

### Files Audited

| File | Relevance |
|------|-----------|
| `src/commands/utility/professor.ts` | Command entry point |
| `src/events/interactionCreate.ts` | Framework cooldown handler |
| `src/utils/cooldown.ts` | Redis cooldown utility |
| `src/services/groqService.ts` | Groq API integration |

### Redis Lock / Session Tracking

No custom Redis session locks existed. No "active session" tracking. No indefinite hold mechanism.

### Cooldown System Architecture

The bot uses a two-layer system:
1. **Framework-level**: `interactionCreate.ts` checks `command.cooldown` (if set) before calling `execute()`. It sets the Redis key using `setCooldown(userId, commandName, cooldown)` **before** `execute()` is called.
2. **Manual in-command**: Some commands call `checkCooldown`/`setCooldown` themselves inside `execute()`.

### Root Cause — Double Cooldown

`professor.ts` had `cooldown: 10` on the Command object **AND** a manual `checkCooldown` call inside `execute()`.

Execution order in `interactionCreate.ts`:
```
1. command.cooldown = 10 → framework calls checkCooldown('professor', 10)
   → No key found (first use) → passes check
2. Framework calls setCooldown(userId, 'professor', 10)
   → Redis: cooldown:{userId}:professor = expiresAt(now + 10s), TTL=10s
3. Framework calls command.execute(interaction, client)
   → execute() immediately calls checkCooldown(userId, 'professor', 15)
   → Redis key EXISTS (set by framework 0ms ago, expiresAt = now+10s)
   → remaining = ~10s > 0
   → Returns { onCooldown: true, remaining: ~10 }
4. execute() replies: "⏰ Professor Oak is busy! Try again in 10s."
```

**Every invocation** followed this path because the framework always set the key before execute() ran. The manual check inside execute() was comparing against the key set by the framework — not a prior Professor Oak session.

### Secondary Issue: Deprecated Groq Models

`GROQ_MODELS` contained:
- `llama-3.1-70b-versatile` — deprecated by Groq (replaced by 3.3-70b)
- `mixtral-8x7b-32768` — deprecated by Groq (January 2025)

If a user selected a deprecated model, Groq returned a 400/404 error. The `.catch()` handler returned `'Professor Oak is currently unavailable...'` — the error was **silently swallowed** with no log entry or meaningful user feedback.

### Fallback Handling Pre-Fix

The existing fallback was:
```ts
const answer = await askProfessor(...).catch(() => 'Professor Oak is currently unavailable...');
```

This swallowed all errors — API key issues, network failures, model deprecation — with identical output and no logging. Users and admins had no way to distinguish transient from permanent failures.

---

## Fix Applied

### professor.ts

1. **Removed** the manual `checkCooldown` / `setCooldown` calls from inside `execute()`. The framework (`interactionCreate.ts`) already handles cooldowns via `command.cooldown`. The internal check was redundant and caused the double-fire.
2. **Increased** `command.cooldown` from 10 to **30 seconds** — appropriate for an AI endpoint that takes 1–3s per call.
3. **Improved fallback**: The `.catch()` now logs the error via `client.logger.error` and sends a themed embed explaining the issue, rather than a silent string return.

### groqService.ts

1. **Replaced deprecated models**:
   - `llama-3.1-70b-versatile` → `llama-3.3-70b-versatile`
   - Removed `mixtral-8x7b-32768` (deprecated Jan 2025)
2. **Updated GROQ_MODELS** to export `{ id, label }` objects for better display in Discord autocomplete.
3. **Rewrote system prompt** — see `PROFESSOR_OAK_AI_AUDIT.md` for full details.

---

## Files Changed

| File | Change |
|------|--------|
| `src/commands/utility/professor.ts` | Removed duplicate cooldown; better fallback; updated model reference |
| `src/services/groqService.ts` | Updated model list; rewrote system prompt; updated exports |

---

## Verification

After fix:
- First invocation: framework sets 30s cooldown → execute() runs without any internal cooldown check → Groq API called → answer displayed.
- Within 30s: framework check fires, returns generic "Please wait Xs before using /professor again." (from `errorEmbed`) — user is told to wait.
- After 30s: next invocation succeeds.
- Groq failure: logged + user sees explanatory embed. No lockout.

---

## Lessons Learned

1. **Never add manual cooldown checks inside execute() when `command.cooldown` is set.** The framework sets the key before execute() runs, so any internal check sees the framework's key and reports a false positive.
2. **Always log AI API errors** — silent catches hide real issues from admins.
3. **Verify model names against Groq's active model list** before shipping.
