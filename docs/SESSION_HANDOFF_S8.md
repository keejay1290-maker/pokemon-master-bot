# Session Handoff — S8 → S9
> Date: 2026-06-14 | Last commit: see git log | Branch: main

---

## ⚠️ CRITICAL: DB Migration Required Before Bot Is Production-Safe

The `user_inventory` table does NOT exist in production PostgreSQL yet. Every `/buy`, `/inventory`, Shiny Charm trigger, and Amulet Coin trigger will **crash** until you run:

```bash
# From project root, with DATABASE_URL pointing to Railway Postgres
npm run db:push
```

Or if the project uses migration history:
```bash
npx prisma migrate deploy
```

Do this immediately after S8 push. Railway auto-deploys the code change; the schema migration is SEPARATE.

---

## What Was Done in S8

### P0 — Professor Oak Fix (SHIPPED)

**Root cause confirmed and fixed.** The `interactionCreate.ts` framework calls `setCooldown()` before `execute()`. The professor command had a manual `checkCooldown()` inside `execute()` that always found the key. Result: always busy.

Fix: removed the duplicate internal cooldown. Increased `command.cooldown` to 30. Added error logging. Added explanatory fallback embed on Groq failure.

**Groq models updated:** Default is now `llama-3.3-70b-versatile`. Removed deprecated `llama-3.1-70b-versatile` and `mixtral-8x7b-32768`.

**System prompt rewritten:** Character anchoring, full domain coverage, bot command index, anti-hallucination directive.

### P1 — UserInventory System (SHIPPED)

- `prisma/schema.prisma`: added `UserInventory` model + `inventory` relation on `User`
- `npx prisma generate` run — types regenerated, tsc clean
- `/buy` now atomically stores items in `UserInventory` table
- `/inventory` command (new, 59th command): view own or another user's item inventory with effect descriptions
- Shiny Charm: bonus shiny roll at catch time (3× guild rate) in `spawnService.ts`
- Amulet Coin: 2× `/work` reward in `work.ts`

### P1 — /evolve Command (SHIPPED)

60th command (61st counting `inventory`). Finds all user Pokémon eligible to evolve (level gate met, no item evolution). Select menu → confirm → update `pokemonId` → +100 XP → achievement check.

### P0 — Pack/Collection Audit (COMPLETE)

No code bug. Root causes of UX confusion documented in `PACK_COLLECTION_AUDIT.md`. The 250-card API cap on `/v2/cards` is the main gap for large sets.

### All Documentation (COMPLETE)

9 design/audit documents written covering all P0–P3 tasks. See `EXECUTIVE_SUMMARY_S8.md` for full list.

---

## Architecture Reminders for S9

### Command Count: 61 (after S8)

Was 58 at S7 end. Added: `/inventory`, `/evolve`.

Note: `COMMAND_CONSOLIDATION_PLAN.md` targets 53 after S9 (career consolidation). Run `npm run deploy:commands` after any command structural change.

### Framework Cooldown — NEVER Duplicate

`interactionCreate.ts` sets the cooldown key BEFORE `execute()` fires. Any command that also calls `checkCooldown()` internally will ALWAYS report "busy." Only set `command.cooldown` on the Command object — never call `checkCooldown/setCooldown` inside `execute()` as well.

### UserInventory Upsert Pattern

```ts
await tx.userInventory.upsert({
  where: { userId_itemId: { userId, itemId } },
  update: { quantity: { increment: qty } },
  create: { userId, itemId, itemName, quantity: qty },
});
```

The `@@unique([userId, itemId])` on `UserInventory` is what makes this work. Do NOT use `create()` for inventory writes.

### Prisma Generate After Schema Changes

After ANY `schema.prisma` edit:
```bash
npx prisma generate       # regenerates types in node_modules
npm run db:push           # applies to connected DB
npm run build             # verify tsc clean
```

Railway Dockerfile includes `RUN npx prisma generate` in builder stage — Railway deploys regenerate automatically. The DB schema push is SEPARATE and must be done manually.

### Shiny Charm Location

