# Overhaul Phase 1 Audit

Generated: 2026-06-21  
Source: `C:\Users\Shadow\Downloads\gpt prompt.txt`, current `src/**`, `prisma/schema.prisma`, and validation commands.

## Executive Summary

The project is not a blank slate. Several items from the overhaul prompt already exist in partial form: `/buy`, `/pay`, `/unban`, `UserInventory`, multi-team tables, a revised battle damage formula, dashboard `/health`, and a TCG pack inventory path.

The current blocker is not feature breadth. It is consistency and durability:

- Battle state still lives in Redis/in-memory collectors, so battles are lost on restart.
- Economy mutations are split between shared helpers, direct Prisma updates, and per-command transactions.
- Some audit docs are stale relative to source.
- Dashboard auth exists, but security hardening is incomplete.
- Typecheck and tests pass after a battle fixture update; lint still fails broadly.

## Validation Results

| Check | Result | Notes |
|---|---:|---|
| `npm run typecheck` | PASS | `tsc --noEmit` completed successfully. |
| `npm test -- --runInBand` | PASS | 4 suites, 27 tests pass after updating `tests/battle.test.ts` fixture defaults. |
| `npm run lint` | FAIL | 57 errors, 19 warnings. Most are pre-existing async handler lint rules and unused vars. |

## Command Inventory

Current source contains 49 command files:

| Category | Count |
|---|---:|
| admin | 3 |
| battles | 1 |
| cards | 3 |
| economy | 12 |
| giveaways | 1 |
| moderation | 10 |
| pokemon | 10 |
| social | 5 |
| utility | 4 |

Older docs that report 42 or 54 commands are stale. The current implementation includes commands that older audits list as missing, including `/buy`, `/pay`, `/unban`, `/inventory`, `/evolve`, `/nickname`, `/release`, `/creator`, `/cooldown`, and `/giftpack`.

## Phase 1 Command Audit Findings

### Working or Mostly Working

- Slash command dispatch is centralized in `src/events/interactionCreate.ts`.
- `ensureUser` and `ensureGuild` run before command execution.
- Cooldown support exists in both central command cooldown handling and `CooldownService`.
- `/shop` and `/buy` now share a button-driven Pokemart flow.
- `/bank deposit` and `/bank withdraw` use Prisma transactions.
- `/pay` uses a transactional `transferBalance` helper.
- `/trade` confirms by button and swaps Pokemon ownership inside a transaction.
- Moderation includes `/unban`, resolving an older command audit gap.

### Partially Working

- Many commands still rely on raw `client.redis` calls. Some have `.catch()` guards; others do not.
- `/battle` uses Redis locks and Redis battle state plus Discord collectors. It works only while the process and Redis state survive.
- `/trade` swaps Pokemon in a transaction, but creates the `Trade` audit row after the transaction. A crash between those operations loses transfer history.
- `/giftpack` updates inventory and writes an audit log, but not in a transaction.
- Economy rewards are scattered across commands and services, making balance policy hard to reason about.
- AI mention replies in `src/events/messageCreate.ts` still use embeds, while the overhaul requires natural chat messages.

### Broken or Risky

- `npm run lint` fails across many files. This should be treated as a P1 stability task before CI is enforced.
- Dashboard session secret falls back to `pokemon-master-secret-change-in-prod`. Production should hard-fail without `DASHBOARD_SECRET`.
- Dashboard guild setting updates copy allowed keys from `req.body` without Zod validation or range checks.
- Dashboard analytics and audit log routes require authentication but do not repeat the guild permission check used by `/guild/:guildId`.
- Redis unavailability still breaks several command paths, external API caches, spawns, and battles.

## Phase 1 Database Audit Findings

### Strengths

- Core ownership tables exist: `UserPokemon`, `UserCard`, `UserInventory`, `Team`, `TeamSlot`, `Trade`, `TradePokemon`.
- Unique constraints exist for several high-risk duplicate areas:
  - `GuildUser(guildId, userId)`
  - `TeamSlot(teamId, slot)`
  - `UserCard(userId, cardId, isFoil)`
  - `UserInventory(userId, itemId)`
  - `UserAchievement(userId, achievementId)`
  - `UserQuest(userId, questId)`
  - `PackSession.sessionId`

