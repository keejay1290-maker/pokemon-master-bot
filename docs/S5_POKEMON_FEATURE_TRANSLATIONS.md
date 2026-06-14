# S5 Pokémon Feature Translations
Date: 2026-06-14 | Session: S5

> Translating concepts from competitor bots and Pokémon games into implementable bot features.
> Items marked ⚡ are already partially in the schema and could be activated with minimal work.

---

## From Pokétwo / Pokecord

### 1. Name-to-Catch → Pokémon Name Quiz
**Source**: Pokétwo's silhouette challenge (name the Pokémon to catch)
**Translation**: Show a silhouette image in the spawn embed. First trainer to type the correct name in chat catches it.
**Status**: Not implemented
**Effort**: Medium (messageCreate listener, Redis lock)
**Priority**: P2 — high engagement, nostalgia factor

---

### 2. Pokémon Release → Salvage System
**Source**: Pokétwo's /release for unwanted Pokémon
**Translation**: `/release <pokemon_id>` — user releases a Pokémon and receives coins (50–500 based on rarity) + 5 XP
**Status**: Schema ready (`UserPokemon` delete)
**Effort**: Low (30 min)
**Priority**: P1 — users with full boxes need this

---

### 3. Pokémon Duel → Challenge System
**Source**: Pokecord trainer battles
**Translation**: `/challenge @user` — both parties confirm, bot runs auto-battle using team Pokémon
**Status**: Battle system exists; challenge command exists
**Effort**: Low-medium (wire challenge into existing battle flow)
**Priority**: P1

---

### 4. Evolution → Evolve Command
**Source**: Core Pokémon games
**Translation**: `/evolve <pokemon_id>` — if Pokémon level ≥ evolutionLevel AND user has evolutionItem, evolve to next form
**Status**: Schema ready (`evolvesFromId`, `evolutionLevel`, `evolutionItem`)
**Effort**: Medium (1–2h, need evolution table data)
**Priority**: P2 — massive progression engagement

---

### 5. Pokémon Rename → Nickname Command
**Source**: Pokétwo `/nickname`
**Translation**: `/nickname <pokemon_id> <name>` — set Pokémon nickname (max 20 chars, shown in /box)
**Status**: `UserPokemon.nickname` field exists in schema
**Effort**: Low (20 min)
**Priority**: P1 — users want to personalize

---

### 6. Nature Effects → Battle Stat Multipliers
**Source**: Core Pokémon games
**Translation**: Apply nature stat modifiers (+10%/-10%) when calculating battle stats via `calcPokemonStats()`
**Status**: Nature stored, `calcPokemonStats()` exists in `utils/pokemon.ts`
**Effort**: Low (add nature multiplier map, apply in function)
**Priority**: P2

---

## From Dank Memer

### 7. Item Inventory → Held Item System
**Source**: Dank Memer's item inventory
**Translation**: When user buys an item via `/buy`, record it in a `UserInventory` table. Items like Amulet Coin and Shiny Charm take effect passively.
**Status**: `/buy` deducts coins but doesn't store items anywhere (gap)
**Effort**: Medium — new table + passive effect hooks
**Priority**: P2

---

### 8. Passive Item Effects
**Source**: Dank Memer — Amulet Coin doubles earnings
**Translation**:
- Amulet Coin: double `/work` reward
- Shiny Charm: increase shiny rate in spawns
- Repel: suppress spawns for 30 min
- Coin Case: +100 daily reward
**Status**: Items sold via `/buy` but effects not implemented
**Effort**: Medium per item
**Priority**: P2

---

### 9. Heist / Group Rob → Raid Event
**Source**: Dank Memer's heist
**Translation**: `/raid start` — 5-player event to steal from a "Pokémon Base". All participants get coins, risk losing some. Uses existing event infrastructure.
**Status**: Not implemented
**Effort**: High (new event type)
**Priority**: P4

---

## From Pokémon Games

### 10. EV Training → Career Stat Boosts
**Source**: Core Pokémon EV system
**Translation**: Career work grants EV to Pokémon on active team (Fishing → Speed EVs, Miner → Defense EVs, etc.)
**Status**: EV columns exist in schema
**Effort**: Medium (wire career output to active team EVs)
**Priority**: P3

---

### 11. Pokémon Day Care → Breeder Egg System
**Source**: Day Care in Pokémon games
**Translation**: Two compatible Pokémon in Day Care → egg after N breeder sessions → hatch with parent IVs
**Status**: Career `/breeder` exists. Egg hatching not implemented.
**Effort**: High
**Priority**: P4

---

### 12. Gym System → Gym Challenge Events
**Source**: Pokémon gyms
**Translation**: `/gym challenge <gym>` — server has 8 gyms. Beat the gym's bot-trainer to earn badge. Badges unlock perks (higher spawn rates, better shop prices).
**Status**: `gymChallengesChannelId` in Guild schema
**Effort**: Very High (8 gym trainers, badge system, perk application)
**Priority**: P5

---

### 13. Pokédex Completion Rewards
**Source**: Core Pokémon games
**Translation**: At 50%, 75%, 100% Pokédex completion, grant achievement + coins + title
**Status**: Pokédex tracking exists (`pokemonCaught`, `User.pokemon`)
**Effort**: Low (achievement check on catch)
**Priority**: P2

---

## From Karuta / TCG Bots

### 14. Card Collection Value → /collection value
**Source**: Karuta's market value sum
**Translation**: `/collection value` — sum all `card.marketValue * userCard.quantity` for user's collection
**Status**: `Card.marketValue` now persisted (S4). `UserCard.quantity` tracked.
**Effort**: Low (30 min aggregation query)
**Priority**: P1

---

### 15. Card Trading → /card trade
**Source**: Karuta's drop trading
**Translation**: Extend `/trade` to support card IDs in addition to Pokémon IDs
**Status**: `/trade` handles Pokémon only; `UserCard` schema ready
**Effort**: Medium (extend trade command)
**Priority**: P3

---

## Priority Summary

| Priority | Feature | Effort |
|----------|---------|--------|
| P1 | /release | Low |
| P1 | /nickname | Low |
| P1 | /collection value | Low |
| P2 | Name-to-catch silhouette | Medium |
| P2 | Evolution via /evolve | Medium |
| P2 | Nature effects in battles | Low |
| P2 | Item inventory + passive effects | Medium |
| P2 | Pokédex completion rewards | Low |
| P3 | EV training via careers | Medium |
| P3 | Card trading | Medium |
| P4 | Group raid event | High |
| P4 | Egg hatching via breeder | High |
| P5 | Gym system | Very High |