Applied in `src/services/spawnService.ts` inside the button collector, after `GETDEL claim` key. Variable renamed from `isShiny` to `finalIsShiny` from that point forward. Do not add a second Shiny Charm check elsewhere.

---

## S9 Priority List

### P0 — Auction System Rework

See `docs/AUCTION_SYSTEM_REWORK.md`. Key issues:
- No ownership validation when creating listings
- Pokémon listings use embed fields, not select menus
- Outbid users not notified

### P1 — Career System V2

See `docs/CAREER_SYSTEM_V2.md`. Consolidate 6 career commands into `/career work [type]` dropdown. Wire equipment checks against `UserInventory`. Wire level scaling via `UserJob.level`. Reduces command count from 61 → ~55.

### P1 — TCG Phase 2 (/sets)

See `docs/TCG_ROADMAP_V3.md`. Add `/sets` browse command with user completion %. Add set completion achievement (10,000 coins + 500 XP). API key: `09d3c22f-db75-4f58-bd4f-e89a37b888e1`.

### P2 — AuditLog Expansion

Current: only `/giftpack` logs to AuditLog. Add logging for `/ban`, `/kick`, `/timeout`, `/purge`, `/config` changes.

### P2 — Command Consolidation

After Career V2: run `npm run deploy:commands` to unregister deleted commands. Discord does not auto-remove commands on restart.

---

## Open Technical Debt

| ID | Issue | Severity | Docs |
|----|-------|----------|------|
| AUC-REWORK | Auction no ownership validation | High | AUCTION_SYSTEM_REWORK.md |
| CAREER-V2 | Career equipment not wired | Medium | CAREER_SYSTEM_V2.md |
| TCG-PHASE2 | /sets command not built | Medium | TCG_ROADMAP_V3.md |
| CONS-S9 | 6 career commands still separate | Medium | COMMAND_CONSOLIDATION_PLAN.md |
| QUEST-SILENT | No notification on quest completion | Low | — |
| OUTBID-DM | Outbid users not notified | Low | AUCTION_SYSTEM_REWORK.md |
| RANKUP-ANNOUNCE | addXp leveledUp flag not broadcast | Low | — |
| PRICE-STALE | Market values stale after 1h | Low | TCG_ROADMAP_V3.md |
| AUDIT-LOG | Ban/kick/config not in AuditLog | Low | ADMIN_SECURITY_AUDIT_S8.md |

---

## Env Vars (Unchanged from S7)

```
DATABASE_URL           # Railway Postgres
REDIS_URL              # Railway Redis
DISCORD_TOKEN          # Bot token
DISCORD_CLIENT_ID      # For deploy:commands
GROQ_API_KEY           # Professor Oak AI
POKEMON_TCG_API_KEY    # 09d3c22f-db75-4f58-bd4f-e89a37b888e1
```

---

## File Map (S8 Additions)

```
src/commands/economy/inventory.ts   NEW — /inventory command
src/commands/pokemon/evolve.ts      NEW — /evolve command
src/commands/economy/buy.ts         MODIFIED — UserInventory upsert
src/commands/economy/work.ts        MODIFIED — Amulet Coin 2× multiplier
src/commands/utility/professor.ts   MODIFIED — cooldown fix + fallback
src/services/groqService.ts         MODIFIED — new models + system prompt
src/services/spawnService.ts        MODIFIED — Shiny Charm at catch time
prisma/schema.prisma                MODIFIED — UserInventory model

docs/PROFESSOR_OAK_INCIDENT.md
docs/PROFESSOR_OAK_AI_AUDIT.md
docs/PACK_COLLECTION_AUDIT.md
docs/TRAINER_VS_TCG_PROGRESSION.md
docs/AUCTION_SYSTEM_REWORK.md
docs/CAREER_SYSTEM_V2.md
docs/COMMAND_CONSOLIDATION_PLAN.md
docs/ADMIN_SECURITY_AUDIT_S8.md
docs/TCG_ROADMAP_V3.md
docs/EXECUTIVE_SUMMARY_S8.md
docs/SESSION_HANDOFF_S8.md          (this file)
docs/TASKS_NEXT_SESSION.md
```
