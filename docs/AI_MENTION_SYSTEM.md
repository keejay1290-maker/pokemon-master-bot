# AI Mention System
> Last updated: 2026-06-15

---

## Overview

Users can @mention the bot in any server channel to ask Professor Oak a Pokémon question. No slash command required.

```
@PokemonBot what's the best moveset for Dragonite?
```

The bot strips the mention, sends the text to Groq (Llama 3.3 70B by default), and replies as Professor Oak in an embed.

---

## Architecture

```
Discord message → messageCreate event
  → checkAutoMod()
  → handleSpawnMessage()
  → XP gain (60s cooldown)
  → message.mentions.has(client.user)
       ↓ yes
    handleMentionAI()
      → Redis cooldown check (60s per user, fault-tolerant)
      → strip mentions from content
      → if empty → prompt embed
      → channel.sendTyping()
      → askProfessor(question)  [groqService.ts]
      → reply embed (Professor Oak, blue, avatar icon)
      → set Redis cooldown
```

### Key files

| File | Role |
|------|------|
| `src/events/messageCreate.ts` | `messageCreate` handler; mention detection; `handleMentionAI()` |
| `src/services/groqService.ts` | `askProfessor(question, model?)` Groq call; system prompt |
| `src/commands/utility/professor.ts` | `/professor ask` slash command (kept for discoverability) |

---

## Cooldown

- 60 seconds per user, stored in Redis key `mention:cd:{userId}` with TTL.
- On cooldown: silently ignored (no error message — avoids channel spam).
- If Redis is unavailable: cooldown is bypassed and the mention still responds. This is intentional — Redis is optional in this bot.

---

## /professor ask Command — Keep or Remove?

**Decision: keep it.**

| Factor | @mention | /professor ask |
|--------|----------|----------------|
| Discoverability | Low — users must know to @mention | High — shows in `/` command list |
| UX | Most natural, lowest friction | Explicit, intentional |
| Model selection | No (always uses default) | Yes — user can pick Llama 70B / 8B / Gemma |
| Works in DMs | Only if DM intents permit | Yes |
| Cooldown | 60s | 30s (framework-enforced) |

`/professor ask` is the power-user path (model choice, visible in help). @mention is the ambient "just ask" path. Both call `askProfessor()` so the AI quality is identical.

---

## Bug History

### Fix 1 — Silent Failure (commit 1feb448, 2026-06-15)

**Root cause**: `handleMentionAI` called `client.redis.get()` without a `.catch()`. When Redis is unavailable (optional — the bot runs without it), this throws `ClientClosedError`. The outer `.catch(() => {})` in the caller swallowed the error silently — the bot appeared to not respond at all.

**Fix applied to `messageCreate.ts`**:
1. `client.redis.get(coolKey)` → `client.redis.get(coolKey).catch(() => null)` — Redis failure defaults to "no cooldown", allowing the response to proceed.
2. `client.redis.set(...)` wrapped in `.catch(() => {})` — cooldown persistence is best-effort.
3. Outer `.catch(() => {})` → `.catch((err) => client.logger?.error(...))` — errors now appear in logs.
4. `askProfessor()` `.catch()` now logs the error before returning null.

**Result after this fix**: Symptom changed from silent failure to visible failure — user sees "My research terminal seems to be offline right now." This means `askProfessor()` itself is still throwing.

---

### Investigation — @mention shows "research terminal offline" (S14, 2026-06-15)

**Execution path**:
```
message @grimbot → handleMentionAI() → askProfessor()
  → getGroq() — creates Groq SDK client with GROQ_API_KEY
  → groq.chat.completions.create(model='llama-3.3-70b-versatile', ...)
  → throws exception
  → caught by .catch() in messageCreate.ts → answer = null
  → "My research terminal seems to be offline right now."
```

**Root cause candidates** (in order of likelihood):
1. `GROQ_API_KEY` not set in Railway env vars → Groq SDK throws "GROQ_API_KEY is not set in environment variables" at `getGroq()` call
2. `GROQ_API_KEY` invalid or expired → Groq API returns HTTP 401
3. Model `llama-3.3-70b-versatile` unavailable → HTTP 404 or 400
4. Rate limit → HTTP 429

**Fix applied (commit 674d971)**:
- `groqService.ts`: logs `GROQ_API_KEY` presence (boolean + key length, never value) at module load
- `groqService.ts`: throws `Error('GROQ_API_KEY is not set in environment variables')` early if key is missing
- `groqService.ts`: wraps API call in try/catch logging `err.name`, `err.status`, `err.message`
- `messageCreate.ts`: adds `console.error` to the catch block so error is guaranteed to appear in Railway logs

**How to diagnose after deploy**: Search Railway logs for `[Groq]`. You will see one of:
- `[Groq] module loaded — GROQ_API_KEY present=false` → add `GROQ_API_KEY` to Railway env vars
- `[Groq] API error — status=401` → API key is invalid, rotate it at console.groq.com
- `[Groq] API error — status=404` or model error → change `GROQ_MODEL` env var to `llama-3.1-8b-instant`
- `[Groq] response received — contentLen=N` → API is working (not expected given the symptom)

**Action required**: Check Railway logs after next `@grimbot` ping. The `[Groq]` lines will identify the exact failure.

---

## System Prompt

Defined in `src/services/groqService.ts` as `PROFESSOR_OAK_SYSTEM_PROMPT`. Key properties:

- Character: Professor Samuel Oak (inventor of Pokédex, mentor to Ash/Gary)
- Full command index (20+ commands) — prevents hallucinated command names
- Explicit domain coverage: species, battle mechanics, TCG, careers, economy
- Personality directives: "Fascinating!", academic enthusiasm, ≤500 word cap
- Anti-hallucination guard: "never hallucinate command names or game mechanics"

See `docs/PROFESSOR_OAK_AI_AUDIT.md` for the full prompt rationale and model history.

---

## Groq Models

| Model | ID | Default |
|-------|----|---------|
| Llama 3.3 70B | `llama-3.3-70b-versatile` | Yes |
| Llama 3.1 8B | `llama-3.1-8b-instant` | No |
| Gemma 2 9B | `gemma2-9b-it` | No |

Override default via `GROQ_MODEL` env var. @mention always uses the default. `/professor ask` exposes model selection to the user.

---

## Required Environment Variables

| Var | Purpose |
|-----|---------|
| `GROQ_API_KEY` | Groq API key — required for all AI responses |
| `GROQ_MODEL` | Optional default model override |

If `GROQ_API_KEY` is missing or invalid, the bot replies with a "research terminal offline" message and logs the error.

---

## Future Improvements (from PROFESSOR_OAK_AI_AUDIT.md)

- **Context injection**: pass user's trainer level + top Pokémon to the prompt for personalized advice
- **Conversation history**: cache last 2 turns per user in Redis (5-min TTL) so Oak remembers context
- **Structured response format**: system directive to always end with one actionable suggestion (e.g. "Try `/daily` to start your coin streak!")
