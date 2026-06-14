# Security Verification Report — S3 (2026-06-14)

> Source: `docs/PERMISSION_AUDIT.md` (S2) + code verification of `/config view`, privilege paths, token exposure.
> Bot is live: GrimBot#8664, Railway US West.

---

## Privilege escalation: NO CRITICAL PATHS FOUND

| Check | Result |
|---|---|
| `eval` / code-exec command | ✅ None — no RCE surface |
| Raw SQL with user input | ✅ None — all DB access via Prisma parameterized queries |
| Token/secret in any command output | ✅ `/config view` only emits guild economy/spawn/mod settings; no env vars or tokens |
| Commands bypassing `interactionCreate` | ✅ None — slash-only bot, single dispatch path |
| Owner system | ✅ No `OWNER_ID`-gated commands exist (no eval/shutdown surface) |
| SQL injection | ✅ Prisma ORM — no string-interpolated queries found |

---

## Permission model

| Tier | Gate | In-code re-check | Verdict |
|---|---|---|---|
| Admin (`/config`) | `Administrator` perm | None | ✅ Discord-enforced; acceptable |
| Server config (`/setup`, `/welcome`) | `ManageGuild` | None | ✅ |
| Giveaways (`/giveaway`) | `ManageGuild` | ✅ re-checks on `end`/`reroll` | ✅ Best practice |
| Moderation (9 cmds) | Per-action Discord perm | None (except ban/kick/timeout use `member.bannable/kickable/moderatable`) | ✅ |
| User commands | None (public) | n/a | ✅ |

**Overall: permission model is correct and Discord-enforced.**

---

## Findings

| # | Severity | Finding | Fix needed? |
|---|---|---|---|
| SEC-01 | 🟡 | `setDefaultMemberPermissions` is overridable by server admins in Integrations. No in-code fallback on `/config`, `/setup`, `/welcome`, or most mod commands (except `/giveaway`). | Recommended: add `requirePerm(interaction, flag)` helper — mirror `/giveaway` pattern |
| SEC-02 | 🟡 | `/warn` has no role-hierarchy guard — a mod could warn an admin. DB-only, non-destructive. | Low risk; add `member.roles.highest.comparePositionTo` check |
| SEC-03 | 🟢 | No owner-only diagnostic path exists (no `/eval`, `/reload`, `/shutdown`). Good. If added later: gate with `OWNER_ID` env var + never expose `eval`. | No action needed now |
| SEC-04 | 🟢 | `/rob` PvP economy could be used for harassment, but is cooldown-gated and server-toggleable via `/config rob`. | Acceptable |
| SEC-05 | 🟢 | `MemoryStore` session warning in dashboard — Express sessions stored in process memory (leak on long run). | Swap for `connect-pg-simple` using existing Postgres connection |
| SEC-06 | 🟢 | `REDIS_URL` now set and confirmed connected. Previously empty = security gap (unauthenticated local Redis fallback). Now resolved. | ✅ Fixed S3 |

---

## Secrets exposure checklist

| Secret | Risk | Status |
|---|---|---|
| `DISCORD_TOKEN` | Full bot access if leaked | ✅ Railway env var only; not in code or output |
| `POKEMON_TCG_API_KEY` | Rate limit abuse | ✅ Railway env var only |
| `GROQ_API_KEY` | Cost abuse | ✅ Railway env var only |
| `DATABASE_URL` | Full DB access | ✅ Railway env var only; `.gitignore` on `.env` |
| `REDIS_URL` (new) | Cache poisoning | ✅ Railway env var only; password auth required |
| `SESSION_SECRET` | Session forgery | ✅ Railway env var; not echoed in any output |

---

## Recommended actions (prioritized)

1. **SEC-01 (🟡):** Create `src/utils/permissions.ts`:
   ```ts
   export async function requirePerm(interaction, flag: bigint): Promise<boolean> {
     if (!interaction.memberPermissions?.has(flag)) {
       await interaction.reply({ content: 'Missing permissions.', ephemeral: true });
       return false;
     }
     return true;
   }
   ```
   Apply to `/config`, `/setup`, `/welcome`, and mod commands.

2. **SEC-02 (🟢):** Add to `/warn`:
   ```ts
   if (member.roles.highest.comparePositionTo(interaction.member.roles.highest) >= 0) {
     return interaction.reply({ content: "You can't warn someone with equal or higher rank.", ephemeral: true });
   }
   ```

3. **SEC-05 (🟢):** Replace `MemoryStore` with `connect-pg-simple`:
   ```ts
   import pgSession from 'connect-pg-simple';
   const PgStore = pgSession(session);
   app.use(session({ store: new PgStore({ conString: process.env.DATABASE_URL }), ... }));
   ```

---

## Verdict

**No critical security vulnerabilities.** The bot has no RCE surface, all DB access is parameterized, and secrets are Railway-managed. The two medium findings (SEC-01/02) are defense-in-depth improvements, not exploitable gaps. Bot is safe to operate in production.
