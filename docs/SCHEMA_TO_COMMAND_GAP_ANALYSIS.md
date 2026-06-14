# Schema-to-Command Gap Analysis

> Source: `prisma/schema.prisma` (verified 2026-06-14).
> Rule: exploit existing infrastructure before proposing new tables.
> All claims reference actual schema fields and source files.

---

## Summary

The Prisma schema is significantly ahead of the command surface.
**14 major playable systems are fully or partially modeled with zero implemented commands.**

---

## Fully modeled, zero commands

### 1. Auction / Market (MarketListing + MarketPurchase)

```prisma
model MarketListing {
  isAuction     Boolean   @default(false)
  currentBid    Int?
  buyoutPrice   Int?
  bids          Json?
  auctionEndsAt DateTime?
  type          String         // "pokemon" | "card" | "item"
  itemData      Json           // what's being sold
  price         Int
  status        String         // "active" | "sold" | "cancelled"
}
model MarketPurchase { ... }
```

**Commands needed:**
- `/market list <type> <id> <price>` — create listing
- `/market browse [type] [page]` — paginated embed
- `/market buy <listing_id>` — instant buy
- `/auction place <type> <id> <startBid> <duration>` — create auction
- `/auction bid <listing_id> <amount>` — place bid
- `/auction end <listing_id>` — admin/owner force-end
- `/auction view <listing_id>` — current bid status

**Zero schema changes required.** Effort: ~4 command files.

---

### 2. Coin-based trade offers (Trade model)

```prisma
model Trade {
  initiatorCoins Int  @default(0)
  receiverCoins  Int  @default(0)
  initiatorItems Json?   // card/item data
  receiverItems  Json?
  initiatorConfirmed Boolean
  receiverConfirmed  Boolean
}
```

Current `/trade` only trades Pokémon (TradePokemon). The schema supports coin + item component in the same trade. Command needs updating to expose `initiatorCoins` and card offers.

**Commands needed (extend `/trade`):**
- Add `coins: <amount>` option to /trade to sweeten with PokéCoins
- Add `card_id: <id>` option to include a card in the offer

**Zero schema changes required.** Effort: update 1 file (`trade.ts`).

---

### 3. Game Events (Event model)

```prisma
model Event {
  name        String
  type        String       // e.g. "double_xp", "shiny_boost", "legendary_festival"
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean
  rewards     Json?
  bonuses     Json?
}
```

This table exists but no job reads it and no command creates events.

**Commands needed:**
- `/admin event create <name> <type> <start> <end>` — create event
- `/event current` — shows active event bonuses
- Event job (extend `jobService.ts`): check `isActive` events and apply bonuses to spawn rates, XP multipliers

**Zero schema changes required.** Effort: 1 command + 1 job extension.

---

### 4. Audit Log (AuditLog model)

```prisma
model AuditLog {
  action      String     // "BAN", "KICK", "WARN", "TIMEOUT", "PURGE"
  targetId    String?
  moderatorId String?
  reason      String?
  metadata    Json?
}
```

`AuditLog` records are created nowhere in the current codebase (grep for `auditLog.create` returns 0 results). The mod log channel ID is stored in `Guild.modLogChannelId` but never posted to.

**Commands needed:**
- Write to `AuditLog` in each mod command after the Discord action
- Post an embed to `guild.modLogChannelId` (if set) after each mod action

**Zero schema changes required.** Effort: add ~5 lines per mod command + 1 embed helper.

---

### 5. Pokemon IV/EV + Nature stats (UserPokemon)

```prisma
model UserPokemon {
  ivHp, ivAttack, ivDefense, ivSpAttack, ivSpDefense, ivSpeed  // 0-31 each
  evHp, evAttack, evDefense, evSpAttack, evSpDefense, evSpeed  // 0-252 each
  nature  String @default("Hardy")
}
```

Functions `calcPokemonStats()`, `calcStat()`, `calcHp()`, `randomIV()`, `randomNature()` all exist in `src/utils/pokemon.ts`. IVs are generated on catch (`spawnService.ts` sets `ivHp: randomIV()` etc.). They are stored but **never shown to the user**.

