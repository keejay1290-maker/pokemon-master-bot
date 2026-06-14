# S5 Permission Audit
Date: 2026-06-14 | Session: S5

---

## Permission Model

Discord's `setDefaultMemberPermissions(PermissionFlagsBits.X)` is enforced at the Discord API level — users without the required permission cannot even see the command option. This is the correct approach.

---

## Moderation Command Audit

| Command | Permission Required | Enforcement Layer | Mod Log | Runtime Guard |
|---------|-------------------|------------------|---------|--------------|
| /ban | `BanMembers` | Discord API ✅ | ✅ logModAction | `member.bannable` check |
| /unban | `BanMembers` | Discord API ✅ | ✅ logModAction | snowflake regex |
| /kick | `KickMembers` | Discord API ✅ | ✅ logModAction | `member.kickable` check |
| /timeout | `ModerateMembers` | Discord API ✅ | ✅ logModAction | `member.moderatable` check |
| /warn | `ModerateMembers` | Discord API ✅ | ✅ logModAction | None needed |
| /warnings | `ModerateMembers` | Discord API ✅ | No | None needed |
| /lock | `ManageChannels` | Discord API ✅ | No | ChannelType guard |
| /unlock | `ManageChannels` | Discord API ✅ | No | ChannelType guard |
| /slowmode | `ManageChannels` | Discord API ✅ | No | ChannelType guard |
| /purge | `ManageMessages` | Discord API ✅ | No | Channel.bulkDelete |

---

## Admin Command Audit

| Command | Permission Required | Enforcement |
|---------|-------------------|-------------|
| /config | `Administrator` | Discord API ✅ |

---

## Economy / Gameplay

All economy commands are intentionally open to all users — no permission gate is correct for gameplay commands.

---

## Security Model (Verified)

```
Owner / Server Owner
  └─ All permissions by default (Discord)

Administrator role
  └─ /config (Administrator)
  └─ /ban, /unban, /kick (BanMembers implicit)
  └─ /timeout, /warn, /warnings (ModerateMembers implicit)
  └─ /lock, /unlock, /slowmode (ManageChannels)
  └─ /purge (ManageMessages)

Moderator role (if assigned BanMembers, ModerateMembers)
  └─ /ban /unban /kick /timeout /warn /warnings

Member (no special permissions)
  └─ All economy, pokemon, social, card commands only
  └─ Cannot see moderation commands (Discord hides them)
```

---

## Findings

### PASS: All moderation commands gate-enforced
Every mod command uses `setDefaultMemberPermissions()` which Discord enforces at the API level. A user without the permission cannot invoke the command regardless of bot-side logic.

### PASS: Runtime safety checks exist
- `/ban` — checks `member.bannable` before executing
- `/kick` — checks `member.kickable` before executing
- `/timeout` — checks `member.moderatable` before executing
- `/unban` — validates snowflake format with regex

### MINOR: Channel-ops not in mod log
`/lock`, `/unlock`, `/slowmode` don't write `AuditLog`. Low impact since these are server-level operations already tracked by Discord's own audit log.

**Recommendation (S6):** Add `logModAction(client, guildId, 'LOCK', channelId, moderatorId, reason)` to lock.ts and unlock.ts. This is purely additive.

### PASS: No privilege escalation risk
- `/config` requires `Administrator` — cannot be invoked by members
- No economy command can modify Guild settings
- P2P transfer (`/pay`) validates sender balance before transfer and uses DB transaction
- Rob uses configurable guild success rate, not user-controllable

---

## Summary: PASS
Permission model is sound. No security gaps found. 10/10 moderation commands have correct Discord-level permission gates.
