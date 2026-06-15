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

### Fix 2 — Decommissioned model via GROQ_MODEL env var (confirmed S15, 2026-06-15)

**Root cause confirmed** via Railway logs (`railway logs --tail 200`):

```
[Groq] askProfessor — model=llama-3.1-70b-versatile questionLen=2
[Groq] API error — name=Error status=400 message=400 {"error":{"message":"The model
  `llama-3.1-70b-versatile` has been decommissioned and is no longer supported..."
  "code":"model_decommissioned"}}
```

The code fix in commit `674d971` updated `GROQ_MODELS[0].id` to `llama-3.3-70b-versatile` as the fallback, but the model selection logic is:
```typescript
const modelToUse = model ?? process.env.GROQ_MODEL ?? GROQ_MODELS[0].id;
```

Railway had `GROQ_MODEL=llama-3.1-70b-versatile` — this env var was checked BEFORE the updated fallback constant, overriding the fix entirely. Every API call used the decommissioned model and got HTTP 400.

**Fixes applied (S15)**:
1. **Railway env var**: `GROQ_MODEL` updated to `llama-3.3-70b-versatile` via `railway variables set`
2. **Local `.env`**: `GROQ_MODEL` updated to `llama-3.3-70b-versatile`
3. **`groqService.ts` hardening**: `process.env.GROQ_MODEL` is now validated against `GROQ_MODELS` known list before use — if the value is not in the list (e.g. a decommissioned model), it is ignored and the code default `GROQ_MODELS[0].id` is used instead. This prevents the same regression if the env var becomes stale again.

**`GROQ_MODEL` env var vs code default priority** (after fix):
- Explicit `model` param → wins
- `GROQ_MODEL` env var AND it's in `GROQ_MODELS` → used
- `GROQ_MODEL` not set OR not a known model → falls back to `GROQ_MODELS[0].id` = `llama-3.3-70b-versatile`

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
