# Tasks — Next Session (S9)
> Updated: 2026-06-14 (S8 wrap-up)
> Bot: 61 commands, build tsc clean, pushed to Railway
> Start by reading: `docs/SESSION_HANDOFF_S8.md`

---

## ⚠️ FIRST ACTION

```bash
npm run db:push
```

Creates `user_inventory` table in Railway Postgres. Bot will crash on `/buy`, `/inventory`, Shiny Charm, Amulet Coin interactions until this is done.

---

## P0 — Auction System Rework

**Why**: Users can list Pokémon they don't own. No ownership validation anywhere in auction flow. See `docs/AUCTION_SYSTEM_REWORK.md`.

**Steps**:
1. `auction create pokemon` — validate `userPokemon.userId === interaction.user.id`
2. `auction create card` — validate `userCard.userId === interaction.user.id`
3. `auction create item` — validate `userInventory.quantity >= listed qty`
4. Replace embed-field auction browser with StringSelectMenu
5. DM outbid user when higher bid is placed
6. Add `/auction cancel` (listing owner or ManageGuild)

---

## P1 — Career System V2

**Why**: Equipment bought in `/shop` has zero effect. Career commands are fragmented. See `docs/CAREER_SYSTEM_V2.md`.

**Steps**:
1. Consolidate `/fisher`, `/ranger`, `/breeder`, `/miner`, `/researcher`, `/rocket` → `/career work` with career type select menu
2. Equipment checks: `userInventory.findUnique({ userId, itemId: 'old_rod' })` before Fisher reward calc
3. Level scaling: `reward *= (1.0 + userJob.level * 0.05)`
4. `/career view` — career stats, level, title, equipment, next milestone
5. `/career leaderboard` — top earners per career type
6. `npm run deploy:commands` — remove deleted standalone career commands
7. Command count target: 61 → 55

---

## P1 — TCG Phase 2 (/sets)

**Why**: Users can't see which sets they're close to completing. See `docs/TCG_ROADMAP_V3.md`.

**API key:** `09d3c22f-db75-4f58-bd4f-e89a37b888e1`

**Steps**:
1. `/sets` command — all sets with user's completion % (unique cards owned / set total)
2. Set completion achievement: trigger on pack open — if 100% owned, grant 10,000 coins + 500 XP + `SET_COMPLETE:{setId}` achievement
3. `/setinfo [set]` — paginated card list with ✅/❌ ownership markers

---

## P2 — AuditLog Expansion

Currently only `/giftpack` writes to AuditLog. Add:
- `/ban`, `/kick`, `/timeout`, `/purge`
- `/config` changes (before/after value)

---

## P2 — Command Consolidation (After Career V2)

See `docs/COMMAND_CONSOLIDATION_PLAN.md`.

After Career V2:
- `/bank` merge: `/balance`, `/deposit`, `/withdraw` → `/bank view/deposit/withdraw` (saves 2)
- `/rewards` merge: `/daily`, `/weekly`, `/monthly` → `/rewards daily/weekly/monthly` (saves 2)

Always `npm run deploy:commands` to remove deleted commands from Discord.

---

## P3 — Quest Completion Notification

When a quest completes, post a DM or embed. Currently silent. See `src/services/questService.ts`.

---

## P3 — Rank-Up Announcement

`addXp()` returns `leveledUp: true` but nothing posts to a channel. Add optional channel post on level up.

---

## P4 — Future (Confirm Before Starting)

- **Gym System** — 8 gym configs, badge system, gym leader roles — S10+
- **Silhouette spawns** — messageCreate shows silhouette image, users guess name
- **Deck Builder (TCG Phase 5)** — Deck + DeckCard schema — S11+
- **PokéPass** (battle pass) — 40-tier seasonal progression — S10+
- **Background price refresh** — refresh card market values every 6h for cards owned by 5+ users

---

## Arch Reminders

- `addXp(prisma, userId, N)` — never direct `trainerXp: { increment: N }`
- `transferBalance` throws `'INSUFFICIENT_FUNDS'` — always catch
- `checkAndAwardAchievements(client, userId, channelId?, guildId?)` — after any stat increment
- `incrementQuestProgress(prisma, userId, type, amount)` — after catch/battle/daily/pack
- Commands auto-register on bot startup — file in `src/commands/` = live command
- After adding/removing commands: always run `npm run deploy:commands`
- Framework sets cooldown BEFORE `execute()` — NEVER also call `checkCooldown()` inside `execute()`
- UserInventory upsert pattern: `upsert({ where: { userId_itemId: { userId, itemId } }, update: { quantity: { increment: qty } }, create: {...} })`
- After schema changes: `npx prisma generate` then `npm run build` then `npm run db:push`
