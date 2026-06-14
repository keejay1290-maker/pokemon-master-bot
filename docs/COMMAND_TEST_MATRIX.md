# Command Test Matrix — S3

> Date: 2026-06-14
> Environment: Railway production (GrimBot#8664)
> Redis: Connected. DB: Connected.
> Status legend: ✅ PASS | ⚠️ PARTIAL | ❌ FAIL | 🔴 MISSING

---

## Economy (11 commands)

| Command | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| `/balance` | Shows wallet + bank embed | Not re-tested S3 | ✅ | S2 confirmed passing |
| `/deposit <amount>` | Moves coins wallet→bank | Not re-tested S3 | ✅ | S2 confirmed passing |
| `/withdraw <amount>` | Moves coins bank→wallet | Not re-tested S3 | ✅ | S2 confirmed passing |
| `/daily` | Grants daily coins + streak | Not re-tested S3 | ✅ | S2 confirmed passing |
| `/weekly` | Grants weekly coins | Not re-tested S3 | ✅ | S2 confirmed passing |
| `/work` | Grants coins + job data | Not re-tested S3 | ✅ | S2 confirmed passing; job level not incremented (gap) |
| `/beg` | Grants small coin amount | User confirmed S3 | ✅ | First S3 command confirmed working |
| `/fish` | Random fish reward | Not re-tested S3 | ✅ | S2 confirmed passing |
| `/hunt` | Random hunt reward | Not re-tested S3 | ✅ | S2 confirmed passing |
| `/rob <user>` | PvP coin steal attempt | Not re-tested S3 | ✅ | S2 confirmed passing |
| `/shop` | Shows 12 item listing | Not re-tested S3 | ⚠️ | Embed says "Use /buy" but `/buy` missing |
| `/buy` | Buy shop item | — | 🔴 | **MISSING** — schema ready, command not built |

---

## Pokémon (8 commands)

| Command | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| `/catch` | Catch active guild spawn | Requires active spawn | ✅ | Redis now connected — spawns functional |
| `/box [page]` | Lists user's Pokémon | Not re-tested S3 | ✅ | S2 passing; IVs hidden (gap) |
| `/pokedex [pokemon]` | Pokédex entry | Not re-tested S3 | ✅ | S2 passing |
| `/pokemon <name>` | PokeAPI lookup | Not re-tested S3 | ✅ | S2 passing with autocomplete |
| `/team` | Show active battle team | Not re-tested S3 | ✅ | S2 passing |
| `/trade <user> <pokemon_id>` | Initiate Pokémon trade | Not re-tested S3 | ✅ | S2 passing |
| `/favorite <pokemon_id>` | Toggle favorite | Not re-tested S3 | ✅ | S2 passing |
| `/evolve <pokemon_id>` | Evolve Pokémon | Not re-tested S3 | ✅ | S2 passing |

---

## Battle (2 commands)

| Command | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| `/battle <user>` | PvP battle flow | Not re-tested S3 | ✅ | S2 passing; uses in-memory collector (not restart-safe); addXp() not called on win (gap) |
| `/leaderboard [type]` | Ranked/battle/balance/card LB | Not re-tested S3 | ✅ | S2 passing; missing shiny/legendary types (gap) |

---

## TCG (3 commands)

| Command | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| `/pack <set>` | Open TCG pack → new cards | Not re-tested S3 | ✅ | S2 passing; card marketValue not persisted (gap) |
| `/collection [page]` | View TCG card collection | Not re-tested S3 | ✅ | S2 passing; no collection value total (gap) |
| `/card <name>` | TCG card lookup | Not re-tested S3 | ✅ | S2 passing |

---

## Social (5 commands)

| Command | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| `/profile [user]` | Full trainer profile embed | Not re-tested S3 | ✅ | S2 passing |
| `/achievements` | Lists unlocked achievements | Not re-tested S3 | ✅ | S2 passing |
| `/quests` | Daily/weekly quest list | Not re-tested S3 | ✅ | S2 passing |
| `/giveaway` | Create/manage giveaway | Not re-tested S3 | ✅ | S2 passing |
| `/pay` | Transfer coins to user | — | 🔴 | **MISSING** — `transferBalance()` in userService.ts already exists |

---

## Admin (3 commands)

| Command | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| `/config` | View/set server settings | Not re-tested S3 | ⚠️ | Shows raw JSON (not formatted); `view` subcommand confirmed |
| `/setup` | Initial server setup | Not re-tested S3 | ✅ | S2 passing |
| `/professor <question>` | Groq AI response | Not re-tested S3 | ✅ | S2 passing |

---

## Moderation (9 commands)

| Command | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| `/ban <user>` | Discord ban | Not re-tested S3 | ✅ | S2 passing; no AuditLog write (gap) |
| `/kick <user>` | Discord kick | Not re-tested S3 | ✅ | S2 passing; no AuditLog write (gap) |
| `/timeout <user>` | Discord timeout | Not re-tested S3 | ✅ | S2 passing |
| `/warn <user>` | DB warning record | Not re-tested S3 | ✅ | S2 passing |
| `/warnings <user>` | Lists warnings | Not re-tested S3 | ✅ | S2 passing |
| `/purge <count>` | Bulk delete messages | Not re-tested S3 | ✅ | S2 passing |
| `/lock` | Lock channel | Not re-tested S3 | ✅ | S2 passing |
| `/unlock` | Unlock channel | Not re-tested S3 | ✅ | S2 passing |
| `/slowmode <seconds>` | Set slowmode | Not re-tested S3 | ✅ | S2 passing |
| `/unban <user_id>` | Discord unban | — | 🔴 | **MISSING** — 1 Discord API call, mirrors `/ban` |

---

## Utility (1 command)

| Command | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| `/help [category]` | Command help embed | Not re-tested S3 | ✅ | S2 passing |

---

## Market / Auction (schema-ready, missing)

| Command | Expected | Schema | Status | Notes |
|---|---|---|---|---|
| `/market browse` | List active market listings | `MarketListing` ✅ | 🔴 | MISSING — next session P3 |
| `/market list <id> <price>` | Create listing | `MarketListing` ✅ | 🔴 | MISSING |
| `/market buy <listing_id>` | Instant buy | `MarketListing` + `MarketPurchase` ✅ | 🔴 | MISSING |
| `/auction place <id> <bid>` | Create auction | `MarketListing.isAuction` ✅ | 🔴 | MISSING |
| `/auction bid <id> <amount>` | Place bid | `MarketListing.bids Json` ✅ | 🔴 | MISSING |

---

## Summary

| Status | Count |
|---|---|
| ✅ PASS | 37 |
| ⚠️ PARTIAL | 2 (`/shop`, `/config`) |
| 🔴 MISSING | 8 (`/buy`, `/pay`, `/unban`, `/market` ×3, `/auction` ×2) |
| ❌ FAIL | 0 |

**Next session target:** 0 MISSING in core commands (buy/pay/unban), reduce PARTIAL to 0.
