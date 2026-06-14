# Competitor Matrix V2 — Pokemon Master Bot

> Date: 2026-06-14
> Competitors: dank-bot (local + GitHub), Poketwo (GitHub: Team-BANERUS/poketwo-Autocatcher + public bot features)
> Rule: every dank-bot feature has a Pokemon-native translation — do not copy, translate.

---

## Overview

| Metric | pokemon-master-bot | dank-bot | Poketwo |
|---|---|---|---|
| Platform | Discord.js v14 / TypeScript | Discord.js v14 / Node.js | Python / discord.py |
| Database | PostgreSQL (Prisma) | SQLite | PostgreSQL |
| Commands | 42 | 76 | ~35 primary |
| Cache | Redis | None | Redis |
| Deployment | Railway | Railway | Self-hosted / private |
| Primary focus | Pokemon RPG + TCG collection | DayZ PvP tracking | Pokemon catching / Pokedex |
| Economy | PokéCoins | Dank coins | PokéCoins |
| Core loop | Catch → Battle → Trade → Collect | Kill → Earn → Spend | Catch → Trade → Duel |

---

## Feature-by-feature comparison

### Economy systems

| Feature | dank-bot | dank-bot Pokemon translation | Poketwo equivalent | PMB current state |
|---|---|---|---|---|
| Daily reward | `/economy daily` — streak bonus +50/day | Trainer Daily Login — Pokémon berry reward | `/daily` | ✅ `/daily` with streak |
| Weekly reward | `/economy weekly` | Weekly Trainer Challenge bonus | `/weekly` | ✅ `/weekly` |
| Monthly reward | `/economy monthly` | Monthly League Reward | None | ❌ schema ready, missing command |
| Work / grind | `/work` — cooldown job | Pokémon Daycare Job — earn coins caring for Pokémon | None | ✅ `/work` |
| Beg | `/economy beg` | Charity Trade — NPCs give low items | None | ✅ `/beg` |
| Fishing | Not in dank-bot | Pokémon Fishing (`/fish`) — catches water Pokémon or items | None | ✅ `/fish` |
| Hunt | Not in dank-bot | Safari Zone Hunt — rare land encounters | None | ✅ `/hunt` |
| Crime | `/economy crime` | Team Rocket Missions — high-risk coin ops | None | ❌ missing |
| Rob | `/economy rob` | Pokémon Heist — steal coins from trainer; Amulet Coin counters | None | ✅ `/rob` |
| Pay / gift | `/economy pay` | Trainer Coin Transfer | `/gift` (items) | ❌ `transferBalance()` exists, missing command |
| Shop | `/economy shop browse/buy` | PokéMart — consumables, PokéBalls, held items | Shop | ⚠️ `/shop` view only; `/buy` missing |
| Inventory | `/inventory` | Trainer Bag | `/bag` | ❌ missing |
| Market (fixed) | `/market list/buy/browse` | Pokémon Exchange — fixed-price P2P listings | Global Market | ❌ `MarketListing` schema ready |
| Auctions | `/auction place/bid/end` | Auction House — timed bids on rare cards/Pokémon | None | ❌ `MarketListing.isAuction` ready |
| Lottery | `/lottery buy/draw` | League Draw — tickets for rare Pokémon encounters | None | ❌ missing |
| Stocks / market sim | `/stocks` | Silph Market — TCG card futures; `tcgplayer.prices.market` | None | ❌ schema has `Card.marketValue` |
| Insurance | `/economy insurance` | Pokémon Daycare Protection — coins protect one Pokémon per battle loss | None | ❌ missing |
| Featured reward | `/economy featured` | Professor's Daily Pick — rotating rare card/spawn | None | ❌ missing |
| Contracts | `/contracts` | Breeder Contracts — commission level-up service | None | ❌ `Trade` model partially covers this |
| Gambling (slots/BJ/roulette) | `/casino`, `/gambling`, `/bjtable` | Game Corner — Voltorb Flip, Slots, Card Game | None | ❌ missing |
| Bank / deposit / withdraw | `/banking deposit/withdraw` | Pokémon Bank — secure coin storage | None | ✅ `/deposit` `/withdraw` |

---

### Progression systems

