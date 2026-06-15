# Tasks — Next Session (S14)

> Updated: 2026-06-15 (S13B wrap-up)
> Commit pushed this session: `1feb448` (battle damage fix + @mention AI fix)
> Start by reading: `docs/S13B_SESSION_HANDOFF.md` and `COMMON_MISTAKES.md`
> S13B produced: Battle V2 audit docs, @mention AI fix, battle damage fix, MOVE_DATA_AUDIT.md

---

## FIRST TASK — Repository Audit (DO THIS BEFORE ANYTHING ELSE)

Run: `git status`, `git log --oneline --decorate -20`, `git diff --stat`

The working tree has **many uncommitted modified and untracked files** from S11/S12:

```
Modified:  COMMON_MISTAKES.md, docs/TASKS_NEXT_SESSION.md, src/commands/cards/pack.ts
           src/handlers/packRevealHandler.ts, src/services/battleService.ts
           src/services/pokemonTcgService.ts
Deleted:   src/commands/economy/balance.ts, breeder.ts, daily.ts, deposit.ts,
           fish.ts, fisher.ts, miner.ts, monthly.ts, ranger.ts, researcher.ts,
           rocket.ts, weekly.ts, withdraw.ts
Untracked: EXECUTIVE_SUMMARY_S12.md, S12_SESSION_HANDOFF.md, docs/BANK_REWARDS_CONSOLIDATION.md
           docs/CARD_ECONOMY_REWORK.md, docs/CREATOR_DATA_PROVIDER_SYSTEM.md
           docs/CREATOR_PLATFORM_ARCHITECTURE.md, docs/MOVE_DATA_AUDIT.md
           docs/PACK_ECONOMY_V2.md, docs/PACK_OPENING_V3.md, docs/S11_CAREER_CLEANUP.md
           docs/S11_CODEBASE_AUDIT.md, docs/S12_COMMAND_REDUCTION.md
           docs/S12_PACK_STABILITY_REPORT.md, src/commands/economy/bank.ts
           src/commands/economy/rewards.ts, src/commands/social/creator.ts
           src/config/, src/providers/, src/services/cardValueService.ts
           src/services/creatorService.ts
```

For **each file**, produce the audit table from the user's audit request and determine:
1. Already committed? (check `git log`)
2. Uncommitted S12 work that should be committed?
3. Belongs to unfinished feature needing completion?
4. Safe to discard?

**Do not proceed to Battle V2 until audit is complete.**

---

## P0 — Battle V2 Lite (implement after audit)

All changes are code-only (no schema migration). Build clean, ready to implement.

### Phase 1: Accuracy System
- Wire `PokemonMove.accuracy` into attack resolution
- `checkAccuracy(moveInfo.accuracy ?? 100)` before `calcDamage()`
- If miss: log "X's attack missed!" and skip damage
- Status moves skip accuracy check (they never miss in Gen 1/2 rules)

### Phase 2: Speed-Based Turn Order Every Round
- Add `roundLeaderId: string` to `BattleState` in `src/types/index.ts`
- Set `roundLeaderId` at battle start: faster active Pokémon's owner goes first
- After each attack: if current attacker was `roundLeaderId`, next is the follower; if follower, next is `roundLeaderId` (new round starts)
- Recompute `roundLeaderId` after any Pokémon faints + is swapped (speed of new active Pokémon)
- Paralysis penalty: paralyzed Pokémon's effective speed is halved for round priority

### Phase 3: Critical Hit Display
- Already implemented in `calcDamage()` at 6.25%
- Missing: `💥 A critical hit!` in the battle log embed
- Wire: `if (isCrit) currentState.battleLog.push('💥 Critical hit!')`

### Phase 4: Status DoT (Burn/Poison applied each turn)
- `applyStatusDamage()` exists in `battleService.ts` but is NEVER called in `battle.ts`
- Call at the START of each turn, before move execution
- If status kills the Pokémon, skip their move and proceed to faint check

### Phase 5: Status Infliction (static table, not type heuristic)
- Remove `tryInflictStatus()` or replace with move-name lookup
- Extend `MOVE_TABLE` entries with optional `statusInflict?` and `effectChance?` fields
- Only named moves in the static table can inflict status — unknown moves never do
- Example table extensions:
  ```typescript
  ember:        { ..., statusInflict: 'burn', effectChance: 10 }
  thunderbolt:  { ..., statusInflict: 'paralysis', effectChance: 10 }
  toxic:        { ..., statusInflict: 'poison', effectChance: 100, category: 'Status' }
  ```

