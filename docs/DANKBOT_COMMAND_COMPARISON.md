# Command Comparison: pokemon-master-bot vs dank-bot

> Source: direct scan of both repos.
> - `pokemon-master-bot`: `src/commands/**/*.ts` (42 commands, 9 categories)
> - `dank-bot`: `commands/*.js` (76 top-level slash commands, 80 files)
> All claims verified from source files.

---

## Totals

| Metric | pokemon-master-bot | dank-bot |
|---|---|---|
| Top-level slash commands | **42** | **76** |
| Command files | 42 (.ts) | 80 (.js) |
| Prefix commands | 0 | 0 |
| Context menu commands | 0 | 1 (`translate-ctx.js`) |
| Autocomplete supported | Yes (`/pokemon`, `/pack`) | Yes (various) |
| Button interactions | Yes (battle, trade, giveaway, catch) | Yes (extensive) |
| Select menus | Not found | Yes (player detail, faction) |
| Modals | Not found | Yes (some admin flows) |
| Help system | `/help category?` — embed categories | `/commands` — full listing |
| In-code perm re-checks | `/giveaway` only | Multiple (admin, economy, mod) |

---

## Category-by-category comparison

### Economy

| Command | pokemon-master-bot | dank-bot |
|---|---|---|
| `/balance` / `/bank` | `/balance` ✅ | `/bank balance` ✅ |
| `/deposit` / `/withdraw` | `/deposit`, `/withdraw` ✅ | `/banking deposit/withdraw` ✅ |
| `/daily` | ✅ streak bonus | ✅ streak bonus (48h window) |
| `/weekly` | ✅ | ✅ |
| `/monthly` | ❌ | ✅ (`/economy monthly`) |
| `/work` | ✅ 3600s cooldown | ✅ (`work.js`) |
| `/beg` | ✅ | ❌ |
| `/fish` | ✅ 1800s | ❌ |
| `/hunt` | ✅ 3600s | ❌ (different game — DayZ) |
| `/rob` | ✅ configurable | ✅ (`/economy rob`) |
| `/crime` | ❌ | ✅ (`/economy crime`) |
| `/pay` / `/gift` | ❌ | ✅ (`/economy pay`) |
| `/shop` (view) | ✅ | ✅ sub-browse |
| `/buy` | ❌ **MISSING** | ✅ sub-buy |
| `/inventory` | ❌ | ✅ (`inventory.js`) |
| `/market` (listing/browse) | ❌ (schema exists) | ✅ (`market.js`) |
| `/auction` | ❌ (schema exists) | ✅ (`auction.js`) |
| Gambling (slots/blackjack/roulette) | ❌ | ✅ (`casino.js`, `gambling.js`, `bjtable.js`) |
| `/lottery` | ❌ | ✅ (`lottery.js`) |
| Stock market | ❌ | ✅ (`stocks.js`) |
| Insurance | ❌ | ✅ (`/economy insurance`) |
| Featured reward (rotating) | ❌ | ✅ (`/economy featured`) |
| Contract system | ❌ | ✅ (`contracts.js`) |

### Pokémon-specific (pokemon-master-bot advantage)

| Command | pokemon-master-bot | dank-bot |
|---|---|---|
| `/catch` | ✅ | ❌ |
| `/box` | ✅ | ❌ |
| `/pokedex` | ✅ | ❌ |
| `/pokemon` lookup | ✅ autocomplete | ❌ |
| `/team` | ✅ | ❌ |
| `/trade` (Pokémon) | ✅ | ❌ |
| `/favorite` | ✅ | ❌ |
| Pokémon spawning (message trigger) | ✅ (spawnService) | ❌ |
| `/battle` (PvP) | ✅ | `/wager duel` (coin-based) |
| `/pack` (TCG) | ✅ | ❌ |
| `/collection` (TCG cards) | ✅ | ❌ |
| `/card` lookup | ✅ | ❌ |

### Progression / XP / Leveling

| Feature | pokemon-master-bot | dank-bot |
|---|---|---|
| Message XP (per-guild) | ✅ 5-20 XP/min, 60s cooldown | ❌ (DayZ combat-only) |
| Trainer level (global) | ✅ quadratic curve, titles | ❌ |
| Ranked tier system | ✅ Bronze→Master (rankedPoints) | ✅ 20-tier military rank (score-based) |
| Battle pass / seasonal progression | ❌ | ✅ DankPass (50-tier, 60-day seasons) |
| Daily streak bonus | ✅ +50/day up to +1000 | ✅ |
| Weekly streak | ✅ (schema) | ✅ |
| Monthly streak | ✅ (schema) | ✅ |
| Kill/combat streak | ❌ | ✅ (`max_streak` multiplier) |
| Role rewards from progression | ❌ | ✅ (DankPass tier roles) |
| Job leveling | ✅ (`UserJob.level`) | ❌ |
| XP multipliers | ❌ | ❌ |
| Voice XP | ❌ | ❌ |
| Prestige system | ❌ | ❌ |

