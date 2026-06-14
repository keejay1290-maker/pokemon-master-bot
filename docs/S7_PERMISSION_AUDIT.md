# S7 Permission Audit
> Date: 2026-06-14 | Session S7

---

## Scope

All admin-facing, moderation, and economy-management commands audited for permission gates.

---

## Command Permission Matrix

| Command | Gate | Server Owner Override | Notes |
|---------|------|-----------------------|-------|
| `/ban` | `BanMembers` | N/A (Discord handles) | ✅ Correct |
| `/kick` | `KickMembers` | N/A | ✅ Correct |
| `/timeout` | `ModerateMembers` | N/A | ✅ Correct |
| `/unban` | `BanMembers` | N/A | ✅ Correct |
| `/warn` | `ModerateMembers` | N/A | ✅ Correct |
| `/warnings` | `ModerateMembers` | N/A | ✅ Correct |
| `/lock` | `ManageChannels` | N/A | ✅ Correct |
| `/unlock` | `ManageChannels` | N/A | ✅ Correct |
| `/slowmode` | `ManageChannels` | N/A | ✅ Correct |
| `/purge` | `ManageMessages` | N/A | ✅ Correct |
| `/config` | `ManageGuild` | ✅ Yes | ✅ Correct |
| `/giveaway create` | `ManageGuild` | ✅ Yes | ✅ Added S7 — was unguarded |
| `/giveaway end` | `ManageGuild` | ✅ Yes | ✅ Correct |
| `/giveaway reroll` | `ManageGuild` | ✅ Yes | ✅ Correct |
| `/giftpack` | `Administrator` | ✅ Yes (guild.ownerId check) | ✅ New S7 — admin-only |

---

## Public Commands (Intentionally Open)

All economy commands (`/daily`, `/work`, `/fish`, `/hunt`, `/rob`, `/shop`, `/buy`, `/market`, `/auction`) are public by design — any user can participate.

All Pokémon commands (`/catch`, `/box`, `/team`, `/battle`, `/trade`, `/release`, `/nickname`) are public by design.

---

## No Public Paths to Admin Actions

Verified: no button handler or interaction path bypasses the permission checks above. All permission gates are checked at the top of the execute function before any DB writes.

---

## /giftpack Security Notes

- Requires `Administrator` permission (highest non-owner Discord permission)
- Server owner always allowed via explicit `guild.ownerId` check
- Every gift creates an `AuditLog` entry with: `action: 'GIFT_PACK'`, `targetId`, `moderatorId`, `setId`, `setName`, `quantity`, `cardsGifted`
- `MAX_QUANTITY = 20` packs per single gift invocation — prevents flooding the TCG API
- Set ID validated against live TCG API before any cards are awarded

---

## Findings

No exploitable permission gaps found. The only pre-S7 gap was `/giveaway create` being unguarded — fixed in S7.
