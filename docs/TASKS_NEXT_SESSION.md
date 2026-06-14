# Tasks — Next Session (S7)
> Updated: 2026-06-14 (S6 wrap-up)
> Bot: 57 commands, live on Railway, tsc clean
> Start by reading: `docs/SESSION_HANDOFF_S6.md`

---

## P0 — Production Issues

None known. Bot is live and stable.

---

## P1 — High Value (Quick Wins)

### 1. Quest progress tracking
**Why**: /quests shows quests but UserQuest.progress never increments. Users see quests that can never complete.
**Effort**: 2h
**File**: Create `src/services/questService.ts`
**Logic**: `incrementQuestProgress(prisma, userId, type: QuestType, amount)` — update UserQuest.progress, check if >= requirement, complete and grant xpReward + coinReward. Call from: catch, battle win, /daily, /trade, /pack.

---

### 2. Pokédex completion milestones
**Why**: `User.pokemonCaught` is tracked but milestones are never rewarded. Pokétwo does this, it's expected.
**Effort**: 30 min
**File**: `src/services/spawnService.ts`
**Logic**: After `pokemonCaught: { increment: 1 }`, check milestones (10, 25, 50, 100, 250, 500) → grant coins + call checkAndAwardAchievements. Add these as Achievement seeds if not already seeded.

---

### 3. Evolution command
**Why**: `evolutionLevel` and `evolvesFromId` exist on schema but no /evolve command.
**Effort**: 2h
**File**: `src/commands/pokemon/evolve.ts` (new)
**Logic**: Find UserPokemon → check pokemon.evolvesFromId (chain) + evolutionLevel condition → update pokemonId to evolution → show before/after embed with art

---

### 4. Nature stat modifiers in battle
**Why**: Every mainline Pokemon game applies natures. Currently stored but never used in battle.
**Effort**: 30 min
**File**: `src/utils/pokemon.ts calcPokemonStats()`
**Logic**: Add `NATURE_MODIFIERS` map (25 natures). Each nature: +10% on one stat, -10% on another (Hardy/Docile/Serious/Bashful/Quirky are neutral). Apply in calcPokemonStats after base stat calc.

---

## P2 — Medium Value

### 5. Outbid DM notification
**Why**: When a user is outbid, they get no notification. They may not check back before auction ends.
**Effort**: 1h
**File**: `src/commands/economy/auction.ts` bid subcommand
**Logic**: When new bid arrives, find previous highest bidder from bids array → `client.users.fetch(prevBidder.userId)` → DM: "You were outbid on [item]! New bid: X PokéCoins."

---

### 6. Market listing ownership validation
**Why**: Users can list Pokémon/cards they don't own (itemData.name is free text).
**Effort**: 1h
**File**: `src/commands/economy/market.ts` handleList()
**Logic**: When type='pokemon': `prisma.userPokemon.findFirst({ where: { userId, id: itemData.pokemonId } })`. When type='card': `prisma.userCard.findFirst({ where: { userId, cardId: itemData.cardId } })`. Require IDs instead of free text.

---

### 7. UserInventory table + /buy persistence
**Why**: `/buy` deducts coins but no item is stored. Shiny Charm, Amulet Coin, etc. have no effect.
**Effort**: 1.5h (schema + buy wiring + inventory display)
**Steps**: Add `UserInventory` model (userId, itemName, quantity) → `npx prisma migrate dev` → update `/buy` to upsert UserInventory → add `/inventory` command or add to /profile → apply Shiny Charm effect in spawnService

---

### 8. TCG Set completion tracking (Phase 2)
**Why**: Key TCG milestone — completing a full card set should reward the trainer.
**Effort**: 4h
**Files**: New `src/commands/cards/sets.ts` + `src/commands/cards/set.ts`
**Logic**: `/sets` — list all TCG sets with user completion %. `/set <id>` — shows cards in set, marks owned/missing. On /pack open, check if user now owns all cards in set → create Achievement `SET_COMPLETE:{set_id}`.

---

## P3 — Polish

### 9. /daily typo fix
**File**: `src/commands/economy/daily.ts` line 4 (description)
**Change**: "Claim your daily PokeCoin reward" → "Claim your daily PokéCoin reward"
**Effort**: 2 min

### 10. Trainer title on /leaderboard
**File**: `src/commands/social/leaderboard.ts`
**Change**: Add `getTrainerTitle(user.trainerLevel)` next to username in embed
**Effort**: 15 min

### 11. Rank-up public announcement
**File**: `src/services/userService.ts addXp()` + new `src/utils/rankAnnounce.ts`
**Logic**: addXp() already returns `{ leveledUp }`. If `getTrainerTitle(newLevel) !== getTrainerTitle(oldLevel)`, post channel embed via `guild.systemChannelId` or config channel. Needs channelId passed to addXp callers.
**Effort**: 1.5h

---

## P4 — Future Systems (Do NOT start without user confirmation)

- **PokéPass** (battle pass) — needs 3+ tables + seasonal timer — S8+
- **Gym system** — needs 8 gym configs, badge system — S9+
- **Silhouette spawns** — messageCreate handler + Redis lock — S7 option if time allows
- **Deck builder** (TCG Phase 5) — needs Deck table — S8+

---

## Arch Reminders

- **Never `trainerXp: { increment: N }` directly** — always `addXp(prisma, userId, N)`
- **transferBalance** throws 'INSUFFICIENT_FUNDS' — always catch
- **Commands auto-register** — file in src/commands/ = registered slash command
- **Redis cooldown keys**: `cooldown:{userId}:{key}` — use checkCooldown()/setCooldown()
- **checkAndAwardAchievements** — call after any stat increment (pokemonCaught, battlesWon, etc.)

## Do NOT Do in S7

- Do not implement PokéPass
- Do not implement Gym system
- Do not touch `C:\Users\Shadow\Downloads\dank-bot`
