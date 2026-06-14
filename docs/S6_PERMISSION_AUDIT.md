# S6 Permission Audit
Date: 2026-06-14 | Session S6

---

## Audit Scope

All moderation and admin commands audited for:
- Discord permission gate enforcement (`setDefaultMemberPermissions`)
- No bypass paths (ephemeral/deferReply not used to skip permission check)
- Owner/admin requirement where appropriate
- Interaction-level guild check where required

---

## Moderation Command Gates (Verified)

| Command | Permission Required | Gate Location | Verified |
|---------|---------------------|---------------|----------|
| /ban | BanMembers | setDefaultMemberPermissions | ✅ |
| /unban | BanMembers | setDefaultMemberPermissions | ✅ |
| /kick | KickMembers | setDefaultMemberPermissions | ✅ |
| /timeout | ModerateMembers | setDefaultMemberPermissions | ✅ |
| /warn | ModerateMembers | setDefaultMemberPermissions | ✅ |
| /warnings | ModerateMembers | setDefaultMemberPermissions | ✅ |
| /lock | ManageChannels | setDefaultMemberPermissions | ✅ |
| /unlock | ManageChannels | setDefaultMemberPermissions | ✅ |
| /slowmode | ManageChannels | setDefaultMemberPermissions | ✅ |
| /purge | ManageMessages | setDefaultMemberPermissions | ✅ |
| /config | Administrator | setDefaultMemberPermissions | ✅ |

Total: 11 commands with Discord API-level permission gates.

---

## New S6 Commands — Permission Analysis

| Command | Restriction | Correct? |
|---------|-------------|----------|
| /release | Self-only (userId check before delete) | ✅ — users can only release their own Pokémon |
| /nickname | Self-only (userId check before update) | ✅ — users can only nickname their own Pokémon |

Both new commands correctly scope the DB query to `{ userId: interaction.user.id }` before any mutation.
A user cannot release or rename another player's Pokémon.

---

## /config Recommendation

**Current:** Administrator (`PermissionFlagsBits.Administrator`)
**Recommendation:** Keep as Administrator.

Rationale:
- `/config` sets spawn channels, economy rates, moderation toggles, and shiny rates
- These are guild-wide settings that affect all members
- Allowing guild managers to change spawn rates without Administrator would let non-owners manipulate game balance
- Guild owner can always delegate via Discord role permissions

---

## Economy Commands — Self-Protection Checks

| Risk | Check in Place |
|------|----------------|
| Pay to self | `/pay` checks `target.id !== interaction.user.id` |
| Buy own auction listing | `/auction bid` checks `listing.sellerId !== interaction.user.id` |
| Buy own market listing | `/market buy` checks `listing.sellerId !== interaction.user.id` |
| Rob self | `/rob` checks `target.id !== interaction.user.id` |

---

## Remaining Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| Market listing ownership not validated | Medium | itemData.name is free text; anyone can list "Charizard" without owning one |
| Giveaway host protection | Low | Any user can create giveaways; no min-permission gate |
| /config leaks economy settings to admins | Info | Acceptable by design; admins are trusted |
