# Permission Audit — Pokémon Master Bot

> Generated S2 (2026-06-14). Source: `src/commands/**`, `src/events/interactionCreate.ts`.
> Model: Discord-native `setDefaultMemberPermissions` (server-enforced) is the primary gate. There is **no in-code owner system** and **no dangerous owner commands** (`eval`/`shutdown`/`reload`/`blacklist`/`maintenance` do not exist).

## Summary

| Tier | Commands | Gate | Verdict |
|---|---|---|---|
| Owner-only | (none exist) | n/a | ✅ No dangerous owner surface to exploit |
| Admin | `/config` | `Administrator` | ✅ Correct |
| Server config | `/setup`, `/welcome` | `ManageGuild` | ✅ Correct |
| Giveaways | `/giveaway` | `ManageGuild` + **in-code re-check** | ✅ Best-practice (defense in depth) |
| Moderation | `/ban /kick /timeout /warn /warnings /purge /lock /unlock /slowmode` | per-action perm | ✅ Correct gates |
| User | all economy / pokemon / cards / social / utility | none (public) | ✅ Correct |

## Privileged command checks

| Command | Default perm | Extra in-code guard | Hierarchy/abuse guard | Verdict |
|---|---|---|---|---|
| `/config` | Administrator | — | n/a | ✅ |
| `/setup` | ManageGuild | — | n/a | ✅ |
| `/welcome` | ManageGuild | — | n/a | ✅ |
| `/giveaway` | ManageGuild | ✅ `memberPermissions.has(ManageGuild)` re-check on `end`/`reroll` | n/a | ✅ strongest |
| `/ban` | BanMembers | — | ✅ `member.bannable` | ✅ |
| `/kick` | KickMembers | — | ✅ `member.kickable` | ✅ |
| `/timeout` | ModerateMembers | — | ✅ `member.moderatable` | ✅ |
| `/warn` | ModerateMembers | — | ❌ none (no Discord action; DB-only) | ⚠️ low risk |
| `/warnings` | ModerateMembers | — | n/a (read-only) | ✅ |
| `/purge` | ManageMessages | — | n/a | ✅ |
| `/lock` `/unlock` `/slowmode` | ManageChannels | — | n/a | ✅ |

## Findings

| # | Severity | Finding | Recommendation |
|---|---|---|---|
| P1 | 🟡 | **`setDefaultMemberPermissions` is overridable** by server admins in Server Settings → Integrations, and is the *only* gate for `/config`, `/setup`, `/welcome`, and most moderation. If an admin loosens it, there is no in-code fallback (except `/giveaway`). | Add a lightweight in-code permission re-check helper and apply to `/config`, `/setup`, `/welcome`, and moderation commands (mirror the `/giveaway` pattern). |
| P2 | 🟢 | No **owner-only diagnostic** path exists (no `/eval`, `/reload`, `/shutdown`). Good for security, but you also have **no** safe admin tooling. If added later, gate with `interaction.user.id === process.env.OWNER_ID` AND never expose `eval` in production. | Optional: add `OWNER_ID`-gated `/admin` (stats/reload) — never `eval`. |
| P3 | 🟢 | `/warn` has no role-hierarchy guard — a mod could warn an admin/owner. DB-only, non-destructive, but cosmetically abusable. | Add a `member.roles.highest.comparePositionTo` check. |
| P4 | 🟢 | Economy `/rob` is PvP and could be abused for harassment, but is cooldown-gated and server-toggleable (`/config rob`). | Acceptable. |

## Privilege-escalation review

- **No `eval`/code-exec command** → no RCE surface. ✅
- **No raw SQL** from user input — all DB access via Prisma parameterized queries. ✅
- **No command bypasses the central handler** — every command flows through `interactionCreate` (no alternate trigger path; bot is slash-only). ✅
- **Token/secret exposure:** `/config view` echoes guild config as JSON (no secrets); no command prints env/token values. ✅ (verify `/config view` never includes API keys — currently it only shows guild economy/spawn/mod settings.)

## Verdict

**No critical privilege-escalation paths.** The permission model is correct and Discord-enforced. The main hardening opportunity is **defense-in-depth in-code re-checks** (P1) since `setDefaultMemberPermissions` is admin-overridable.

## NEXT_SESSION_TASKS
- [ ] Add `utils/permissions.ts` `requirePerm(interaction, flag)` helper; apply to `/config`, `/setup`, `/welcome`, moderation (P1).
- [ ] Add hierarchy guard to `/warn` (P3).
- [ ] Confirm `/config view` output never includes secrets.
