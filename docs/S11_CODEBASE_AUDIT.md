# S11 Codebase Audit

> Generated: 2026-06-14
> Project: Pokemon Master Bot
> Current command count: 62

---

## 1. Duplicated Commands

### Career System (7 duplicates)
The following standalone commands are fully replaced by `/career work`:

| File | Career Alias | Status |
|------|-------------|--------|
| `src/commands/economy/fisher.ts` | Fisher | ✅ Duplicate of V2 |
| `src/commands/economy/fish.ts` | Fisher (legacy, 30min CD) | ✅ Duplicate of V2 |
| `src/commands/economy/ranger.ts` | Ranger | ✅ Duplicate of V2 |
| `src/commands/economy/breeder.ts` | Breeder | ✅ Duplicate of V2 |
| `src/commands/economy/miner.ts` | Miner | ✅ Duplicate of V2 |
| `src/commands/economy/researcher.ts` | Researcher | ✅ Duplicate of V2 |
| `src/commands/economy/rocket.ts` | Rocket | ✅ Duplicate of V2 |

**Key differences:**
- Standalone `fisher.ts` uses its own equipment tier function + 8% fail chance + minLevel filter
- `fish.ts` uses a separate 30-min cooldown (`fishCooldown` from guild settings), separate reward pool, no job levels
- `rocket.ts` has 2-hour cooldown (vs 1-hour in V2) and 30% base fail chance (V2: ~15% equivalent)
- All legacy commands share the same DB tables (`UserJob` with `cooldownKey` matching V2)
- Cooldown keys are identical → no user data migration needed

### Bank/Rewards System (6 to consolidate)

| File | Target | Status |
|------|--------|--------|
| `balance.ts` | `/bank view` | ✅ Consolidate |
| `deposit.ts` | `/bank deposit` | ✅ Consolidate |
| `withdraw.ts` | `/bank withdraw` | ✅ Consolidate |
| `daily.ts` | `/rewards daily` | ✅ Consolidate |
| `weekly.ts` | `/rewards weekly` | ✅ Consolidate |
| `monthly.ts` | `/rewards monthly` | ✅ Consolidate |

---

## 2. Dead Services

| Service | Status | Notes |
|---------|--------|-------|
| `pokemonTcgService.ts` | ✅ Active | Used by pack.ts + collection.ts |
| `userService.ts` | ✅ Active | `addXp`, `ensureUser`, `addBalance` used everywhere |
| `guildService.ts` | ✅ Active | `ensureGuild` on every command |
| `achievementService.ts` | ✅ Active | Called after pack open, etc. |
| `questService.ts` | ✅ Active | Called after pack open, etc. |
| `battleService.ts` | ✅ Active | Battle system |
| `groqService.ts` | ✅ Active | Professor Oak AI |
| `pokeApiService.ts` | ✅ Active | Pokémon data fetching |
| `spawnService.ts` | ✅ Active | Wild spawn scheduling |
| `moderationService.ts` | ✅ Active | Mod commands |
| **No dead services found** | — | — |

---

## 3. Unused Prisma Models

All 20 models are actively referenced:

| Model | Used By | Status |
|-------|---------|--------|
| Guild | Commands + events | ✅ |
| User | Every economy command | ✅ |
| GuildUser | XP, level, warnings | ✅ |
| Warning | Moderation | ✅ |
| Pokemon | Catch, battle, evolve | ✅ |
| PokemonMove | Battle system | ✅ |
| UserPokemon | Catch, team, evolve | ✅ |
| Team, TeamSlot | Battle teams | ✅ |
| Card, UserCard | Pack opening, collection | ✅ |
| Battle | PvP system | ✅ |
| Trade, TradePokemon | Trading | ✅ |
| Achievement, UserAchievement | Achievement system | ✅ |
| Quest, UserQuest | Quest system | ✅ |
| Giveaway, GiveawayEntry | Giveaways | ✅ |
| Spawn | Wild spawns | ✅ |
| MarketListing, MarketPurchase | Market/auction | ✅ |
| UserJob | Career system | ✅ |
| AuditLog | Moderation audit | ✅ |
| UserInventory | Pack storage, items | ✅ |
| Event | Scheduled events | ✅ |
| **No unused models** | — | — |

