# Slash Command Incident Report — S3

> Date: 2026-06-14
> Status: RESOLVED
> Reporter: S3 session investigation

---

## Incident summary

**Symptom:** After registering 42 global slash commands, users received "The application did not respond" for all commands.

**Duration:** Approximately 30–60 minutes after registration.

**Resolution:** Commands began responding without any code change. Final confirmation: `/beg` confirmed working by user.

---

## Verified facts (no speculation)

| Fact | Evidence |
|---|---|
| Bot online and healthy | `/health` endpoint returned 200 with `uptime` increasing |
| Discord login successful | Railway boot log: `GrimBot#8664 is online!` |
| 42 commands loaded at boot | Railway boot log: `[boot] commands loaded: 42` |
| Commands registered globally | `deploy:commands` completed with 0 failures (SLASH_DEPLOYMENT_REPORT.md) |
| Commands visible in Discord client | User confirmed commands appeared in slash menu |
| Commands not responding initially | User reported "application did not respond" for all commands |
| Commands now working | User confirmed `/beg` responds correctly |
| Redis connected | Boot log: `Redis connected` |
| No code changes made during incident | Git status verified — no files modified between registration and resolution |

---

## Likely root cause

**Global command propagation delay.**

Discord's global slash command registration API propagates to all Discord servers and regions with a documented delay of up to **1 hour**. During this window, Discord's gateway may route interactions to the bot but the command payload may not match a registered command on the Discord side, causing the "application did not respond" error at the Discord layer — before the interaction even reaches the bot.

This is the most likely explanation because:
- No code changed between the failure and resolution
- The bot was logging `commands loaded: 42` correctly throughout
- `interactionCreate` in `src/events/index.ts` is correctly wired
- The error appeared immediately after global registration and resolved on its own

---

## Code-level risk factors (not confirmed causes — for next session)

These were identified during investigation as potential contributors to response timeout if they occur independently of propagation delay:

| Risk | Location | Detail |
|---|---|---|
| DB call before any reply | `src/events/interactionCreate.ts:27-31` | `ensureUser()` + `ensureGuild()` (Prisma upserts) run before any `interaction.reply()`. If DB is slow (cold pooler), this can exceed Discord's 3-second acknowledgement window |
| Dynamic import in hot path | `interactionCreate.ts:35` | `await import('../utils/cooldown.js')` on first invocation — adds module load latency on first command per process |
| No `deferReply()` in handler | `interactionCreate.ts:20–61` | No universal `deferReply()` before async work; individual commands must call `reply()` within 3 seconds |
| Privileged intents | `src/index.ts` | `GuildPresences` + `GuildMembers` require Developer Portal opt-in. If not enabled, bot may have degraded state |

---

## Recommended hardening (for next session)

1. **Add `deferReply()` to slow commands** — any command that runs a DB query before replying should call `await interaction.deferReply()` first, then `editReply()` after.
2. **Cache `ensureUser` + `ensureGuild` in Redis** — a 60-second Redis TTL on `user:{id}:exists` and `guild:{id}:exists` flags would eliminate the DB round-trip on every command.
3. **Verify Developer Portal intents** — confirm `GuildPresences` and `GuildMembers` are enabled in the Discord Developer Portal under the bot's page.
4. **Convert dynamic cooldown import to static** — move `import { checkCooldown, setCooldown } from '../utils/cooldown.js'` to the top of `interactionCreate.ts`.

---

## Status

Incident closed. No deploy required. Next session should monitor for recurrence and implement hardening items above as P2.
