# Command Audit — Pokémon Master Bot

> Generated S2 (2026-06-14). Source of truth: `src/commands/**`, `src/events/interactionCreate.ts`, `src/events/messageCreate.ts`, `src/deploy-commands.ts`.
> Status legend: **WORKING** = fully implemented + wired; **PARTIAL** = implemented but degraded/incomplete dependency; **BROKEN** = known runtime failure; **MISSING** = referenced but not implemented.

## Summary

| Metric | Value |
|---|---|
| Total slash commands | **42** (across 9 categories) |
| Prefix commands | **0** (bot is slash-only; `messageCreate` handles automod + spawns + XP only) |
| Owner-only commands | **0** (no `eval` / `shutdown` / `reload` / `blacklist` / `maintenance` exist) |
| Admin commands | 2 (`/config`, plus `/setup` + `/welcome` = ManageGuild) |
| Moderator commands | 9 (moderation category) |
| Commands with `setDefaultMemberPermissions` | 11 |
| Commands loaded at boot (verified) | 42 (`[boot] commands loaded: 42`) |
| Commands registered but not implemented | None found |
| Commands implemented but not registered | None — `deploy-commands.ts` registers every file with a `.data` export globally |
| Duplicate functionality | `/hunt` vs `/fish` vs `/work` vs `/beg` (4 overlapping coin grinds); `/box` (pokemon) vs `/collection` (cards) are distinct |
| Dead code | None blocking; see Notes |
| Missing descriptions | None — all 42 have `setName`+`setDescription`; all options have descriptions |
| Missing permission checks | See [PERMISSION_AUDIT.md](PERMISSION_AUDIT.md) — moderation relies on `setDefaultMemberPermissions` (Discord-enforced); OK but no in-code re-check on most |

## How commands are wired

- **Registration:** `src/deploy-commands.ts` (`npm run deploy:commands`) — recursively loads every `.data` and `rest.put(Routes.applicationCommands(...))` → **global** registration (up to 1h propagation). NOT auto-run on `ready`; must be run manually after deploy.
- **Dispatch:** `interactionCreate.ts` → `client.commands.get(name)` → `ensureUser`/`ensureGuild` → central cooldown (if `command.cooldown`) → `command.execute`. Errors caught centrally with an ephemeral error embed.
- **Cooldowns:** two systems — (1) central `command.cooldown` (seconds) in interactionCreate, (2) per-command `checkCooldown`/`setCooldown` for economy. Both use Redis (`utils/cooldown.ts`).
- **⚠️ Redis dependency:** cooldowns, spawn cooldown, XP, and battle locks all call `client.redis.*` **unguarded**. With Redis down these commands throw (caught per-interaction → generic error embed). `REDIS_URL` is currently **empty** on Railway → see [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). Redis must be provisioned for these to be WORKING in production.

---

## Economy (11)

| Command | Description | Options | Cooldown | Perms | Status |
|---|---|---|---|---|---|
| `/balance` | Check your PokeCoin balance | `user?` | — | User | WORKING |
| `/beg` | Beg for PokéCoins | — | self (checkCooldown) | User | WORKING* |
| `/daily` | Claim your daily PokeCoin reward | — | 24h (DB ts) | User | WORKING |
| `/weekly` | Claim your weekly PokéCoin reward | — | 7d (DB ts) | User | WORKING |
| `/work` | Work a job to earn PokéCoins | `job` (choices) | 3600s | User | WORKING* |
| `/fish` | Go fishing for PokéCoins! | — | 1800s (guild cfg) | User | WORKING* |
| `/hunt` | Hunt Pokemon in the wild for PokéCoins! | — | 3600s (guild cfg) | User | WORKING* |
| `/rob` | Attempt to rob another trainer | `target` | 86400s (guild cfg) | User | WORKING* |
| `/deposit` | Deposit PokéCoins into your bank | `amount` (req) | — | User | WORKING |
| `/withdraw` | Withdraw PokéCoins from your bank | `amount` (req) | — | User | WORKING |
| `/shop` | Browse and buy items from the PokéShop | — | — | User | PARTIAL — embed says "Use `/buy`" but **no `/buy` command exists** (purchase path missing) |

\* depends on Redis for cooldown tracking.

## Pokémon (7)

| Command | Description | Options | Cooldown | Perms | Status |
|---|---|---|---|---|---|
| `/catch` | Catch a wild Pokemon that has spawned! | — | 3s | User | WORKING* (needs active spawn from spawnService → Redis) |
| `/box` | View your Pokemon collection | `page?` | — | User | WORKING |
| `/pokedex` | View your Pokedex progress | — | — | User | WORKING |
| `/pokemon` | Look up a Pokemon's information | `name` (req, autocomplete) | — | User | WORKING (PokéAPI + Redis cache) |
| `/team` | Manage your battle team | sub: `view`/`add`/`remove` | — | User | WORKING |
| `/trade` | Trade Pokemon with another trainer | `user`,`pokemon_id`,`request` (req) | — | User | WORKING (button-confirm) |
| `/favorite` | Mark a Pokemon as favorite | `pokemon_id` (req) | — | User | WORKING |

