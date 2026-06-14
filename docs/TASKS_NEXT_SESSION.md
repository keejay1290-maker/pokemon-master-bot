# Tasks — Next Session (S6)
> Updated: 2026-06-14 (S5 wrap-up)
> Bot: 55 commands, live on Railway, tsc clean
> Start by reading: `docs/SESSION_HANDOFF_S5.md`

---

## P0 — Production Issues

None known. Bot is live and stable.

---

## P1 — Missing Functionality (Quick Wins)

### 1. /release command
**Why**: Users with full boxes have no way to remove unwanted Pokémon. Core feature in every Pokémon bot.
**Effort**: 30 min
**File**: `src/commands/pokemon/release.ts` (new)
**Logic**: Find UserPokemon by id + userId → delete → refund coins (50 common / 200 uncommon / 500 rare based on `pokemon.isLegendary` or `userPokemon.isShiny`) → addXp(+5)

---

### 2. /nickname command
**Why**: `UserPokemon.nickname` field exists in schema and is never set. Pokétwo users expect this.
**Effort**: 20 min
**File**: `src/commands/pokemon/nickname.ts` (new)
**Logic**: `prisma.userPokemon.update({ data: { nickname: name } })` — max 20 chars, show in /box

---

### 3. IV display in /box
**Why**: IVs are stored on catch but never shown. Users can't evaluate their Pokémon.
**Effort**: 20 min
**File**: `src/commands/pokemon/box.ts`
**Logic**: Sum ivHp+ivAtk+ivDef+ivSpAtk+ivSpDef+ivSpd / 186 * 100 — show as percentage in box embed per Pokémon

---

### 4. Achievement unlock triggers
**Why**: Schema + seed data + /achievements display all exist. Users see achievements but can never earn them.
**Effort**: 1–2h
**Files**: Create `src/services/achievementService.ts`
**Logic**: `checkAchievements(prisma, userId, event: AchievementEvent)` — checks UserAchievement, grants reward (xpReward + coinReward) if newly unlocked. Call from: catch button, battle win, /trade complete, /daily, /pack open.

---

### 5. Quest progress tracking
**Why**: Same problem as achievements — /quests shows quests but progress never increments.
**Effort**: 2h
**Files**: `src/services/questService.ts` (new)
**Logic**: `incrementQuestProgress(prisma, userId, type: QuestType, amount)` — update UserQuest.progress, check if >= requirement, complete and grant rewards

---

## P2 — Trainer Progression

### 6. Rank-up announcement
**Why**: Players level up but nothing announces it beyond ephemeral embed. Public announcements drive engagement.
**Effort**: 1h
**Files**: `src/services/userService.ts` (extend addXp return), `src/utils/rankAnnounce.ts` (new)
**Logic**: addXp() already returns leveledUp. Caller checks if previous title !== new title → post channel embed

---

### 7. Pokédex completion rewards
**Why**: `pokemonCaught` is tracked but milestones are never rewarded.
**Effort**: 30 min
**File**: `src/services/spawnService.ts`
**Logic**: After pokemonCaught increment, check milestones (50, 100, 250, 500) → trigger checkAchievements() + coin grant

---

### 8. Pokémon level-up on XP gain in battles
**Why**: `UserPokemon.xp` is incremented in battleService but level-up is never checked.
**Effort**: 30 min
**File**: `src/services/battleService.ts`
**Logic**: After battle ends, call `levelFromXp(pokemon.xp)` from `src/utils/pokemon.ts` — if level changed, update `level`, announce in battle result

---

## P3 — Economy Improvements

### 9. Item inventory table
**Why**: `/buy` deducts coins but doesn't store purchased items anywhere. Users can buy Shiny Charm but it has no effect.
**Effort**: 1h (schema migration + buy wiring)
**Steps**: Add `UserInventory` model to prisma schema → `npx prisma migrate dev` → update `/buy` to upsert inventory on purchase → check inventory in relevant commands (spawnService for Shiny Charm rate boost)

---

### 10. Outbid refunds in /auction
**Why**: When a user is outbid, their coins are not refunded. High-severity UX issue.
**Effort**: 1h
**File**: `src/commands/economy/auction.ts` bid subcommand
**Logic**: Before accepting new bid: find previous highest bidder → `addBalance(prisma, previousBidder.userId, previousBidder.amount)` → then deduct new bid → update currentBid

