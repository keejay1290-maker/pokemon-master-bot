# S6 Pokemon Competitor Research
Date: 2026-06-14 | Session S6

---

## Bots Researched

### Pokétwo (most popular Pokemon Discord bot)
- Catching via message (type the Pokemon name) — not button click
- Silhouette spawns (10% of spawns show only outline)
- Dex completion tracking per trainer
- Pokémon favoring/releasing
- Trade offers (multi-Pokémon trades with coin add-ons)
- Shadow Pokémon events
- Market with actual Pokémon (ownership validated)
- Fishing minigame
- Time-gated events (Halloween spawns, etc.)

### Pokecord (discontinued but foundational)
- First to introduce: daily, weekly, catch-by-name, IV system, evolving
- Market + trading established the economy model all bots follow

### Karuta
- Card-dropping (image-based) — not Pokémon themed but card-catching
- Frame system (cosmetic cards)
- Wishlist system
- Card burning for currency

### PokeBot (various clones)
- Gym system with badge collection
- Egg hatching timer
- Nature-based stat modifiers

---

## Feature Gap Analysis vs This Bot

| Feature | Pokétwo | This Bot | Gap |
|---------|---------|----------|-----|
| Name-to-catch spawns | ✅ | ❌ | Silhouette/text-catch variant |
| Pokémon releasing | ✅ | ✅ NEW S6 | Closed |
| Nicknames | ✅ | ✅ NEW S6 | Closed |
| IV display | ✅ | ✅ NEW S6 | Closed |
| Evolution | ✅ | ❌ | Schema ready, no command |
| Dex completion rewards | ✅ | ❌ | pokemonCaught tracked, milestones not rewarded |
| Nature effects in battle | ✅ | ❌ | Natures stored, not applied |
| Market ownership validation | ✅ | ❌ | itemData is free text |
| Trade multi-Pokémon + coins | ✅ | Partial (1 Pokémon) | Single-Pokemon trade only |
| Event spawns (seasonal) | ✅ | Partial (event framework exists) | Seasonal Pokémon not configured |
| Shiny charm item effect | ✅ | ❌ | Item exists in shop but no effect |

---

## Pokémon-First Feature Translations

### High Value — Implement in S7

1. **Pokédex Completion Milestones** (from Pokétwo)
   - On catch, check `user.pokemonCaught` milestones: 10, 25, 50, 100, 250, 500
   - Award PokéCoins + achievement unlock at each milestone
   - File: `src/services/spawnService.ts` after pokemonCaught increment
   - Already tracked in DB: `User.pokemonCaught`

2. **Silhouette Spawn Variant** (from Pokétwo)
   - 15% of spawns show a silhouette embed instead of artwork
   - No button — first user to send the correct Pokémon name in chat claims it
   - Creates memorable moments and chat engagement
   - Redis lock prevents double-claim
   - Files: spawnService.ts + messageCreate handler

3. **Evolution Command** (from Pokécord)
   - `evolutionLevel` and `evolvesFromId` already in schema
   - `/evolve <id>` — checks conditions, updates pokemonId, shows before/after
   - File: `src/commands/pokemon/evolve.ts` (new)

4. **Nature Stat Modifiers** (from every mainline game)
   - 25 natures × +10%/-10% on 2 stats
   - Already stored: `UserPokemon.nature`
   - File: `src/utils/pokemon.ts calcPokemonStats()` — add NATURE_MODIFIERS map
   - 30-minute fix that makes battle feel authentic

### Medium Value — S7/S8

5. **Shiny Charm Effect** (from Pokétwo/games)
   - `/buy shiny-charm` exists but has no effect on spawn rates
   - Apply 1.5× shiny rate multiplier when user has Shiny Charm in inventory
   - Requires UserInventory table first

6. **Multi-Pokémon Trade** (from Pokétwo)
   - Current trade: 1 Pokémon each
   - Extend: up to 3 Pokémon per side + coin sweetener
   - Schema already has TradePokemon for multi-Pokémon, just needs UI

7. **Quest Progress Wiring** (internal gap)
   - Quests display only; no progress tracking
   - `UserQuest.progress` never increments
   - High UX impact — makes daily quests feel hollow without it

---

## Differentiation Opportunities (vs Pokétwo)

| Angle | This Bot Advantage |
|-------|-------------------|
| Career system | Pokétwo has no career/job system — unique to this bot |
| TCG integration | Real TCG card prices + collection value — not in Pokétwo |
| Team Rocket career | Pokétwo has no villain-path career progression |
| Auction house | Pokétwo uses fixed-price market only |
| Professor AI | Groq-powered AI professor — unique feature |

This bot should lean into careers, TCG, and Rocket operative as differentiators.
