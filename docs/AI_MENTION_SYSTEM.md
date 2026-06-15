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

## Bug Fixed (2026-06-15)

**Root cause**: `handleMentionAI` called `client.redis.get()` without a `.catch()`. When Redis is unavailable (optional — the bot runs without it), this throws `ClientClosedError`. The outer `.catch(() => {})` in the caller swallowed the error silently — the bot appeared to not respond at all.

**Fix applied to `messageCreate.ts`**:
1. `client.redis.get(coolKey)` → `client.redis.get(coolKey).catch(() => null)` — Redis failure defaults to "no cooldown", allowing the response to proceed.
2. `client.redis.set(...)` wrapped in `.catch(() => {})` — cooldown persistence is best-effort.
3. Outer `.catch(() => {})` → `.catch((err) => client.logger?.error(...))` — errors now appear in logs.
4. `askProfessor()` `.catch()` now logs the error before returning null.

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