| Feature | dank-bot | Pokemon translation | Poketwo equivalent | PMB current state |
|---|---|---|---|---|
| XP system | Kill-based XP + DayZ combat score | Trainer XP — battle wins + quests + daily streaks | Catch-based XP | ✅ `trainerXp`, `addXp()` exists — not wired to battles |
| Level system | 20-tier military rank (Recruit→General) | Trainer Level — Rookie→Pokemon Master (7 tiers) | Trainer level | ✅ `trainerLevel` — `getTrainerTitle()` exists |
| Guild XP | None | Guild Trainer Level — message XP per server | None | ✅ `GuildUser.xp/level` from message events |
| Battle pass | DankPass — 50 tiers, 60-day season, ~616k XP | PokéPass — Trainer Journey, 40 tiers, packs/Pokémon per tier | None | ❌ highest retention mechanic — needs 2 new tables |
| Kill/battle streak | `players.streak` — milestone at 5/10/25 | Battle Win Streak — XP multiplier + channel post at 5/10/25 | None | ❌ `User.battlesWon` tracked but streak not maintained |
| Ranked tier | None (PvP stats only) | Ranked Tier — Bronze→Master (ELO-based) | None | ✅ `rankedPoints` + `rankedTier` |
| Role rewards | DankPass tier role assign | Trainer Title role — assign Discord role on trainer level milestone | None | ❌ `addXp()` returns `newLevel` but no role assign |
| Prestige system | None | Trainer Rebirth — reset at level 100 with cosmetic badge | None | ❌ missing |
| Job leveling | None | Daycare Worker Level — earnings multiplier per job tier | None | ✅ `UserJob.level` in schema, never incremented |
| Daily streak bonus | +50/day, cap 1000 | Trainer Loyalty Bonus — streak-based coin/XP multiplier | Daily streak | ✅ implemented in `/daily` |

---

### Pokemon-specific systems

| Feature | dank-bot | Pokemon translation | Poketwo equivalent | PMB current state |
|---|---|---|---|---|
| Pokemon catching | None | Core catch loop — spawn on message, `/catch` to claim | Core feature | ✅ spawn + `/catch` |
| Pokédex | None | `/pokedex` — completion tracking | `/pokedex` | ✅ |
| Pokemon box / storage | None | `/box` — paginated Pokémon collection | `/pokemon` list | ✅ |
| IV/EV system | None | Hidden stat depth — IV 0-31, EV 0-252, calc'd in battle | None | ✅ in DB + `calcPokemonStats()` — NEVER shown |
| Nature system | None | Nature modifier — ±10% stat pair | None | ✅ in DB + `NATURE_MODIFIERS` — NEVER shown |
| Pokemon leveling | None | Pokemon XP from battles — level-up announcements | Pokemon level | ✅ `UserPokemon.level/xp` in schema, NEVER incremented |
| Shiny mechanic | None | Shiny rate — configurable per guild (default 0.2%) | Shinies | ✅ `isShiny`, `shinyCaught`, `Guild.shinyRate` |
| Legendary rate | None | Legendary rate — configurable per guild (default 0.1%) | Legendaries | ✅ `legendariesCaught`, `Guild.legendaryRate` |
| Pokemon trading | None | `/trade` — P2P Pokémon swap | `/trade` | ✅ |
| Pokemon battle | None | `/battle` — turn-based PvP with type effectiveness | `/duel` | ✅ |
| Favorite / team | None | `/favorite`, `/team` — team builder | None | ✅ |
| Evolution | None | `/evolve` — trigger evolution by level/item | Auto-evolve | ✅ |
| Breeding/contracts | None (DayZ building kits) | Breeder Contracts — `/contract level-up` | None | ❌ missing |

---

### TCG / Card collection

| Feature | dank-bot | Pokemon translation | Poketwo equivalent | PMB current state |
|---|---|---|---|---|
| Pack opening | None | `/pack <set>` — open TCG booster via Pokemon TCG API | None | ✅ |
| Card collection | None | `/collection` — paginated card inventory | None | ✅ no total value |
| Card lookup | None | `/card <name>` — live TCG data | None | ✅ |
| Card market value | None | Silph Market — track `tcgplayer.prices.market` per card | None | ❌ `Card.marketValue` column ready, never populated |
| Card auction | None | Foil Auction — bid on holofoil/EX/GX cards | None | ❌ `MarketListing.isAuction` ready |
| Deck builder | None | Trainer Deck — assemble legal TCG deck from collection | None | ❌ not yet planned |
| Set completion | None | Set Collector Achievement — catch all cards in a set | Pokedex completion | ❌ `Achievement` model ready |
| Collection score | None | Collection Value Leaderboard — sum of `Card.marketValue` | None | ❌ depends on card value persistence |
| Pack EV calculator | None | Pack Value Analysis — expected card value per pack | None | ❌ future R&D |