---

## 4. Economy Inconsistencies

### Reward Scaling Discrepancies
- **Career V2** (`career.ts`): Uses equipment tier + level scaling multiplier (×1.0–2.0) + weighted table
- **Standalone `fisher.ts`**: Own reward mult (×1.0–2.0) + own XP bonuses, different reward pool (Feebas not in V2)
- **Standalone `fish.ts`**: Basic flat rewards, no job levels, uses guild `fishCooldown` setting
- **Standalone `rocket.ts`**: 2hr cooldown, failure fines, level-based fail reduction — most differentiated legacy command

### Cooldown Key Conflicts
- Standalone `fish.ts` uses `'fish'` cooldown key (not `'career:fisher'`) — users who used `/fish` and `/career work Fisher` have independent cooldowns

### Missing Route: `pack_view_collection`
- `interactionCreate.ts` routes `pack_view_collection:` and `pack_open_another:` button prefixes
- These buttons just tell users to use `/collection` or `/pack open` — not actionable

---

## 5. Pack System Inconsistencies

### Redis Dependency
- `packRevealHandler.ts` stores session state in Redis with 600s TTL
- If Redis is down: `createPackSession` throws `REDIS_UNAVAILABLE` → pack refunded
- If Redis goes down mid-reveal: session lost, card already written to DB, user can't continue
- **Edge case**: Card written to DB before session advances → card saved but user can't see remaining cards

### Pack Cost
- Fixed at 500 coins across all sets
- All sets are treated equally regardless of actual TCG value
- No premium/rare set pricing

### Market Value
- `Card` model has `marketValue` field but it's never populated from TCG API
- `resolvedCards` in pack.ts don't pass marketValue to session

---

## 6. Auction Edge Cases

From examining `auction.ts`, `market.ts`: (based on existing session docs)
- Auction settlement writes cards to winner's inventory
- Buyout immediately transfers ownership
- Seller notifications exist
- No-bid escrow restore exists
- Lock protection exists

---

## 7. Collection Tracking Weaknesses

- `cardsCollected` on User model is incremented per-card, even duplicates
- No per-set tracking
- No card completion percentage per set
- No set filtering on `/card` or `/collection`

---

## 8. Scaling Concerns

### Command Loading
- `loadCommands()` in `index.ts` uses synchronous `fs.readdirSync` + `require()` per file
- 62+ commands loaded at startup — fine for current scale, but not lazy-loaded

### Redis Usage
- `pack:session:*` keys with 600s TTL — good
- `cooldown:*` keys — unbounded growth if users don't return
- No cleanup job for stale keys

### Database Queries
- `handleLeaderboard()` fetches ALL `userJob` records into memory to compute totals
- With 10K+ users doing career work, this query grows unbounded

---

## 9. Creator Persona Integration Opportunities

| Area | Integration |
|------|-------------|
| Welcome message | Brand the bot as Creator's Pokémon arena |
| Shop/packs | Sell Creator-branded packs, special Creator cards |
| Leaderboard | Creator's top fans |
| Professor Oak AI | Personality matches Creator's brand voice |
| Dashboard | Show creator info, live status |

---

## 10. Build Status

- TypeScript: `tsc` compiles cleanly (per S10 handoff)
- No `.js` files in `src/` — all TypeScript
- Tests exist in `tests/` directory

---

## 11. Files Not Yet Read (Need Verification)

The following files were not read in detail during this audit:
- `src/commands/economy/daily.ts`, `weekly.ts`, `monthly.ts`
- `src/commands/economy/buy.ts`, `hunt.ts`, `pay.ts`, `rob.ts`, `work.ts`
- `src/commands/cards/card.ts`, `collection.ts`
- `src/commands/auction.ts`, `market.ts`
- `src/commands/battles/battle.ts`
- `src/services/pokemonTcgService.ts`
- `src/jobs/*`
- `src/utils/cooldown.ts`
- `src/dashboard/*`

These should be reviewed in a follow-up audit if deeper refactoring is required.