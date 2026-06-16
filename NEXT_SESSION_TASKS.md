# NEXT SESSION TASKS
**Project:** pokemon-master-bot  
**Scope:** This file applies ONLY to the pokemon-master-bot repository and Railway project.  
**Updated:** 2026-06-16 (Session 18 — Career Rework Audit)

---

## CURRENT STATE

- S18 Career Rework implemented and audited
- TypeScript compiles cleanly (`npx tsc --noEmit` → NO ERRORS)
- Railway instance status: UNKNOWN (previously EXITED per S15 handoff — needs verification)
- 3 bugs found in career system (pricing + missing items)

---

## S18 AUDIT SUMMARY

**Full audit:** `docs/S18_CAREER_AUDIT.md`  
**Classification:** ⚠️ Needs Improvements — functionally complete, 3 bugs to fix

### 🔴 Bugs to Fix

1. **`master_rod` missing from `/shop` and PricingService** — Fisher tier 4 item only purchasable via `/career shop fisher`. Add `master_rod` to PricingService and shop.ts Career Tools category.

2. **Price discrepancy between `/shop` and `/career shop`** — Same items sold at different prices:
   - Good Rod: 500💰 (PricingService) vs 2,000💰 (career shop)
   - Super Rod: 1,500💰 (PricingService) vs 8,000💰 (career shop)
   - **Decision needed:** Align to one price source. Recommend removing career tools from `/shop` and making `/career shop` the exclusive purchase path.

3. **`drill` item orphaned** — In shop.ts (1,000💰) and PricingService but not referenced by any career system. Remove it.

### 🟡 Tech Debt

4. Remove Breeder items from shop.ts and PricingService.ts
5. Fix emoji typo in scenarios.ts line 219 (` artifact` → proper emoji)
6. Consolidate CooldownService class with utils/cooldown.ts
7. Remove Breeder color from guildService.ts

---

## PRIORITY 1 — Fix S18 Bugs

### Task 1A — Align Career Shop Prices

**Goal:** Resolve the pricing inconsistency between `/shop` and `/career shop`.

**Recommended approach:** Remove career tools from the main `/shop` Career Tools category. The `/career shop` is the intended purchase path with balanced prices. This avoids:
- Price exploits (buying cheap in /shop)
- Maintenance of two price sources
- Confusion for players

**Files to modify:**
- `src/commands/economy/shop.ts` — Remove `career` category or strip career items
- `src/services/PricingService.ts` — Mark career items as deprecated or remove

### Task 1B — Add `master_rod` to PricingService

**If keeping `/shop`:** Add `master_rod` entry to PricingService.ts and shop.ts Career Tools ids array.

### Task 1C — Remove Orphaned `drill` Item

**Files:** `shop.ts` (remove from career ids), `PricingService.ts` (remove entry)

---

## PRIORITY 2 — Railway Infrastructure

### Task 2A — Verify Bot Running

```bash
railway status
railway logs --tail 20
```

### Task 2B — Deploy if Needed

```bash
git push origin master  # triggers auto-deploy
railway logs --latest
```

### Task 2C — Re-register Slash Commands

After deploying, run `/deploy-commands` or:
```bash
npx tsx src/deploy-commands.ts
```
This ensures `/work` and updated `/career` are registered with Discord.

---

## PRIORITY 3 — Tech Debt (Future Session)

1. Remove Breeder items from shop.ts and PricingService.ts
2. Fix emoji typo in scenarios.ts
3. Consolidate CooldownService with utils/cooldown.ts
4. Remove Breeder color from guildService.ts

---

## KEY DOCUMENTS

| Document | Path |
|----------|------|
| S18 Career Rework Report | `docs/S18_CAREER_REWORK.md` |
| S18 Career Audit | `docs/S18_CAREER_AUDIT.md` |
| S15 Session Handoff | `docs/S15_SESSION_HANDOFF.md` |
| Career Scenario Engine | `src/services/career/scenarios.ts` |
| Work Command | `src/commands/economy/work.ts` |
| Career Command | `src/commands/economy/career.ts` |

---

## PROHIBITED ACTIONS

| Action | Reason |
|--------|--------|
| Modify Prisma schema | No migration needed for S18 |
| Change Discord token/intents | Not implicated |
| Rewrite Dockerfile | Root cause of Railway EXITED not confirmed |