---

### 11. /collection value
**Why**: `Card.marketValue` is persisted since S4. Users want to know their collection's total worth.
**Effort**: 30 min
**File**: `src/commands/cards/collection.ts`
**Logic**: Aggregate join on UserCard + Card, sum marketValue * quantity, display total in embed

---

### 12. 5% market listing fee
**Why**: No cost to listing means users spam listings. Fee burns coins and reduces noise.
**Effort**: 20 min
**File**: `src/commands/economy/market.ts` list subcommand
**Logic**: `fee = Math.ceil(price * 0.05)` → `checkBalance >= fee` → `addBalance(-fee)` before creating listing

---

## P4 — Marketplace & Auction

### 13. /career leaderboard
**Why**: Career totalEarned is tracked but never surfaced competitively.
**Effort**: 30 min
**File**: `src/commands/economy/career.ts` (add leaderboard subcommand)
**Logic**: `prisma.userJob.findMany({ where: { jobName }, orderBy: { totalEarned: 'desc' }, take: 10, include: { user: { select: { username: true } } } })`

---

### 14. Market listing ownership validation
**Why**: Users can list Pokémon or cards they don't own (itemData is free text).
**Effort**: 1h
**File**: `src/commands/economy/market.ts` list subcommand
**Logic**: When type='pokemon', verify UserPokemon exists with userId match. When type='card', verify UserCard exists. Reject if not found.

---

### 15. Auction search and filter
**Why**: /auction browse shows newest 10 only. Users can't find specific items.
**Effort**: 45 min
**File**: `src/commands/economy/auction.ts` browse subcommand
**Logic**: Add optional `type` filter and `search` string option (LIKE match on itemData.name via raw query or json_extract)

---

## P5 — Pokémon Feature Expansion

### 16. /evolve command
**Why**: Evolution schema exists (`evolvesFromId`, `evolutionLevel`, `evolutionItem`) but no command uses it.
**Effort**: 2h (need evolution chain data + command)
**File**: `src/commands/pokemon/evolve.ts` (new)
**Logic**: Check `pokemon.evolvesFromId` + `evolutionLevel` + `evolutionItem` → update UserPokemon.pokemonId → show before/after embed

---

### 17. Silhouette spawn variant
**Why**: Pokétwo's "name the Pokémon to catch" creates memorable moments. Button click is too passive.
**Effort**: 2h
**Files**: `src/services/spawnService.ts` + messageCreate event handler
**Logic**: 20% of spawns show silhouette embed with no button. First user to send correct Pokémon name in channel claims it. Redis lock prevents double-claim.

---

### 18. Nature effects in battle
**Why**: Nature is stored on every Pokémon but never applied to stats.
**Effort**: 30 min
**File**: `src/utils/pokemon.ts` — `calcPokemonStats()`
**Logic**: Add NATURE_MODIFIERS map (25 natures × 2 stats). Apply +10%/-10% multipliers in stat calculation.

---

## P6 — TCG Expansion

See `docs/TCG_ROADMAP_V2.md` for full 6-phase plan.

Next phase: Card favoriting + collection sorting by rarity or value.

---

## P7 — Competitor-Inspired Features

Reference `docs/S5_POKEMON_FEATURE_TRANSLATIONS.md` for full list.

Quick wins from that list:
- Pokédex completion rewards (covered in P2 above)
- /collection value (covered in P3 above)
- /nickname and /release (covered in P1 above)

---

## Arch Reminders

- **Never use `trainerXp: { increment: N }` directly** — always call `addXp(prisma, userId, N)`
- **transferBalance** throws 'INSUFFICIENT_FUNDS' — always catch it
- **Commands auto-register** — file in src/commands/ = registered command, no manual wiring
- **Redis cooldown keys**: `cooldown:{userId}:{key}` — use checkCooldown() / setCooldown()
- **logModAction()** — must be called in every new moderation command

## Do NOT Do in S6

- Do not implement PokéPass (battle pass) — needs 3+ new tables + seasonal timer
- Do not implement Gym system — needs 8 gym trainer configs, badge system, perk application
- Do not implement Trainer Teams — needs 4+ new tables
- Do not touch `C:\Users\Shadow\Downloads\dank-bot` code
