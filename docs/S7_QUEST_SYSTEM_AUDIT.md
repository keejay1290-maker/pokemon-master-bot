# S7 Quest System Audit
> Date: 2026-06-14 | Session S7

---

## Problem (Pre-S7)

`UserQuest.progress` never incremented. Quests were display-only — users could see them in `/quests` but they could never complete or be rewarded.

## Root Cause

No `questService.ts` existed. Nothing called any update on `UserQuest.progress` anywhere in the codebase.

---

## Solution Implemented

### New File: `src/services/questService.ts`

Exported function: `incrementQuestProgress(prisma, userId, questType, amount = 1)`

**Behaviour:**
1. Fetches all quests matching `questType` from DB
2. For each quest, `upsert` a `UserQuest` row (creates it on first encounter)
3. If `resetAt` has expired, resets progress + resetAt before proceeding
4. If already `completed`, skips
5. Increments progress by `amount`, clamped to target
6. On completion: marks `completed = true`, grants `coinReward` + calls `addXp()` for `xpReward`

**Reset logic:** `getNextReset(period)` computes next midnight (daily), next Monday 00:00 (weekly), or first of next month (monthly).

---

## Wiring Points

| Trigger | File | Quest Type | Amount |
|---------|------|-----------|--------|
| Pokémon caught | `spawnService.ts` | `catch` | 1 |
| Battle win | `battleService.ts` | `battle_win` | 1 |
| Daily claimed | `daily.ts` | `earn_coins` | `total` (base + streak bonus) |
| Pack opened | `pack.ts` | `open_pack` | 1 |

All calls are fire-and-forget (`.catch(() => {})`).

---

## Quest Seeded Types

| Quest Name | Type | Requirement | Period | XP | Coins |
|-----------|------|------------|--------|-----|-------|
| Daily Catch | `catch` | count: 5 | daily | 100 | 200 |
| Daily Battle | `battle_win` | count: 3 | daily | 150 | 300 |
| Daily Coins | `earn_coins` | amount: 1000 | daily | 75 | 150 |
| Daily Pack | `open_pack` | count: 1 | daily | 100 | 250 |
| Weekly Grind | `catch` | count: 30 | weekly | 500 | 1000 |
| Weekly Champion | `battle_win` | count: 15 | weekly | 750 | 1500 |
| Weekly Collector | `open_pack` | count: 10 | weekly | 600 | 1200 |

---

## questJob.ts Update

Previous: only reset daily quests where `completed = true`.

Updated to:
- Reset ALL daily quest records where `resetAt <= now` (complete or incomplete)
- Reset ALL weekly quest records where `resetAt <= now`
- Logs count of resets per period

---

## Remaining Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| No `trade` quest type seeded | Low | Schema supports it; add quest + wire `trade.ts` in S8 |
| No quest completion channel announcement | Low | Could DM or post to config channel on completion |
| `/quests` doesn't show completed quests | Low | Only shows `completed: false` — add a `history` subcommand in S8 |
