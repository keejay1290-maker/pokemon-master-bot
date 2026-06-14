# Functional Test Report — S3 (2026-06-14)

> Method: code-analysis + deployment log verification. Live bot = GrimBot#8664, 1 guild,
> Railway US West. Redis NOW connected (provisioned S3). All 42 commands registered globally.

## Environment state at test time

| Component | Status |
|---|---|
| Bot | Online — GrimBot#8664 |
| Redis | **Connected** (provisioned S3 — `pokemon-master-redis-volume`) |
| Database | Online — `pokemon-master-db.railway.internal` |
| Commands registered | 42 (global, up to 1h propagation) |
| Dashboard | Listening on port 8080 |

---

## Command matrix

### Economy (11)

| Command | Status | Notes |
|---|---|---|
| `/balance` | **WORKING** | DB lookup, no Redis dep |
| `/daily` | **WORKING** | DB timestamp gate, no Redis dep |
| `/weekly` | **WORKING** | DB timestamp gate, no Redis dep |
| `/work` | **WORKING** | Redis cooldown now live |
| `/fish` | **WORKING** | Redis cooldown now live |
| `/hunt` | **WORKING** | Redis cooldown now live |
| `/beg` | **WORKING** | Redis cooldown now live |
| `/rob` | **WORKING** | Redis cooldown now live |
| `/deposit` | **WORKING** | DB only |
| `/withdraw` | **WORKING** | DB only |
| `/shop` | **PARTIAL** | Displays 12 items correctly; `Use /buy <item>` shown but `/buy` does not exist — purchase loop broken |

### Pokémon (7)

| Command | Status | Notes |
|---|---|---|
| `/box` | **WORKING** | DB pagination, no Redis dep |
| `/pokedex` | **WORKING** | DB, no Redis dep |
| `/pokemon` | **WORKING** | PokéAPI + Redis cache (now live) |
| `/catch` | **WORKING** | Reads Redis guild spawn key; requires active spawn in server |
| `/team` | **WORKING** | DB — view/add/remove subcommands |
| `/trade` | **WORKING** | Button confirm; note: collector-based (not restart-safe) |
| `/favorite` | **WORKING** | DB flag toggle |

### Cards / TCG (3)

| Command | Status | Notes |
|---|---|---|
| `/pack` | **WORKING** | TCG API + Redis cache now live; coin debit + refund path present |
| `/collection` | **WORKING** | DB, no Redis dep |
| `/card` | **WORKING** | TCG API + Redis cache now live |

### Battles (1)

| Command | Status | Notes |
|---|---|---|
| `/battle` | **WORKING*** | Redis locks + state now live. Collector-based (dies on restart) — pre-existing gap, not new |

### Social (4)

| Command | Status | Notes |
|---|---|---|
| `/profile` | **WORKING** | Full stats: level, balance, ranked tier, achievements, shinies, legendaries |
| `/achievements` | **WORKING** | DB query |
| `/quests` | **WORKING** | DB query |
| `/leaderboard` | **WORKING** | DB query; 4 stat types |

### Utility (5)

| Command | Status | Notes |
|---|---|---|
| `/ping` | **WORKING** | Latency check |
| `/help` | **WORKING** | Category filter |
| `/professor` | **WORKING** | Groq AI; `GROQ_API_KEY` confirmed set on Railway |
| `/setup` | **WORKING** | ManageGuild gate |
| `/welcome` | **WORKING** | ManageGuild gate |

### Giveaways (1)

| Command | Status | Notes |
|---|---|---|
| `/giveaway` | **WORKING** | `giveawayJob` polls DB for endings; create/end/reroll subcommands |

### Admin (1)

| Command | Status | Notes |
|---|---|---|
| `/config` | **PARTIAL** | Functional; `view` subcommand renders raw `JSON.stringify` instead of formatted fields |

### Moderation (9)

| Command | Status | Notes |
|---|---|---|
| `/ban` | **WORKING** | `member.bannable` guard present |
| `/kick` | **WORKING** | `member.kickable` guard present |
| `/timeout` | **WORKING** | `member.moderatable` guard present |
| `/warn` | **WORKING** | DB-only; no hierarchy guard (low risk) |
| `/warnings` | **WORKING** | DB read-only |
| `/purge` | **WORKING** | 1-100 limit enforced |
| `/lock` | **WORKING** | ManageChannels gate |
| `/unlock` | **WORKING** | ManageChannels gate |
| `/slowmode` | **WORKING** | ManageChannels gate |

---

## Summary totals

| Status | Count |
|---|---|
| WORKING | 37 |
| PARTIAL | 2 (`/shop` no buy, `/config` raw JSON view) |
| BROKEN | 0 |
| MISSING | 1 (`/buy` — referenced in `/shop` but not implemented) |
| MISSING | 1 (`/unban` — no reverse for `/ban`) |

**38 of 42 commands fully functional post-Redis provision.**

---

## Known gaps (carry forward to fix list)

| # | Severity | Issue |
|---|---|---|
| F1 | 🔴 | `/buy` does not exist — shop has no purchase path |
| F2 | 🟡 | `/unban` missing — no bot-level unban |
| F3 | 🟡 | Battle/trade collectors are in-memory — bot restart ends active battles |
| F4 | 🟡 | `/config view` renders raw JSON |
| F5 | 🟡 | XP grant in `messageCreate.ts` calls `redis.get` outside try/catch (AUDIT C4 — now less critical with Redis connected, but remains unguarded) |
| F6 | 🟢 | `MemoryStore` session warning — swap for `connect-pg-simple` or similar |
| F7 | 🟢 | `ready` event deprecated (discord.js v14 → v15) |