---

### Social systems

| Feature | dank-bot | Pokemon translation | Poketwo equivalent | PMB current state |
|---|---|---|---|---|
| Factions | `/faction` — DayZ squad system | Trainer Teams — compete for Gym control | None | ❌ needs new tables |
| Territories | Zone control (map flags) | Gym Control System — 8 Gyms per server | None | ❌ highest combined score feature |
| Bounties | `/bounty` — player hit contract | Legendary Hunts — public board, first catch wins pool | None | ❌ `Quest` model can extend |
| Squad | `/squad` — temporary group | Trainer Party — co-op legendary raids | None | ❌ missing |
| Tournaments | `/tournament` | Pokemon League Tournament — bracket battles | None | ❌ missing |
| Vote polls | `/vote` | Community Vote — "Should we add X Gym?" | None | ❌ missing |
| Wanted list | `/wanted` | Trainer Bounty Board — public wanted poster for rival | None | ❌ missing |
| Report system | `/report` | Player Report | None | ❌ missing |
| Profile | `/player` | `/profile` | `/profile` | ✅ |
| Leaderboard | `/leaderboard` multi-type | `/leaderboard` | `/leaderboard` | ✅ 4 types; missing shiny/legendary/collection-value |
| Giveaway | `/giveaway` | Pokémon Giveaway | None | ✅ |

---

### Moderation

| Feature | dank-bot | Poketwo | PMB current state |
|---|---|---|---|
| Ban | ✅ | ✅ | ✅ |
| Kick | ✅ | None | ✅ |
| Timeout | ✅ | None | ✅ |
| Warn | ✅ | None | ✅ |
| Unban | ✅ | None | 🔴 **MISSING** |
| Purge | ✅ | None | ✅ |
| Mod log channel | ✅ `CH_LOG` | None | ❌ `Guild.modLogChannelId` ready, never posted to |
| Audit log | ✅ SQLite events | None | ❌ `AuditLog` model ready, never written to |

---

## Poketwo-specific features PMB should consider

Poketwo (Team-BANERUS/poketwo-Autocatcher + public bot) is the market leader in Discord Pokémon catching. Key differentiators:

| Feature | Poketwo | PMB gap |
|---|---|---|
| Autocatcher detection | Anti-autocatcher CAPTCHA system | PMB has no spawn claim protection |
| Pokémon gifting | `/gift` with coin + item option | PMB `/pay` is missing; trade only does Pokémon |
| Incense / lure items | Spawn rate boost consumable | PMB `/shop` items don't include spawn rate boosts |
| Pokémon trading marketplace | Global cross-server market | PMB market is guild-only currently |
| Pokémon dueling | `/duel` with bet | PMB `/battle` exists but no stake mechanic |
| Event Pokémon | Seasonal limited spawns | PMB `Event` model exists, no job reads it |
| Shiny hunting tracker | `/shinyhunt` — tracks which Pokémon you're hunting | PMB has shiny catch tracking, no hunting mode |
| Pokédex completion reward | Achievement on set completion | PMB `Achievement` model exists, not wired |
| Community server search | Cross-server Pokémon trading | PMB is single-server; multi-server would require hosted marketplace API |

---

## Strategic recommendation

PMB's strongest differentiation vs both competitors is the **TCG layer** (no competitor has live TCG card integration) combined with the **IV/EV depth** (competitive battle stats that are invisible to users today). Surfacing these systems should be the next major build priority before adding generic social features.

Build order to maximize differentiation:
1. **Expose IVs in `/box`** — unique to PMB, 0 schema changes
2. **Wire card `marketValue`** — enables Silph Market feature, 3 lines of code
3. **`/buy` + `/market` + `/auction`** — closes economy loop, all schema-ready
4. **Wire `addXp()` to battle wins** — enables PokéPass later, 10 lines
5. **PokéPass (Trainer Journey)** — top retention mechanic, equivalent to DankPass