### Social

| Command | pokemon-master-bot | dank-bot |
|---|---|---|
| `/profile` | ✅ | ✅ (`player.js`) |
| `/leaderboard` | ✅ 4 types | ✅ multi-type |
| `/achievements` | ✅ | ✅ (`/quest achievements`) |
| `/quests` | ✅ | ✅ (`quest.js`) |
| Faction system | ❌ | ✅ (`faction.js`) |
| Bounty system | ❌ | ✅ (`bounty.js`) |
| Squad / party | ❌ | ✅ (`squad.js`) |
| Tournament | ❌ | ✅ (`tournament.js`) |
| Vote polls | ❌ | ✅ (`vote.js`) |
| Wanted list | ❌ | ✅ (`wanted.js`) |
| Report system | ❌ | ✅ (`report.js`) |
| Role reactions | ❌ | ✅ (`reactrole.js`) |

### Moderation

| Command | pokemon-master-bot | dank-bot |
|---|---|---|
| `/ban` | ✅ | ✅ |
| `/kick` | ✅ | ✅ |
| `/timeout` | ✅ | ✅ (`/mod mute`) |
| `/warn` | ✅ | ✅ |
| `/warnings` | ✅ | ✅ |
| `/purge` | ✅ | ✅ |
| `/lock` / `/unlock` | ✅ | ✅ |
| `/slowmode` | ✅ | ✅ |
| `/unban` | ❌ **MISSING** | ✅ |
| Mod log channel | ❌ (schema has `modLogChannelId`) | ✅ (`CH_LOG`) |
| Whitelist | ❌ | ✅ (`whitelist.js`) |
| Staff management | ❌ | ✅ (`staff.js`) |

### Admin / Config

| Command | pokemon-master-bot | dank-bot |
|---|---|---|
| `/config` (settings) | ✅ | ✅ (`settings.js`, `features.js`) |
| `/setup` | ✅ | ✅ (`setup.js`) |
| AI assistant | ✅ `/professor` (Groq) | ✅ `/ai` |
| Inject items/builds | ❌ | ✅ (`inject.js`) |
| Heatmap generation | ❌ | ✅ (`tools heatmap`) |
| `/giveaway` | ✅ | ✅ (`livefeed.js` giveaway) |
| Radar / zone management | ❌ | ✅ (`radarconfig.js`, `zones.js`) |
| Ticket system | ❌ | ✅ (`ticket.js`) |

---

## Missing commands in pokemon-master-bot (prioritized)

| Priority | Command | Category | Effort | Notes |
|---|---|---|---|---|
| 🔴 P1 | `/buy <item>` | Economy | Low | Schema ready; shop embed already says "Use /buy" |
| 🔴 P1 | `/market list/browse/buy` | Economy | Med | `MarketListing` model fully built including `isAuction` |
| 🔴 P1 | `/unban` | Moderation | Low | 1 API call — mirror `/ban` |
| 🟡 P2 | `/auction place/bid/end` | Economy | Med | `MarketListing.isAuction` + `bids Json` already modeled |
| 🟡 P2 | `/inventory` | Economy | Low | DB stores items via `itemData Json` on `MarketListing` |
| 🟡 P2 | `/pay` (coin transfer) | Economy | Low | `transferBalance()` exists in `userService.ts` |
| 🟡 P2 | `/monthly` | Economy | Low | Schema has `monthlyStreak`, `lastMonthly` |
| 🟡 P2 | Mod log channel | Moderation | Low | `Guild.modLogChannelId` column exists; log `AuditLog` records |
| 🟡 P2 | `/crime` | Economy | Low | Flavor grind command; add variation to economy loop |
| 🟢 P3 | Role rewards from trainer level | Progression | Low | Wire `getTrainerTitle()` → role assign on level-up |
| 🟢 P3 | Gambling minigames | Economy | Med | No current model; `/casino coinflip/slots/blackjack` |
| 🟢 P3 | Ticket system | Support | Med | Common server feature; low gameplay value |
| 🟢 P3 | Faction/squad | Social | High | Major feature; dank-bot's core is DayZ-specific |
| 🟢 P3 | Battle pass / seasonal | Progression | High | Would be "PokéPass" — DankPass clone for Pokémon |

---

## UX quality comparison

| UX dimension | pokemon-master-bot | dank-bot |
|---|---|---|
| Embed color consistency | Ad-hoc hex per command | Semantic palette (hex constants) |
| Brand author icon | ❌ | ✅ dankbot_avatar.png |
| Persistent button handlers | ❌ in-memory collectors | ✅ DB-backed, survive restart |
| Shared embed builders | Partial (`utils/embeds.ts`) | ✅ consistent pattern |
| `deferReply` on slow ops | Partial | Consistent |
| Image-generated cards/badges | ❌ | ✅ rank badge generator |
| Cooldown feedback | Ephemeral embed | Ephemeral embed |
