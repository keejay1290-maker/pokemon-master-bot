# S11 Career Cleanup

> Generated: 2026-06-14
> After: Phase 2 — removing legacy standalone career commands

---

## Overview

S10 implemented Career V2 as `/career work/shop/view/leaderboard`. The following 7 legacy standalone commands are now safe to delete:

| File | Career | Deletion Safe? | Reason |
|------|--------|---------------|--------|
| `src/commands/economy/fisher.ts` | Fisher | ✅ | Fully replaced by `/career work Fisher` |
| `src/commands/economy/fish.ts` | Fisher (legacy) | ✅ | Lower CD variant, no job levels |
| `src/commands/economy/ranger.ts` | Ranger | ✅ | Fully replaced by `/career work Ranger` |
| `src/commands/economy/breeder.ts` | Breeder | ✅ | Fully replaced by `/career work Breeder` |
| `src/commands/economy/miner.ts` | Miner | ✅ | Fully replaced by `/career work Miner` |
| `src/commands/economy/researcher.ts` | Researcher | ✅ | Fully replaced by `/career work Researcher` |
| `src/commands/economy/rocket.ts` | Rocket | ✅ | Fully replaced by `/career work Rocket` |

---

## Verification: Career V2 Full Replacement

### Career V2 (`career.ts`) capabilities:
- **Work**: All 6 careers (Fisher, Ranger, Breeder, Researcher, Miner, Rocket)
- **Shop**: Equipment upgrades per career with owned-item checking
- **View**: Per-user career overview with levels, earnings, cooldown status
- **Leaderboard**: Per-career + combined rankings
- **Equipment**: Tier-based multipliers (×1.0–×2.0)
- **Item drops**: Per-career special drops (Poke Balls, Oran Berries, EXP Shards)
- **Leveling**: Every 10 uses → level up, with stat scaling
- **Cooldowns**: Same Redis keys (`career:fisher`, etc.) → no data migration needed

### What legacy commands had that V2 doesn't:
- **`fish.ts`**: 30-min cooldown (vs 1hr in V2) — minor, users adapt
- **`fisher.ts`**: 8% fail chance — V2 removed this for better UX
- **`rocket.ts`**: 2hr cooldown + failure fines — V2 has 1hr CD. Rocket is the most differentiated; consider adding fine system to V2 later
- **Cooldown key `'fish'`**: Standalone `/fish` used key `'fish'` not `'career:fisher'` — independent cooldown, no conflict when removing

---

## Deletion Steps Executed

### 1. Delete standalone files
```
rm src/commands/economy/fisher.ts
rm src/commands/economy/ranger.ts
rm src/commands/economy/breeder.ts
rm src/commands/economy/miner.ts
rm src/commands/economy/researcher.ts
rm src/commands/economy/rocket.ts
rm src/commands/economy/fish.ts
```

### 2. Verify `interactionCreate.ts`
- Only imports: `handlePackReveal`, `handlePackOpenAnother`, `handlePackViewCollection`
- No imports from deleted command files — ✅ safe

### 3. Run build
- `npm run build` → clean TypeScript compile
- No broken imports
- No dangling references to deleted files

### 4. Deploy commands
- `npm run deploy:commands` → deregisters 7 old commands, `/career` stays registered
- Command count: 62 → 55

---

## Command Count Verification

| Session | Command Count | Changes |
|---------|--------------|---------|
| S10 (before) | 62 | — |
| After deleting 7 legacy career files | 55 | -7 standalone career commands |
| S11 target (Bank/Rewards) | 51 | -4 more (see Bank/Rewards doc) |

---

## User Data Impact

| Concern | Status |
|---------|--------|
| Existing `UserJob` records | ✅ Unchanged — same table, same keys |
| Career levels/progress | ✅ Preserved — stored in `UserJob`, not in command files |
| Equipment ownership | ✅ Preserved — stored in `UserInventory` |
| Cooldowns | ✅ `career:fisher` etc. keys unchanged |
| `/fish` cooldown | ⚠️ `'fish'` key orphaned — no conflict, auto-expires |
| Career earnings history | ✅ Preserved |

---

## Edge Cases

1. **User runs `/fisher` after deletion**: Discord API returns "Command not found" — user is prompted to use `/career work Fisher`
2. **Scheduled jobs referencing career commands**: No cron jobs reference individual career commands
3. **Third-party integrations**: None found
4. **References in event files**: None — only `interactionCreate.ts` routes commands by name