## Cards / TCG (3)

| Command | Description | Options | Cooldown | Perms | Status |
|---|---|---|---|---|---|
| `/pack` | Open a Pokemon card pack | `set?` (autocomplete) | — | User | WORKING* (TCG API + Redis cache) |
| `/collection` | View your card collection | `user?` | — | User | WORKING |
| `/card` | Look up a Pokemon card | `name` (req) | — | User | WORKING (TCG API) |

→ See [POKEMON_TCG_INTEGRATION_AUDIT.md](POKEMON_TCG_INTEGRATION_AUDIT.md).

## Battles (1)

| Command | Description | Options | Cooldown | Perms | Status |
|---|---|---|---|---|---|
| `/battle` | Challenge another trainer to a Pokemon battle | `opponent` (req), `type?` | — | User | WORKING* (uses Redis locks `myLockKey`/`battleKey`; **hard-fails without Redis**) |

## Social (4)

| Command | Description | Options | Cooldown | Perms | Status |
|---|---|---|---|---|---|
| `/profile` | View trainer profile | `user?` | — | User | WORKING |
| `/achievements` | View your achievements | `user?` | — | User | WORKING |
| `/quests` | View your active quests | — | — | User | WORKING |
| `/leaderboard` | View server leaderboards | `type` (choices) | — | User | WORKING |

## Utility (5)

| Command | Description | Options | Cooldown | Perms | Status |
|---|---|---|---|---|---|
| `/ping` | Check bot latency | — | — | User | WORKING |
| `/help` | View all available commands | `category?` (choices) | — | User | WORKING |
| `/professor` | Ask Professor Oak a Pokemon question | sub `ask`: `question` (req), `model?` | 10s | User | WORKING* (Groq AI; needs `GROQ_API_KEY`) |
| `/setup` | Setup Pokemon Master for your server | `type` (req, choices) | — | **ManageGuild** | WORKING |
| `/welcome` | Configure the welcome system | sub: `setup`/`preview`/`disable` | — | **ManageGuild** | WORKING |

## Giveaways (1)

| Command | Description | Options | Cooldown | Perms | Status |
|---|---|---|---|---|---|
| `/giveaway` | Manage giveaways | sub: `create`/`end`/`reroll` | — | **ManageGuild** (in-code re-check ✅) | WORKING (giveawayJob processes endings) |

## Admin (1)

| Command | Description | Options | Cooldown | Perms | Status |
|---|---|---|---|---|---|
| `/config` | Configure Pokemon Master settings | sub: `economy`/`spawns`/`moderation`/`rob`/`view` | — | **Administrator** | WORKING |

## Moderation (9)

| Command | Description | Options | Cooldown | Perms | Status |
|---|---|---|---|---|---|
| `/ban` | Ban a member from the server | `user` (req),`reason?`,`delete_days?` | — | **BanMembers** | WORKING |
| `/kick` | Kick a member from the server | `user` (req),`reason?` | — | **KickMembers** | WORKING |
| `/timeout` | Timeout a member | `user`,`duration` (req),`reason?` | — | **ModerateMembers** | WORKING |
| `/warn` | Warn a member | `user`,`reason` (req) | — | **ModerateMembers** | WORKING |
| `/warnings` | View warnings for a user | `user` (req) | — | **ModerateMembers** | WORKING |
| `/purge` | Bulk delete messages | `amount` (req),`user?` | — | **ManageMessages** | WORKING |
| `/lock` | Lock a channel | `reason?` | — | **ManageChannels** | WORKING |
| `/unlock` | Unlock a channel | — | — | **ManageChannels** | WORKING |
| `/slowmode` | Set channel slowmode | `seconds` (req) | — | **ManageChannels** | WORKING |

> **No `/unban`** command exists (you can `/ban` but not reverse it via the bot) — see gap analysis.

---

## Gaps / Issues found

| # | Severity | Finding |
|---|---|---|
| C1 | 🔴 | `/shop` references `/buy` to purchase, but **no `/buy` command exists** → economy item loop is incomplete. |
| C2 | 🟡 | **No `/unban`** to reverse `/ban`. |
| C3 | 🟡 | `/battle` hard-depends on Redis locks; with Redis absent it errors out (not graceful). |
| C4 | 🟡 | XP grant in `messageCreate.ts:17` calls `redis.get` **outside** a try/catch (the spawn/automod calls are guarded) → unhandled rejection when Redis is down. |
| C5 | 🟢 | 4 overlapping coin-grind commands (`/beg`,`/fish`,`/hunt`,`/work`) — fine, but consider consolidating UX. |
| C6 | 🟢 | Commands are registered **globally** and only via manual `npm run deploy:commands`; no guild-scoped fast-register for dev, and registration not part of deploy. |

## NEXT_SESSION_TASKS
- [ ] Implement `/buy` to close the `/shop` loop (C1).
- [ ] Add `/unban` (C2).
- [ ] Guard all `client.redis.*` calls or provision Redis (C3, C4).
- [ ] Add a guild-scoped registration path for testing + run `deploy:commands` automatically post-deploy.
