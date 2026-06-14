# Tasks — Next Session (S4)

> Date created: 2026-06-14
> Bot state: live, stable, Redis connected, 37/42 commands working
> Start by reading: `docs/SESSION_HANDOFF_S3.md`, `docs/SCHEMA_TO_COMMAND_GAP_ANALYSIS.md`

---

## P0 — Fix or confirm slash command stability

Commands are working (`/beg` confirmed) but the root cause of the earlier "application did not respond" incident was not fully traced in S3. Before adding new commands, confirm stability.

**Actions:**
1. Test 5 random commands on the live bot and confirm they respond
2. If any fail: check Railway logs for errors in `interactionCreate` handler
3. Hardening (if failures continue): add `await interaction.deferReply()` as first line in `handleCommand()` (`src/events/interactionCreate.ts:24`) then switch all `reply()` calls to `editReply()` in affected commands

---

## P1 — Implement missing core commands (zero schema changes)

All three rely on existing code/schema. Each is 30 minutes of work.

### `/buy <item>`

- File to create: `src/commands/economy/buy.ts`
- Reference: `src/commands/economy/shop.ts` — `SHOP_ITEMS` array is already defined there
- Logic: find item by name → check `user.balance >= price` → `addBalance(prisma, userId, -price)` → reply with purchase confirm embed
- Wire: the command auto-registers from `src/commands/economy/` directory scan — no manual wiring needed

### `/pay <user> <amount>`

- File to create: `src/commands/economy/pay.ts`
- Reference: `src/services/userService.ts:45` — `transferBalance()` already exists
- Logic: validate amount > 0 → call `transferBalance(prisma, senderId, recipientId, amount)` → reply with transfer confirmation
- Handle `INSUFFICIENT_FUNDS` error from `transferBalance`

### `/unban <user_id>`

- File to create: `src/commands/moderation/unban.ts`
- Reference: `src/commands/moderation/ban.ts` — mirror the permission check and response pattern
- Logic: `await interaction.guild.bans.remove(userId)` → reply confirm embed
- Must have `BanMembers` permission gate (same as `/ban`)

---

## P2 — Wire existing systems (zero schema changes, ~30 min each)

### Wire `addXp()` to battle wins

- File: `src/services/battleService.ts` (or wherever `saveBattleResult()` is)
- Action: after determining `winnerId`, call `await addXp(prisma, winnerId, 50 + turns)` → if `leveledUp`, post ephemeral DM or channel embed announcing new level
- `addXp()` is in `src/services/userService.ts:60` — already returns `{ leveledUp, newLevel }`

### Persist card `marketValue` on pack open

- File: `src/services/pokemonTcgService.ts` — `openPack()` function
- Action: after fetching card data, add `marketValue: card.tcgplayer?.prices?.holofoil?.market ?? card.tcgplayer?.prices?.normal?.market ?? null` to the `Card` upsert
- Impact: enables collection value in `/collection` and card leaderboard type

### Increment `UserJob.level` in `/work`

- File: `src/commands/economy/work.ts`
- Action: after recording work, check `if (job.timesWorked % 10 === 0) { await prisma.userJob.update({ data: { level: { increment: 1 } } }) }` → show level-up in reply

### Mod log channel posts

- Create `src/utils/modLog.ts` — `postModLog(client, guildId, action, details): Promise<void>` — fetches `guild.modLogChannelId`, posts embed, writes `AuditLog` record
- Add 2-line call at end of each mod command (`ban.ts`, `kick.ts`, `warn.ts`, `timeout.ts`)

---

## P3 — Market and auction commands (schema-ready, ~4–6h total)

### `/market` (3 subcommands)

- `/market browse [type] [page]` — paginated embed of active `MarketListing` records
- `/market list <type> <id> <price>` — create listing (type = "pokemon" | "card")
- `/market buy <listing_id>` — instant purchase; `transferBalance()` + create `MarketPurchase`

### `/auction` (4 subcommands)

- `/auction place <type> <id> <startBid> <hours>` — create `MarketListing { isAuction: true, auctionEndsAt: now + hours }`
- `/auction bid <listing_id> <amount>` — append to `bids Json`, update `currentBid`; refund previous bidder
- `/auction view <listing_id>` — current state embed with time remaining
- Auction expiry job: extend `jobService.ts` → every 5 min, settle expired auctions

---

## P4 — Trainer XP progression

- Ensure `addXp()` is called in: `/work`, `/daily`, `/fish`, `/hunt`, battle wins (P2)
- Level-up announcement: send guild message when trainer levels up
- Show Trainer XP progress bar in `/profile`

---

## P5 — Show IVs and stats in `/box` and `/pokemon`

- File: `src/commands/pokemon/box.ts` — add IV total (sum of 6 IVs / 186 × 100%) as field per Pokémon
- New subcommand or existing `/pokemon inspect <id>` — show full stat block from `calcPokemonStats(pokemon, userPokemon)`
- Functions exist in `src/utils/pokemon.ts:43-75` — just need to call and format

---

## P6 — Pokémon progression from battles

- File: `src/services/battleService.ts`
- Grant `userPokemon.xp += 25` to the winning Pokémon after each battle
- If `xp >= xpToNextLevel(level)`: increment `level`, announce level-up
- `xpToNextLevel()` and `levelFromXp()` already in `src/utils/pokemon.ts`

---

## P7 — TCG expansion (follow TCG_ROADMAP_V2.md)

Phase 1 only: persist `Card.marketValue` + collection total in `/collection`
See: `docs/TCG_ROADMAP_V2.md` for full 6-phase plan

---

## Additional quality fixes

| Item | File | Effort |
|---|---|---|
| Fix `/config view` — raw JSON output | `src/commands/admin/config.ts` | 20 min |
| Add `/monthly` command | Copy `/weekly`, extend cooldown to 30 days | 20 min |
| Add `shiny` and `legendary` types to `/leaderboard` | `src/commands/social/leaderboard.ts` | 20 min |
| Convert cooldown import to static | `src/events/interactionCreate.ts:35` | 5 min |
| Add Redis ping to `/health` endpoint | Express router | 10 min |

---

## Do NOT do in S4

- Do not implement PokéPass (Trainer Journey battle pass) — needs 2 new tables; requires addXp wired first (P4 above)
- Do not implement Trainer Teams / Gym Control — high social value but needs 4+ new tables
- Do not implement Game Corner gambling — no table exists yet
- Do not modify C:\Users\Shadow\Downloads\dank-bot at any time
