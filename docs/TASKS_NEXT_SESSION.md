# Tasks — Next Session (S8)
> Updated: 2026-06-14 (S7 wrap-up)
> Bot: 58 commands, live on Railway, tsc clean
> Commit: 9b7ee88
> Start by reading: `docs/SESSION_HANDOFF_S7.md`

---

## P0 — Production Issues

None known.

---

## P1 — High Value (Must Ship)

### 1. UserInventory table + /buy persistence
**Why**: `/buy` deducts coins but no item is stored. Shiny Charm, Amulet Coin, Repel — all purchased items have zero effect. Users are paying coins for nothing.
**Effort**: 2h
**Steps**:
1. Add `UserInventory` model to `prisma/schema.prisma` (userId, itemName, quantity, createdAt)
2. `npx prisma migrate dev --name add_user_inventory`
3. Update `/buy` to `upsert` UserInventory row after deducting coins
4. Apply Shiny Charm: in `spawnService.selectRandomPokemon`, check `userInventory where itemName='shiny_charm'` — if owned, set `isShiny` roll to `shinyRate × 3`
5. Apply Amulet Coin: in work/career commands, check inventory → double coins if owned
6. Add `/inventory` command or tab in `/profile`

### 2. Evolution command
**Why**: `Pokemon.evolutionLevel` and `evolvesFromId` exist in schema. Every mainline competitor has evolution. Expected feature.
**Effort**: 2h
**File**: `src/commands/pokemon/evolve.ts` (new)
**Logic**:
- Find user's Pokémon by ID
- Check `pokemon.evolvesFromId` — if this pokemon has an evolution (`pokemon.evolvesInto[0]`)
- Check level condition: `userPokemon.level >= evolution.evolutionLevel`
- Update `userPokemon.pokemonId` to evolution's ID
- Show before/after embed with artwork, stats comparison
- Grant 100 XP on evolve

### 3. TCG Phase 2 — Set Completion
**Why**: Key collector milestone. Pokétwo equivalent is very popular.
**Effort**: 3h
**Files**: `src/commands/cards/sets.ts` (new), `src/commands/cards/setinfo.ts` (new)
**Logic**:
- `/sets` — list all TCG sets, show user's completion % (cards owned / total in set)
- `/setinfo <set>` — show all cards in set, mark owned vs missing
- On pack open: check if user now owns all cards in set → create `UserAchievement` for `SET_COMPLETE:{setId}`

---

## P2 — Medium Value

### 4. Quest completion notification
**Why**: When a quest completes, users get coins/XP silently with no feedback.
**Effort**: 1h
**File**: `src/services/questService.ts`
**Logic**: `incrementQuestProgress` returns a list of completed quest names. Callers pass `channelId` to post a completion embed. Or: DM the user.

### 5. /quests history subcommand
**Why**: `/quests` only shows incomplete quests. Users can't see what they've completed.
**Effort**: 30 min
**File**: `src/commands/social/quests.ts`
**Logic**: Add `history` subcommand — `UserQuest.findMany({ where: { userId, completed: true } })` with rewards shown

### 6. Rank-up public announcement
**Why**: `addXp()` returns `{ leveledUp }` but no message is posted when trainer title changes.
**Effort**: 1h
**File**: `src/services/userService.ts addXp()` — accept optional `channelId`, post embed when `getTrainerTitle(newLevel) !== getTrainerTitle(oldLevel)`

### 7. Trainer title on /leaderboard
**Why**: Leaderboard shows level only. Title adds personality.
**Effort**: 15 min
**File**: `src/commands/social/leaderboard.ts`
**Change**: Add `getTrainerTitle(user.trainerLevel)` next to username in embed fields

### 8. Outbid DM notification
**Why**: Outbid users get no notification and may miss the auction end.
**Effort**: 1h
**File**: `src/commands/economy/auction.ts` bid subcommand
**Logic**: Find previous highest bidder from `bids` JSON array → DM: "You were outbid on [item]!"

---

## P3 — Polish

### 9. Market ownership validation
**Why**: Users can list Pokémon/cards they don't own (itemData is free text).
**File**: `src/commands/economy/market.ts` handleList()
**Logic**: Require `pokemonId` or `cardId` param, validate ownership before listing

### 10. /daily typo fix
**File**: `src/commands/economy/daily.ts` line 10
**Change**: `'Claim your daily PokeCoin reward'` → `'Claim your daily PokéCoin reward'`

---

## P4 — Future (Confirm Before Starting)

- **Gym System** — 8 gym configs, badge system, gym leader roles — S9+
- **Silhouette spawns** — messageCreate shows silhouette image, users guess name — S8 option
- **Deck Builder (TCG Phase 5)** — needs Deck + DeckCard tables — S9+
- **PokéPass** (battle pass) — 40-tier seasonal progression — S9+

---

## Arch Reminders

- `addXp(prisma, userId, N)` — never direct `trainerXp: { increment: N }`
- `transferBalance` throws `'INSUFFICIENT_FUNDS'` — always catch
- `checkAndAwardAchievements(client, userId, channelId?, guildId?)` — after any stat increment
- `incrementQuestProgress(prisma, userId, type, amount)` — after catch/battle/daily/pack
- Commands auto-register on bot startup — file in `src/commands/` = live command
- **After adding commands**: always run `npm run deploy:commands` to register with Discord

## DO NOT Do in S8

- Do not implement PokéPass
- Do not implement Gym system
- Do not touch `C:\Users\Shadow\Downloads\dank-bot`