**Commands needed:**
- Extend `/box` list: add IV total + shiny icon per entry
- Add `/pokemon inspect <id>` subcommand: full stat block (IV/EV/nature/calc'd stats)
- Show `calcPokemonStats()` result in `/battle` embed (actual stats, not guesses)

**Zero schema changes required.** Effort: update 2 files (`box.ts`, `battle.ts`) + 1 new subcommand.

---

### 6. Pokemon leveling (UserPokemon.level + xp)

```prisma
model UserPokemon {
  level  Int  @default(1)
  xp     Int  @default(0)
}
```

`xpToNextLevel(level)` and `levelFromXp(xp)` exist. Pokemon XP is never incremented (no code calls `prisma.userPokemon.update({ xp: { increment: N } })`).

**Commands needed (zero):** Wire in `battleService.ts` → after each battle round, grant XP to the active Pokémon. If `xp >= xpToNextLevel(level)`: increment level, optionally announce evolution threshold.

**Zero schema changes required.** Effort: 10 lines in `battleService.ts`.

---

### 7. Job leveling (UserJob.level)

```prisma
model UserJob {
  jobName     String
  level       Int     @default(1)
  totalEarned Int     @default(0)
  timesWorked Int     @default(0)
}
```

`/work` creates/updates `UserJob` but never increments `level` and never uses it to calculate earnings multiplier.

**Gap:** Add level increment every 10 uses. Apply `earningsMultiplier = 1 + (level × 0.1)`. Show job level in `/work` reply.

**Zero schema changes required.** Effort: ~8 lines in `work.ts`.

---

### 8. Card market value (Card.marketValue)

```prisma
model Card {
  marketValue Float?
}
```

`marketValue` is in the schema, but `pokemonTcgService.ts` never persists `tcgplayer.prices.market` to it. `/collection` never shows total value.

**Gap:** In `openPack()` and `searchCards()`: persist `tcgplayer?.prices?.market?.mid` to `Card.marketValue`.
In `/collection`: sum `UserCard.quantity × Card.marketValue` and show as footer.

**Zero schema changes required.** Effort: 3 lines to persist + 1 line for collection total.

---

## Partially modeled — minor schema additions needed

### 9. Monthly rewards (User.monthlyStreak + lastMonthly)

Schema: `monthlyStreak Int`, `lastMonthly DateTime?` — complete.
Missing: `/monthly` command (copy `/weekly`, extend cooldown to 30 days).
**Effort: 30 min.** Copy `weekly.ts`, change cooldown from 7 days to 30 days, use `monthlyStreak`.

---

### 10. Weekly streak display

Schema: `weeklyStreak Int`, `lastWeekly DateTime?` — complete.
`/weekly` exists but does NOT show `weeklyStreak` in the embed (only the reward).
**Effort: 5 min.** Add `{ name: '📅 Weekly Streak', value: ... }` field to `/weekly` reply.

---

### 11. Leaderboard — collection value type

`/leaderboard` supports `pokemon`, `balance`, `battles`, `cards` types.
Missing: `type:collection_value` — sum `UserCard.quantity × Card.marketValue ORDER BY desc`.
**Requires:** Card.marketValue to be populated (gap #8 above). Once that's done, effort = 1 extra case in `leaderboard.ts`.

---

### 12. Shiny and legendary leaderboards

`User.shinyCaught` and `User.legendariesCaught` are tracked but not surfaced in `/leaderboard`.
**Effort: 2 extra cases.** Add `type:shinies` and `type:legendaries`.

---

### 13. Ranked tier badges

`User.rankedTier` (Bronze/Silver/Gold/Platinum/Diamond/Master) is stored.
`/profile` shows tier with an emoji. No image badge generated (compare: dank-bot generates rank badge PNGs via canvas).
**Effort (P3):** Add `rankBadgeGenerator.ts` using `canvas`. Return badge image in `/profile`.

---

### 14. Guild mod log channel

`Guild.modLogChannelId` stored but nothing ever posts to it.
All 9 mod commands complete their action with no audit trail in Discord.
**Effort: 1 helper function** `postModLog(client, guildId, action, embed)`. Call from each mod command.

---

## Highest-ROI commands to build next

| Priority | Feature | Schema ready? | Effort | Impact |
|---|---|---|---|---|
| 🔴 1 | `/buy <item>` | ✅ complete | 1h | Closes economy loop — shop is dead without it |
| 🔴 2 | `/market` browse/list/buy | ✅ complete | 3h | Opens P2P Pokemon + card trading |
| 🔴 3 | `/auction` place/bid/end | ✅ complete | 4h | Card rarity price discovery; social bidding |
| 🔴 4 | Show IVs in `/box` + `/pokemon inspect` | ✅ complete | 2h | Exposes hidden depth players never see |
| 🟡 5 | Wire `addXp()` to battle wins + level announce | ✅ complete | 1h | Progression feedback loop from battles |
| 🟡 6 | Pokemon XP from battles | ✅ complete | 1h | Makes individual Pokémon feel alive |
| 🟡 7 | Card `marketValue` persist + collection total | ✅ complete | 30m | Enables collection value leaderboard |
| 🟡 8 | Mod log channel posts | ✅ complete | 1h | Server admin quality-of-life |
| 🟡 9 | `/monthly` command | ✅ complete | 30m | Monetizes monthly retention |
| 🟡 10 | Job level progression in `/work` | ✅ complete | 30m | Adds depth to main coin grind |
| 🟡 11 | `/unban` | ✅ complete | 30m | Completes moderation toolkit |
| 🟡 12 | `/pay` coin transfer | ✅ complete | 30m | Social economy lubricant |
| 🟢 13 | Legendary Hunt system | needs 1 table | 4h | High social/retention — public shared goal |
| 🟢 14 | Game Corner (/gamecorner) | needs 1 table | 4h | Economy sink; coins drain = deflation control |
| 🟢 15 | PokéPass (battle pass) | needs 2 tables | 8h | Top retention mechanic |

**Total zero-schema-change work: items 1-12 = ~15h. All playable today.**