### Phase 6: Coin Rewards for Battle Win
- Add `coinReward: number` computation in `saveBattleResult()`
- Formula: 50 base + (turns × 2) + (ranked ? 100 : 0)
- Award to winner: `addBalance(client.prisma, winnerId, coinReward)`
- Show in victory embed: "You earned X coins!"

---

## P0 — S12 Carry-Forward (from previous sessions)

### Career V2 Deploy (BLOCKING — files already deleted in working tree)
The legacy career files appear deleted in `git status`. Verify they were intentionally removed. If so:
1. Check `interactionCreate.ts` has no imports of deleted files
2. `npm run build` clean
3. `npm run deploy:commands` to deregister old commands

### Redis URL on Railway (STILL BLOCKING pack open)
`REDIS_URL` not set on Railway. Pack open will fail. Add Railway Redis add-on.

### Bank + Rewards Consolidation
`bank.ts` and `rewards.ts` exist as untracked files — possibly implemented in S12.
Verify they build, then commit + deploy.

---

## Battle V2 Full (future session — needs schema work)

Do NOT implement without schema migration decision. See `docs/MOVE_DATA_AUDIT.md`.

Requirements:
- Add `statusInflict String?`, `effectChance Int?`, `priority Int @default(0)` to `PokemonMove`
- PokeAPI re-seed script: fetch `api/v2/move/{name}` for all moves, populate new fields
- ~500 API calls, ~1-2 day effort
- Enables: move-specific status effects, Quick Attack priority, recoil moves

---

## Carry-Forward Bugs

| ID | File | Description | Priority |
|----|------|-------------|----------|
| REDIS-URL-RAILWAY | Railway env | `REDIS_URL` not set → pack open broken | 🔴 P0 |
| BATTLE-SPEED-ROUND | battle.ts | Speed only determines first turn, not each round | 🔴 P0 |
| BATTLE-STATUS-DOT | battle.ts | `applyStatusDamage()` never called → burn/poison do nothing | 🔴 P0 |
| BATTLE-ACCURACY | battle.ts | `checkAccuracy()` never called → moves never miss | 🟡 P1 |
| BATTLE-STATUS-TYPE | battleService.ts | `tryInflictStatus()` uses type heuristic, should be move-specific | 🟡 P1 |
| BATTLE-CRIT-LOG | battle.ts | Crit computed but no 💥 in battle log | 🟢 P2 |
| QUEST-SILENT | questService.ts | No DM/notification on quest completion | 🟡 P1 |
| CARD-MARKETVALUE-NULL | packRevealHandler.ts | Card.marketValue never populated | 🟡 P1 |

---

## S13B Completed Deliverables

| Feature | Status | Commit |
|---------|--------|--------|
| @mention AI silent crash fix | ✅ Committed | 1feb448 |
| Battle damage formula fix | ✅ Committed | 1feb448 |
| STAB implementation | ✅ Committed | 1feb448 |
| Type effectiveness implementation | ✅ Committed | 1feb448 |
| `BattlePokemon.types[]` field | ✅ Committed | 1feb448 |
| Batch PokemonMove loading (no N+1) | ✅ Committed | 1feb448 |
| `MOVE_TABLE` static fallback (50 moves) | ✅ Committed | 1feb448 |
| Battle simulation validation script | ✅ Committed | 1feb448 |
| `docs/AI_MENTION_SYSTEM.md` | ✅ Committed | 1feb448 |
| `docs/BATTLE_SYSTEM_AUDIT.md` | ✅ Committed | 1feb448 |
| `docs/MOVE_DATA_AUDIT.md` | ⚠️ Uncommitted | pending |
| `COMMON_MISTAKES.md` (entries #09-#11) | ⚠️ Uncommitted | pending |

---

## Arch Reminders

- `addXp(prisma, userId, N)` — never raw `trainerXp: { increment: N }`
- `transferBalance` throws `'INSUFFICIENT_FUNDS'` — always catch and rollback
- `calcDamage()` in `battleService.ts` is the ONLY place damage is computed — never inline
- `PokemonMove` may be empty for most Pokémon — always fall back to `MOVE_TABLE`
- `checkStatusBlock()` must be called before move execution each turn
- `applyStatusDamage()` must be called at turn start before move execution
- Redis: always check `client.redis.isReady` before any Redis call
- Button customId prefix must be registered in `interactionCreate.ts` or silently fails
- After schema changes: `npx prisma generate` → `npm run build` → `npm run db:push`
