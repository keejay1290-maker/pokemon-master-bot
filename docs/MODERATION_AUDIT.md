# MODERATION AUDIT — S4
Generated: 2026-06-14 | Session S4

---

## Permission Gates

Every mod command enforces permissions at the Discord API level via `PermissionFlagsBits`. None rely on role name checks.

| Command | Permission Required | Implementation |
|---|---|---|
| /ban | `BanMembers` | `setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)` |
| /kick | `KickMembers` | `setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)` |
| /lock | `ManageChannels` | `setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)` |
| /purge | `ManageMessages` | `setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)` |
| /slowmode | `ManageChannels` | `setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)` |
| /timeout | `ModerateMembers` | `setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)` |
| /unban | `BanMembers` | `setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)` |
| /unlock | `ManageChannels` | `setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)` |
| /warn | `ModerateMembers` | `setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)` |
| /warnings | `ModerateMembers` | `setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)` |

All permissions are guild-scoped and non-overrideable by members — Discord enforces them server-side before the interaction reaches the bot.

---

## Mod Log Status

`moderationService.ts → logModAction()` writes an `AuditLog` row and posts an embed to `guild.modLogChannelId` (configured via /config).

| Command | logModAction | Action String | Notes |
|---|---|---|---|
| /ban | ✅ Yes | `'BAN'` | Reason forwarded |
| /kick | ✅ Yes | `'KICK'` | Reason forwarded |
| /timeout | ✅ Yes | `'TIMEOUT'` | Duration forwarded |
| /warn | ✅ Yes | `'WARN'` | Reason + severity forwarded |
| /unban | ✅ Yes | `'UNBAN'` | S4 new — validates snowflake ID before guild.bans.remove() |
| /lock | ❌ No | — | Channel ops not typically mod-logged |
| /unlock | ❌ No | — | Same |
| /slowmode | ❌ No | — | Same |
| /purge | ❌ No | — | Same |

Coverage: 5/9 action commands (channel ops excluded by design).

---

## AuditLog Schema

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  guildId    String
  action     String   // BAN | KICK | TIMEOUT | WARN | UNBAN
  targetId   String
  moderatorId String
  reason     String?
  createdAt  DateTime @default(now())
}
```

Indexes: `guildId`, `targetId` — queries for `/warnings` use `targetId` filter.

---

## /unban Implementation (S4 new)

```
Input: user_id (String, required), reason (String, optional)
Validation: /^\d{17,20}$/ snowflake regex
Action: guild.bans.remove(userId, reason)
Log: logModAction({ action: 'UNBAN', targetId: userId, ... })
Error: Replies ephemeral on Discord API error (user not banned, invalid ID, etc.)
```

---

## S5 Recommendations

1. Add logModAction to /lock, /unlock, /slowmode, /purge with action strings `LOCK`/`UNLOCK`/`SLOWMODE`/`PURGE` — useful for channel audit trails.
2. `/warnings` could support a `page` option — users with many warnings truncate.
3. Consider warn threshold auto-action: e.g., 3 warns → auto-timeout.
