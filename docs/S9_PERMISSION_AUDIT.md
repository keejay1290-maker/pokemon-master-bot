# S9 Permission Audit — All Mod/Admin Commands

> Written: S9 | Audited against: actual source code
> Audit scope: every command with a non-public permission gate

---

## Audit Results

| Command | Permission Gate | Bot Hierarchy Check | Runtime Re-verify | Audit Log | Status |
|---------|----------------|--------------------|--------------------|-----------|--------|
| `/ban` | `BanMembers` | `member.bannable` ✅ | ❌ | `logModAction('BAN')` ✅ | ✅ PASS |
| `/kick` | `KickMembers` | `member.kickable` ✅ | ❌ | `logModAction('KICK')` ✅ | ✅ PASS |
| `/timeout` | `ModerateMembers` | `member.moderatable` ✅ | ❌ | `logModAction('TIMEOUT')` ✅ | ✅ PASS |
| `/warn` | `ModerateMembers` | None (warn is DB-only) | ❌ | `logModAction('WARN')` ✅ | ✅ PASS |
| `/warnings` | `ModerateMembers` | — | — | None (read-only) | ✅ PASS |
| `/unban` | `BanMembers` | — | Validates ID regex ✅ | `logModAction('UNBAN')` ✅ | ✅ PASS |
| `/purge` | `ManageMessages` | — | Channel text check ✅ | None | ⚠️ NOTE |
| `/lock` | `ManageChannels` | — | Channel text check ✅ | None | ⚠️ NOTE |
| `/unlock` | `ManageChannels` | — | Channel text check ✅ | None | ⚠️ NOTE |
| `/slowmode` | `ManageChannels` | — | Channel text check ✅ | None | ⚠️ NOTE |
| `/config` | `Administrator` | — | ❌ | None | ✅ PASS |
| `/giftpack` | `Administrator` | — | Double-check in execute ✅ | `AuditLog.create('GIFT_PACK')` ✅ | ✅ PASS |

---

## Method: `setDefaultMemberPermissions`

All commands use `setDefaultMemberPermissions(PermissionFlagsBits.X)` — Discord enforces this **before** the interaction reaches the bot. Even if a bad actor calls the bot API directly without going through the Discord client, Discord's backend rejects the interaction. This is the correct pattern for application commands.

Runtime `interaction.memberPermissions?.has(...)` checks are belt-and-suspenders, not the primary gate.

---

## Notes / Non-Blocking Issues

### ⚠️ purge, lock, unlock, slowmode — No Audit Log

These channel actions are not written to `AuditLog`. Minor risk: no traceability. Discord's built-in audit log records channel permission overwrites, so there is coverage at the Discord level. Recommended for S10: add `logModAction` calls here.

### ⚠️ /config — No Audit Log

Config changes (shiny rate, economy rewards, rob settings) are not logged. If a rogue admin changes shiny rate to 100% there is no trace. Recommended for S10: log config changes to AuditLog.

### ⚠️ giftpack double-check is redundant but harmless

`setDefaultMemberPermissions(Administrator)` already gates the command. The runtime re-check in execute() is redundant but not wrong — keep it as defence-in-depth.

---

## Economy Commands — User-Level Security

| Threat | Mitigation |
|--------|-----------|
| Rob another user's balance directly | `/rob` uses own economy logic + cooldown |
| Bypass auction ownership | Fixed S9 via select menu + re-validation |
| Pack double-open race condition | Fixed S9 via Redis SET NX lock |
| Hunt ball bypass | Fixed S9 — Pokemon flees if no balls |
| Negative balance | All balance decrements use Prisma TX or pre-check |
| Self-bidding on auction | `listing.sellerId === interaction.user.id` → reject |

---

## Pass/Fail Summary

- **PASS (12/12)** — all commands have correct Discord permission gates
- **Recommended S10 additions**: audit log for purge/lock/unlock/slowmode/config (5 commands)
- **No critical vulnerabilities found**
