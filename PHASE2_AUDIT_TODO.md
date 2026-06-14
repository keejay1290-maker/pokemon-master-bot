# PHASE 2 — Pokemon Master Bot Audit
**Project:** pokemon-master-bot  
**Status:** BLOCKED — do not begin until Phase 1 (runtime incident) is resolved and service is confirmed healthy.  
**Created:** 2026-06-14

---

## GATE

Phase 2 does not begin until:
1. Railway instance is RUNNING (not EXITED)
2. HTTP `/health` returns 200
3. Discord slash commands are responsive
4. Phase 1 investigation is closed with a documented root cause

---

## PHASE 2 TASK LIST

### Audit — Slash Command Correctness
- Verify all slash commands registered in `commands/` execute without error
- Verify responses render correctly in Discord
- Verify ephemeral vs. public replies are appropriate per command type

### Audit — Permission Enforcement
- Identify all admin-only, owner-only, and moderator-only commands
- Verify each is gated with correct permission checks
- Confirm dangerous commands (ban, kick, mute, purge, economy admin, spawn admin) require appropriate roles/permissions

### Audit — Command Descriptions & Help Text
- Review all `setDescription()` strings for clarity and accuracy
- Compare description quality against dankbot conventions
- Flag commands with descriptions that are vague, misleading, or truncated

### Audit — Feature Parity vs. dankbot
- Identify commands or systems present in dankbot that pokemon-master-bot is missing or equivalent to
- Note: comparison is against dankbot's own standard, not against external bots

### Audit — UX Gaps
- Identify missing error messages, missing feedback, or silent failures in slash command responses
- Review button/select menu routing for completeness

### Produce Enhancement Report
- Document findings as prioritized items (🔴 / 🟡 / 🟢)
- Store in a separate `AUDIT_REPORT.md` file

---

## IMPORTANT

Do NOT mix Phase 2 audit findings into:
- `EVIDENCE_LOG.md`
- `INVESTIGATION_SUMMARY.md`
- `NEXT_SESSION_TASKS.md`

Phase 2 items belong only in this file and `AUDIT_REPORT.md` when created.
