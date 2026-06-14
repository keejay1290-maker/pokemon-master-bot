# Production Readiness — Pokémon Master Bot

> Generated S2 (2026-06-14). Evidence-based. VERIFIED = observed in logs/code/CLI. HYPOTHESIS = inferred, not yet proven.

## Deployment root-cause status

### FIXED (VERIFIED)
- **Redis startup hang (primary blocker).** `await redis.connect()` hung forever on `ECONNREFUSED` (redis v4 default reconnect keeps `connect()` pending), blocking dashboard + Discord login → no listener (502, empty upstream) → Railway killed the container → EXITED with no flushed logs. **Trigger:** `REDIS_URL` is **empty** on Railway → fell back to `localhost:6379` (no Redis in container). **Fix (a2672b4):** non-blocking `redis.connect()`, bounded `reconnectStrategy`, `connectTimeout`. **Validated locally:** `Dashboard running on port 3001`, `Bot logged in`, `Bot ready as GrimBot#8664`, `/health -> {"status":"ok"}`.
- **`.d.ts` command-load failures (42/boot).** `loadCommands` matched `.endsWith('.ts')` → required `dist/*.d.ts`. **Fix (a2672b4):** skip `.d.ts`/`.map`.
- **Logs invisible on crash.** `process.exit(1)` discarded the async stdout pipe. **Fix (dd4f1d3):** synchronous `fs.writeSync` boot markers + `process.exitCode`.

### IN PROGRESS (under final isolation)
- **Secondary EXITED on Railway with zero Node output, even after the Redis fix.** VERIFIED: the EXITED deployment is the correct commit; `prisma db push` runs and prints "already in sync" (proving node works via npx), but the chained `node dist/boot.js` produces **zero output** (not even the first synchronous `fs.writeSync`). **HYPOTHESIS (leading):** the prisma step doesn't cleanly return control to the `&&` chain, so the second `node` never runs; OR Railway healthcheck kills before bind. **Action:** diagnostic deploy (d794794) runs `node dist/boot.js` first with a `PRENODE_MARKER` to confirm; crash-proof wrapper (`dist/boot.js`) will surface any import-time error.
- **Builder drift.** railway.json says `DOCKERFILE`; Railway showed transient `RAILPACK`. Pinned start command + healthcheck via railway.json (fe4aca6).

## Readiness checklist

| Area | Item | Status | Notes |
|---|---|---|---|
| **Startup** | Process reaches `main()` and binds listener | 🟡 UNKNOWN (prod) / ✅ local | Local fully boots; prod under final isolation |
| | No startup hang | ✅ FIXED | Redis no longer blocks |
| | Crash visibility | ✅ FIXED | Synchronous boot markers + wrapper |
| **Database** | Prisma connects | ✅ VERIFIED | `db push` connects to `pokemon-master-db.railway.internal` |
| | Migrations strategy | 🟡 | Uses `db push` (no migrations folder); fine but not versioned |
| | Connection stability | 🟡 UNKNOWN | Not yet observed under load |
| **Redis** | Provisioned | 🔴 FAIL | `REDIS_URL` is **empty** on Railway — must be set |
| | Graceful degradation | 🟡 PARTIAL | Startup no longer blocks, but command-level calls are unguarded → throw when down |
| | Startup not blocked | ✅ FIXED | |
| **Dashboard** | `/health` endpoint | ✅ VERIFIED (local) | Returns `{"status":"ok"}`; healthcheckPath now set |
| | Railway compat (PORT) | ✅ | reads `process.env.PORT` |
| **Discord** | Login | ✅ VERIFIED (local) | `Bot ready as GrimBot#8664` |
| | Reconnect | 🟡 | discord.js auto-reconnect default; not explicitly tuned |
| | Slash registration | 🟡 | Manual `npm run deploy:commands` (global); not run on deploy |
| | Event handling | ✅ | events registered; interactionCreate dispatch verified in code |
| **Commands** | Slash functional | 🟡 | 42 load (verified local); runtime depends on Redis for many |
| | Prefix functional | n/a | No prefix commands (slash-only) |
| **Permissions** | Gated correctly | ✅ | See [PERMISSION_AUDIT.md](PERMISSION_AUDIT.md) — no critical escalation |
| **Logging** | Captured | 🟡 | winston Console+File; File writes to `logs/` (Dockerfile mkdir) |
| **Health/Monitoring** | Healthcheck | ✅ | `/health` + railway.json healthcheckPath |
| | Backups | 🔴 | No DB backup strategy documented |
| | Error monitoring | 🔴 | No Sentry/alerting |

## Ranked startup remediation (HIGH / MED / LOW)

**HIGH**
1. Resolve the secondary EXITED (in progress) — confirm via PRENODE deploy, then restore a working start command. *(blocks everything)*
2. **Set `REDIS_URL`** on Railway to a provisioned Redis service (or add one). Without it, cooldowns/spawns/battles/TCG fail at runtime.
3. Guard all `client.redis.*` calls with a safe wrapper (return null on miss) so the bot degrades instead of throwing per-command.

**MED**
4. Run `deploy:commands` automatically post-deploy (or add a release step) so slash commands register.
5. Pin builder explicitly and confirm Railway honors `DOCKERFILE` (avoid RAILPACK drift).
6. Move Prisma schema sync out of the start `&&` chain (separate release/pre-deploy step) to remove a startup failure point.

**LOW**
7. Add error monitoring (Sentry) + DB backup routine.
8. Tune discord.js reconnect/sharding for scale.

## Readiness score & recommendation

**Score: 55 / 100** — *blocked on the live deploy coming up healthy.*
- +Architecture, command breadth, permissions, dashboard, unique TCG: solid.
- −Live deploy not yet confirmed RUNNING; Redis unprovisioned; runtime not load-tested.

**Recommendation: NOT READY** (will move to **READY WITH MINOR ISSUES** once: deploy confirmed RUNNING + `/health` 200 in prod, `REDIS_URL` set, and `deploy:commands` run). Once the live boot is green, the remaining items are non-blocking polish.

## NEXT_SESSION_TASKS
- [ ] Confirm PRENODE deploy result; restore start command (`node dist/boot.js`, schema sync as separate step).
- [ ] Set `REDIS_URL` on Railway (or add Redis service).
- [ ] Add safe Redis wrapper.
- [ ] Run/automate `deploy:commands`.
- [ ] Add Sentry + DB backups.