### Gaps

- Most high-read relation fields lack explicit indexes. P1 database index work is still valid.
- `Team.isActive` has no uniqueness constraint, so a user can theoretically have multiple active teams unless every write path prevents it.
- `UserPokemon.isInTeam` and `teamSlot` duplicate the newer `Team`/`TeamSlot` model and can drift.
- `Battle` stores teams and logs as JSON but does not persist per-turn actions as normalized records.
- `TradePokemon` exists, but the current `/trade` command creates only a `Trade` row after completion and does not populate the offered Pokemon rows.
- There is no generalized transaction/audit ledger for currency, item, Pokemon, or admin grants.

## Phase 1 UX Audit Findings

- The bot is embed-heavy. This is fine for inventory, battle boards, and admin panels, but conflicts with the new AI requirement.
- Battle UI is functional but limited to move buttons. It lacks switch, forfeit, explicit timeout action, replay, team preview, and battle log export.
- Collection UX exists but is not yet "Pokemon Home" level. Sorting/filtering/tagging/favorites/recent views remain future work.
- Help exists, but command reorganization is still incomplete relative to the target groups in the overhaul prompt.
- Shop UX is improved with button/select menus and no longer depends on a missing `/buy`.

## P0 Recommendations

1. Economy transaction safety
   - Create one economy ledger service for all currency changes.
   - Require positive integer validation at service boundaries.
   - Move all balance writes through transactions or atomic conditional updates.
   - Include audit records in the same transaction for trades, gifts, purchases, admin grants, rob outcomes, and battle rewards.

2. Redis state migration
   - Keep Redis as cache/lock infrastructure, not canonical state.
   - Persist battle sessions, turns, selected moves, active Pokemon, timeouts, and outcomes in PostgreSQL.
   - Persist spawn records as canonical `Spawn` rows and use Redis only for fast lookup.
   - Add a safe Redis adapter so cache outages degrade gracefully.

3. Dashboard security
   - Hard-fail production startup if `DASHBOARD_SECRET`, Discord OAuth secrets, or callback URL are missing.
   - Add Zod schemas and numeric range validation for settings.
   - Apply guild permission checks to every guild-scoped dashboard route.
   - Add CSRF protection or equivalent same-site controls for mutating routes.

## P1 Recommendations

1. Add Prisma indexes for common query paths:
   - `UserPokemon(userId)`, `UserPokemon(userId, isFavorite)`, `UserPokemon(userId, pokemonId)`
   - `Team(userId, isActive)`
   - `Battle(guildId, status)`, `Battle(challengerId)`, `Battle(opponentId)`
   - `Trade(initiatorId, status)`, `Trade(receiverId, status)`
   - `Spawn(guildId, isCaught, expiresAt)`
   - `MarketListing(guildId, status)`, `MarketListing(sellerId, status)`
   - `AuditLog(guildId, createdAt)`

2. Make lint pass before adding CI gates.
3. Add retry wrappers for PokeAPI, Pokemon TCG API, and Groq.
4. Add Zod validation to dashboard routes and command-adjacent free-text inputs.
5. Add rate limiting for dashboard/API routes and AI calls.

## Immediate Next Tasks

1. Fix lint in small batches:
   - async event callbacks
   - unused imports/vars
   - unsafe `any` in high-risk command paths

2. Implement P0 economy ledger:
   - service API
   - transaction helper
   - tests for insufficient funds and concurrent transfers
   - migrate `/pay`, `/bank`, `/shop`, `/rob`, `/pack`, battle rewards

3. Start Redis-to-database battle migration:
   - battle state persistence schema
   - repository/service abstraction
   - reconnect/resume behavior
   - tests for timeout and restart recovery

4. Convert AI mention fallback replies from embeds to plain chat messages.

5. Harden dashboard secrets and route validation.

## Files Changed In This Pass

- `tests/battle.test.ts`: added required `types` and `moveData` fixture defaults so tests match the current `BattlePokemon` contract.
- `docs/OVERHAUL_PHASE1_AUDIT_2026-06-21.md`: this audit.

