# Professor Oak AI Audit
> Date: 2026-06-14 | Session S8

---

## Current System Prompt (Pre-S8)

```
You are Professor Oak, the world's leading Pokemon researcher and expert. 
You have encyclopedic knowledge of all Pokemon, their types, abilities, moves, evolutions, locations, 
lore, competitive strategies, and the Pokemon Trading Card Game. You give helpful, accurate, and 
enthusiastic advice about Pokemon. Keep responses concise (under 500 words) but informative. 
Use Pokemon-themed language and show genuine excitement about Pokemon research!
```

---

## Weaknesses Identified

| # | Weakness | Impact |
|---|---------|--------|
| 1 | No character grounding — just says "you are Professor Oak" with zero personality anchors | Generic, robotic responses that don't feel like Oak |
| 2 | No bot-specific command knowledge | Oak gave advice that didn't match actual commands (hallucinated `/pokemart`, `/research`, etc.) |
| 3 | No economy/career/TCG system context | Could not accurately explain how the in-game economy works |
| 4 | No progression knowledge | Couldn't explain trainer levels, titles, quests, or achievements accurately |
| 5 | No "do not hallucinate commands" guard | Freely invented command names |
| 6 | Generic catch-all scope ("all Pokémon") without specificity | Responses felt like Bulbapedia summaries, not mentor advice |
| 7 | No mention of the bot's specific systems | TCG packs, giveaways, auctions, careers all unknown to Oak |

---

## Recommended System Prompt (Implemented in S8)

See `src/services/groqService.ts` for the full prompt. Key additions:

### 1. Character Anchors

```
You are Professor Samuel Oak — inventor of the Pokédex, mentor to Ash Ketchum and Gary Oak.
```
Grounds Oak as a specific, recognizable character with history and relationships.

### 2. Explicit Domain Coverage

```
Your areas of expertise:
- All 1000+ Pokémon species: types, base stats, abilities, natures, held items, movesets
- Evolution chains: level requirements, item evolutions, friendship, trade, special conditions
- Battle mechanics: type matchups, STAB, weather effects, terrain, priority moves
- Trainer progression: catching, EV/IV training, competitive battling, team building
- Pokémon TCG: sets, card rarities, market values, pack contents, collection strategies
- In-game economy: PokéCoins, daily rewards, work shifts, fishing, hunting, crafting careers
- Pokédex completion: rare Pokémon, shiny hunting, legendary encounters
- Careers: Fisher, Researcher, Ranger, Breeder, Miner, Rocket
```

### 3. Bot Command Index (Anti-Hallucination)

Full list of 20+ actual commands with descriptions. Oak now gives accurate command names instead of inventing them.

### 4. Personality Guidelines

```
- Speak with academic enthusiasm and genuine wonder
- Use phrases like "Fascinating!", "My research shows...", "Remarkable!"
- Be encouraging to trainers of all skill levels
- Give practical, accurate advice — never hallucinate command names or game mechanics
- Keep responses under 500 words but make them genuinely helpful
- Occasionally reference Gary or Ash for relatable context
```

### 5. System Integrity Guard

```
Give practical, accurate advice — never hallucinate command names or game mechanics.
```

---

## Implementation Recommendations

### Done in S8

- [x] Rewrote system prompt with character anchors + domain coverage + command index
- [x] Updated GROQ_MODELS: removed deprecated `mixtral-8x7b-32768` and `llama-3.1-70b-versatile`; added `llama-3.3-70b-versatile` as default
- [x] GROQ_MODELS now exports `{ id, label }` objects so Discord autocomplete shows friendly names

### Recommended for S9

- [ ] **Context injection**: Pass user's trainer level + top Pokémon to the prompt so Oak can give personalized advice ("At Level 12, Youngster, you should focus on catching more Pokémon before battling...")
- [ ] **Conversation history**: Cache last 2 turns per user in Redis (5-min TTL) so Oak remembers context within a session
- [ ] **Structured response format**: Add system directive for Oak to always end responses with one actionable suggestion ("Try `/daily` right now to start your coin streak!")

---

## Model Notes

| Model | Status | Notes |
|-------|--------|-------|
| `llama-3.3-70b-versatile` | Active (default) | Best quality, 70B params, Groq-hosted |
| `llama-3.1-8b-instant` | Active | Fast, lower quality — good for simple queries |
| `gemma2-9b-it` | Active | Google model, alternative personality |
| `llama-3.1-70b-versatile` | **Deprecated** | Removed — Groq retired this model |
| `mixtral-8x7b-32768` | **Deprecated** | Removed — Groq retired Jan 2025 |

Model override via `GROQ_MODEL` env var is still supported. If the env var is set to a deprecated model, it will fail at the API level; the fallback embed will display.
