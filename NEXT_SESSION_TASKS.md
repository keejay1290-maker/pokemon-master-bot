# NEXT SESSION TASKS
**Project:** pokemon-master-bot  
**Scope:** This file applies ONLY to the pokemon-master-bot repository and Railway project.  
**Updated:** 2026-06-14 (Session 3)

---

## CURRENT STATE

- Deployment `6374e890`: build SUCCESS, instance `e47c1968` status EXITED
- All CLI-accessible log streams exhausted. No node process output found in any stream.
- Railway CLI does not expose exit code, stop reason, or restart count via any command.
- Active unknowns: U8 (node execution state), U9 (exit code), U10 (post-migration lifecycle), U11 (stop reason), U12 (restart attempts)

---

## PRIORITY 1 — Obtain instance lifecycle data

These tasks must be completed before any remediation is planned.

### Task 1A — Railway GraphQL API (instance lifecycle)

**Goal:** Determine whether Railway exposes exit code, stop reason, or restart history via its internal GraphQL API.

**Why first:** The Railway CLI wraps the GraphQL API. It is possible the API exposes fields the CLI does not surface in its output. This is the only unexplored data source that does not require a running instance or a new deployment.

**How to attempt:**
1. Retrieve the Railway auth token: `railway whoami --json` or inspect `~/.railway/config.json`
2. Query the Railway GraphQL endpoint (typically `https://backboard.railway.app/graphql/v2`) with bearer auth
3. Target fields on the `ServiceInstance` type: `exitCode`, `stopReason`, `restartCount`, `terminationReason`, or equivalent
4. Target fields on the `Deployment` type: `statusHistory`, `events`, or equivalent

**Expected information gain:** EXIT CODE and STOP REASON — the two most critical missing data points.

**Success criteria:** Any of: exit code obtained, stop reason obtained, restart count obtained, "no such fields exist" confirmed.

---

### Task 1B — Railway deployment events or audit log

**Goal:** Determine whether Railway records a deployment event timeline with timestamps and lifecycle events beyond what `railway logs` returns.

**How to attempt:**
- Check Railway dashboard (UI) for a deployment event log or timeline panel for deployment `6374e890`
- Check for a `DeploymentEvent` or `ActivityFeed` type in the GraphQL schema if Task 1A succeeds

**Expected information gain:** Would show whether the instance exited due to internal error, resource limit, manual stop, or deployment supersession.

---

## PRIORITY 2 — Verify node process launch

Only attempt these after Priority 1 is complete or exhausted.

### Task 2A — Live redeploy with streaming logs

**Goal:** Reproduce the failure in real time with a live log stream open.

**When to run:** After Tasks 1A and 1B are exhausted and exit code/stop reason remain unknown.

**Command sequence:**
```bash
# Terminal 1 (start streaming first)
railway logs --latest --json

# Terminal 2 (trigger redeploy)
railway redeploy
```

**What to watch for:**
- Does `Starting Pokemon Master Bot...` appear after migration completes?
- Does any error message appear?
- How many seconds pass between Prisma completion and instance EXITED?
- Does "Stopping Container" appear?

**Success criteria:** Either node log output appears (narrows the failure boundary) or the same silent failure is reproduced with fresh log evidence.

**Note:** This is an infrastructure action — it triggers a new deployment. Confirm no other changes are pending before running.

---

### Task 2B — Railway SSH (requires running instance)

**Goal:** Direct shell access to the container to manually inspect filesystem and run `node dist/index.js`.

**Blocked:** Requires the instance to be in RUNNING state. Not possible while EXITED.

**Gate:** Instance must be RUNNING. If Task 2A (live redeploy) produces a container that starts but does not exit immediately, SSH may become available.

**Command:** `railway ssh`

**What to check once inside:**
```bash
ls /app/dist/
node --version
node dist/index.js    # observe output directly
```

---

## PRIORITY 3 — Remediation (BLOCKED until root cause confirmed)

Do not begin any task in this section until U8–U12 are resolved.

### Task 3A — Plan remediation

Once root cause is identified, plan the fix. Common candidates based on current evidence:
- If node crashes at startup: identify the crash location and fix it
- If startCommand ordering is the issue: align Railway startCommand with Dockerfile CMD
- Do not implement without confirmed root cause

### Task 3B — Redeploy and validate

After fix is applied:
1. `git push origin master` — triggers Railway auto-deploy
2. `railway logs --latest --json` — confirm `Starting Pokemon Master Bot...` appears
3. `curl https://pokemon-master-bot-production.up.railway.app/health` — confirm 200
4. Verify Discord slash commands are responsive

### Task 3C — Provision real Redis

After bot is confirmed running:
- `pokemon-master-redis` is currently a Postgres container, not Redis
- Create a real Railway Redis service
- Populate `REDIS_URL` with the Redis internal URL

---

## PROHIBITED ACTIONS — SESSION START CHECKLIST

Do NOT perform the following without new evidence:

| Prohibited action | Reason |
|---|---|
| Rewrite Dockerfile | Root cause not confirmed |
| Change Railway startCommand | Root cause not confirmed |
| Modify `src/index.ts` or any source file | Root cause not confirmed |
| Change Discord token, intents, or Prisma schema | Not implicated by evidence |
| Implement new features | Service is down; feature work is blocked |

---

## OPEN INFRASTRUCTURE ISSUES (address after bot is running)

1. `REDIS_URL` is empty. `pokemon-master-redis` is a Postgres container. A real Redis service is needed.
2. Railway `startCommand` (`prisma migrate deploy`) differs from Dockerfile CMD (`prisma db push --skip-generate`). One source of truth is needed once root cause is confirmed.
3. `targetPort = null`. Verify Railway correctly routes to the dashboard port once the bot is running.
