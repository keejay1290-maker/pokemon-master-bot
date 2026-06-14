# EVIDENCE LOG
**Project:** pokemon-master-bot  
**Scope:** This file applies ONLY to the pokemon-master-bot repository and Railway project.  
**Created:** 2026-06-14  

This log records every diagnostic command run and its exact output during the incident investigation. Results are classified as VERIFIED or UNKNOWN. No inferences are made here — inferences are in INVESTIGATION_SUMMARY.md.

---

## E01 — railway status

**Command:** `railway status`  
**When run:** Session 1  
**Status classification:** VERIFIED  

**Output (relevant excerpt):**
```
pokemon-master-bot
    status:        ● Completed
    repo:          keejay1290-maker/pokemon-master-bot
    url:           https://pokemon-master-bot-production.up.railway.app
    region:        US West
    deployment ID: 6374e890-3ba5-4d9e-a940-ed132872bd46
    service ID:    4082df87-f2c6-4c39-b5cc-0a2dca1d1782
```

**Facts extracted:**
- Deployment ID: `6374e890-3ba5-4d9e-a940-ed132872bd46`
- Service URL: `https://pokemon-master-bot-production.up.railway.app`

---

## E02 — railway variables

**Command:** `railway variables`  
**When run:** Session 1  
**Status classification:** VERIFIED  

**Facts extracted:**
- `REDIS_URL` = empty string (blank value shown in table)
- `DATABASE_URL` = `postgresql://postgres:...@pokemon-master-db.railway.internal:5432/railway`
- `DISCORD_TOKEN` = present (value not recorded here per security policy)
- `DISCORD_CLIENT_ID` = `1515403358800838928`
- `DASHBOARD_PORT` = `3001`
- `NODE_ENV` = `production`

---

## E03 — HTTP health check

**Command:** `curl -s -o - -w "\nHTTP_STATUS:%{http_code}" "https://pokemon-master-bot-production.up.railway.app/health"`  
**When run:** Session 1  
**Status classification:** VERIFIED  

**Output:**
```
{"status":"error","code":502,"message":"Application failed to respond","request_id":"bLAoJlSVQiGeBLzVxtoGcA"}
HTTP_STATUS:502
```

**Facts extracted:**
- Service returns HTTP 502. Application is not responding to HTTP.

---

## E04 — HTTP root endpoint

**Command:** `curl -s -o - -w "\nHTTP_STATUS:%{http_code}" "https://pokemon-master-bot-production.up.railway.app/"`  
**When run:** Session 1  
**Status classification:** VERIFIED  

**Output:**
```
{"status":"error","code":502,"message":"Application failed to respond","request_id":"Yng0sJM5RpmFVKSZY53eZw"}
HTTP_STATUS:502
```

**Facts extracted:**
- Root path also returns HTTP 502.

---

## E05 — railway logs (plain text)

**Command:** `railway logs`  
**When run:** Session 1 (multiple times with `--tail 200`)  
**Status classification:** VERIFIED  

**Output (complete):**
```
Starting Container

No migration found in prisma/migrations
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "railway", schema "public" at "pokemon-master-db.railway.internal:5432"


No pending migrations to apply.
npm notice
npm notice New major version of npm available! 10.8.2 -> 11.17.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.17.0
npm notice To update run: npm install -g npm@11.17.0
npm notice
```

**Facts extracted:**
- Migration runs and completes.
- No application-level node output present.

---

## E06 — railway logs --json (deployment 6374e890)

**Command:** `railway logs --deployment 6374e890-3ba5-4d9e-a940-ed132872bd46 --json`  
**When run:** Session 1  
**Status classification:** VERIFIED  

**Full output (13 entries):**
```
{"timestamp":"2026-06-13T22:22:15.608657501Z","level":"info","message":"Starting Container"}
{"level":"info","message":"","timestamp":"2026-06-13T22:22:16.433466909Z"}
{"timestamp":"2026-06-13T22:22:16.433483475Z","level":"info","message":"No migration found in prisma/migrations"}
{"message":"Prisma schema loaded from prisma/schema.prisma","level":"info","timestamp":"2026-06-13T22:22:16.433483817Z"}
{"timestamp":"2026-06-13T22:22:16.433489029Z","level":"info","message":"Datasource \"db\": PostgreSQL database \"railway\", schema \"public\" at \"pokemon-master-db.railway.internal:5432\""}
{"level":"info","message":"","timestamp":"2026-06-13T22:22:16.433493584Z"}
{"message":"","level":"info","timestamp":"2026-06-13T22:22:16.461082214Z"}
{"message":"No pending migrations to apply.","level":"info","timestamp":"2026-06-13T22:22:16.461092147Z"}
{"timestamp":"2026-06-13T22:22:16.488097391Z","message":"npm notice","level":"error"}
{"level":"error","message":"npm notice New major version of npm available! 10.8.2 -> 11.17.0","timestamp":"2026-06-13T22:22:16.488105213Z"}
{"level":"error","timestamp":"2026-06-13T22:22:16.488110937Z","message":"npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.17.0"}
{"message":"npm notice To update run: npm install -g npm@11.17.0","timestamp":"2026-06-13T22:22:16.488116664Z","level":"error"}
{"message":"npm notice","timestamp":"2026-06-13T22:22:16.488122433Z","level":"error"}
```

**Facts extracted:**
- Total entries: 13
- First timestamp: `2026-06-13T22:22:15.608657501Z`
- Last timestamp: `2026-06-13T22:22:16.488122433Z`
- Span: 879.5ms
- "Starting Container" occurrences: 1
- "Stopping Container" occurrences: 0
- npm notices appear at level `error` — confirms Railway captures stderr for this service.
- Zero application-level node output.

---

## E07 — railway logs --json (deployment 5cc45fd4)

**Command:** `railway logs --deployment 5cc45fd4-b60a-42f5-8cd4-8fe567ed33a6 --json`  
**When run:** Session 1  
**Status classification:** VERIFIED  

**Full output (14 entries):**
```
{"level":"info","message":"Starting Container","timestamp":"2026-06-13T21:53:15.425480899Z"}
{"level":"info","message":"Prisma schema loaded from prisma/schema.prisma","timestamp":"2026-06-13T21:53:15.967751159Z"}
{"level":"error","message":"npm notice","timestamp":"2026-06-13T21:53:15.967753909Z"}
{"level":"info","message":"Datasource \"db\": PostgreSQL database \"railway\"...","timestamp":"2026-06-13T21:53:15.967758499Z"}
{"level":"info","message":"","timestamp":"2026-06-13T21:53:15.967764489Z"}
{"level":"info","message":"","timestamp":"2026-06-13T21:53:15.967766669Z"}
{"level":"info","message":"No migration found in prisma/migrations","timestamp":"2026-06-13T21:53:15.967768009Z"}
{"level":"info","message":"","timestamp":"2026-06-13T21:53:15.967770139Z"}
{"level":"info","message":"No pending migrations to apply.","timestamp":"2026-06-13T21:53:15.967773009Z"}
{"level":"error","message":"npm notice","timestamp":"2026-06-13T21:53:15.967777619Z"}
{"level":"error","message":"npm notice New major version of npm available! 10.8.2 -> 11.17.0","timestamp":"2026-06-13T21:53:15.967781069Z"}
{"level":"error","message":"npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.17.0","timestamp":"2026-06-13T21:53:15.967784089Z"}
{"level":"error","message":"npm notice To update run: npm install -g npm@11.17.0","timestamp":"2026-06-13T21:53:15.967787049Z"}
{"level":"info","message":"Stopping Container","timestamp":"2026-06-13T22:01:08.740249710Z"}
```

**Facts extracted:**
- Total entries: 14
- First timestamp: `2026-06-13T21:53:15.425Z`
- Last timestamp: `2026-06-13T22:01:08.740Z`
- Container lifetime: 473.3 seconds
- "Stopping Container" event present at `22:01:08Z`
- Zero application-level node output (same pattern as `6374e890`).

---

## E08 — railway deployment list --json

**Command:** `railway deployment list --json`  
**When run:** Session 1  
**Status classification:** VERIFIED  

**Facts extracted:**

| Deployment ID | Status | Created (UTC) | Commit |
|---|---|---|---|
| `6374e890` | SUCCESS | `2026-06-13T22:21:29.454Z` | `1fe83916` |
| `c750a361` | REMOVED | `2026-06-13T22:04:10.940Z` | `55249b22` |
| `5cc45fd4` | FAILED | `2026-06-13T21:52:19.132Z` | `55249b22` |
| `e689b9c9` | FAILED | `2026-06-13T21:49:40Z` (approx) | — |
| `cdef2b9a` | FAILED | — | — |
| `d9a75949` | FAILED | — | — |
| `cd54e785` | FAILED | — | — |
| `45fe513d` | FAILED | — | — |
| `b499ca3d` | FAILED | — | — |
| `1e736842` | FAILED | — | — |

**Deployment `6374e890` metadata:**
- `builder`: DOCKERFILE
- `dockerfilePath`: Dockerfile
- `startCommand`: `npx prisma migrate deploy && node dist/index.js`
- `healthcheckPath`: null
- `healthcheckTimeout`: null
- `restartPolicyType`: ON_FAILURE
- `restartPolicyMaxRetries`: 5
- `imageDigest`: `sha256:e7fb3336ea1c457d76c05a9946057369a24dcc5bd8ac6d91ffc9d7a8f1dcda97`
- `sleepApplication`: false

---

## E09 — railway status --json

**Command:** `railway status --json`  
**When run:** Session 1  
**Status classification:** VERIFIED  

**Facts extracted (pokemon-master-bot service only):**
- `serviceId`: `4082df87-f2c6-4c39-b5cc-0a2dca1d1782`
- `serviceName`: `pokemon-master-bot`
- Active deployment: `6374e890`
- `deploymentStopped`: `true`
- Instance `e47c1968` status: `"EXITED"`
- `startCommand` (service-level): `"npx prisma migrate deploy && node dist/index.js"`
- Domain: `pokemon-master-bot-production.up.railway.app`
- `targetPort`: `null`

**Facts extracted (pokemon-master-redis service):**
- `serviceName`: `pokemon-master-redis`
- `source.image`: `ghcr.io/railwayapp-templates/postgres-ssl:18`
- This service is a Postgres container, not Redis.

---

## E10 — Local prisma migrate deploy execution

**Command:** `npx prisma migrate deploy` (run locally, database URL from `.env`)  
**When run:** Session 1  
**Status classification:** VERIFIED (for local exit code only)  

**Output:**
```
No migration found in prisma/migrations
No pending migrations to apply.
EXIT_CODE:0
```

**Facts extracted:**
- `prisma migrate deploy` exits with code 0 when no migrations are pending.
- Output matches the output seen in Railway container logs (E06, E07).

**Limitation:** This was a local test. The exit code applies to the local environment. It confirms the command's expected behavior, not the Railway container's behavior specifically.

---

## E11 — .gitignore and git ls-files inspection

**Commands:**
```
cat .gitignore | grep -E "dist|node_modules|logs"
git ls-files dist/
```
**When run:** Session 1  
**Status classification:** VERIFIED  

**Output:**
```
node_modules/
dist/

(git ls-files returned empty)
```

**Facts extracted:**
- `dist/` is listed in `.gitignore`.
- `dist/` contains no tracked files in git.
- Therefore, `dist/` in the container can only exist if the Docker build stage (`RUN npm run build`) produced it.

---

## E12 — railway run node dist/index.js (INVALIDATED FOR CONTAINER CLAIMS)

**Command:** `railway run node dist/index.js`  
**When run:** Session 1  
**Status classification:** VERIFIED (for local execution only) — INVALID for container-content claims  

**Output:**
```
[2026-06-13T22:28:49.494Z] info: Starting Pokemon Master Bot...
Fatal error: PrismaClientInitializationError: Can't reach database server at `pokemon-master-db.railway.internal:5432`
```

**Facts extracted:**
- `railway run` executes on the LOCAL machine with Railway env vars injected. It does NOT run inside the deployed container.
- On the local machine, `node dist/index.js` runs and produces logger output.
- The Prisma error (`P1001`) is expected — `pokemon-master-db.railway.internal` is not reachable from outside Railway's internal network.

**Limitation:** This test confirms node runs locally. It makes no claim about what happens inside the deployed container.

---

## E13 — railway logs --build flag availability

**Command:** `railway logs --help`  
**When run:** Session 1  
**Status classification:** VERIFIED  

**Facts extracted:**
- `--build` flag is available: `railway logs --build <deployment-id>`
- Build logs for deployment `6374e890` have NOT yet been retrieved.
- This is the first task for the next session.

---

---

## E14 — railway logs --build (deployment 6374e890)

**Command:** `railway logs --build 6374e890-3ba5-4d9e-a940-ed132872bd46 --json`  
**When run:** Session 2  
**Status classification:** VERIFIED

**Key entries (relevant subset):**
```
[builder 2/9] RUN apk add --no-cache openssl openssl-dev python3 make g++ cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev  cached: true
[builder 3/9] WORKDIR /app  cached: true
[builder 4/9] COPY package*.json ./  cached: true
[builder 5/9] COPY prisma ./prisma/  cached: true
[builder 6/9] RUN npm install  cached: true
[builder 7/9] COPY . .  started: 22:21:33.606Z, completed: 22:21:33.689Z
[builder 8/9] RUN npx prisma generate  started: 22:21:33.700Z, completed: 22:21:36.667Z
  → output: "✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 309ms"
[builder 9/9] RUN npm run build  started: 22:21:36.678Z, completed: 22:21:42.051Z
  → output: "> pokemon-master-bot@1.0.0 build\n> tsc\n\n"
  → no error lines emitted

[production 2/8] RUN apk add --no-cache openssl cairo pango libjpeg-turbo giflib librsvg  cached: true
[production 3/8] WORKDIR /app  cached: true
[production 4/8] RUN mkdir -p /app/logs  cached: true
[production 5/8] COPY --from=builder /app/dist ./dist  cached: true, completed
[production 6/8] COPY --from=builder /app/node_modules ./node_modules  cached: true, completed
[production 7/8] COPY --from=builder /app/prisma ./prisma  cached: true, completed
[production 8/8] COPY --from=builder /app/package*.json ./  cached: true, completed

exporting to docker image format  completed: 22:21:59.074Z
image push  completed: 22:22:06.577Z, size: 159,934,523 bytes
```

**Facts extracted:**
- `[builder 9/9] RUN npm run build` completed without error. tsc emitted no diagnostics.
- `[production 5/8] COPY --from=builder /app/dist ./dist` completed. `dist/` exists in the production image.
- All 9 builder stages and all 8 production stages completed.
- Image export and push completed successfully.
- `dist/` in the deployed container originates from a successful `npm run build` inside the Docker builder stage.

**What this evidence does NOT prove:**
- Which specific files are in `dist/` (e.g., presence of `dist/index.js` confirmed only by inference from tsc success, not by direct directory listing).
- Runtime behavior once `node dist/index.js` is invoked.

---

## E15 — railway logs --http --json

**Command:** `railway logs --http --json`  
**When run:** Session 2  
**Status classification:** VERIFIED

**Full output (2 entries):**
```json
{
  "timestamp": "2026-06-13T22:29:40.877Z",
  "method": "GET",
  "path": "/health",
  "httpStatus": 502,
  "totalDuration": 15022,
  "requestId": "bLAoJlSVQiGeBLzVxtoGcA",
  "upstreamAddress": "",
  "upstreamErrors": [
    {"deploymentInstanceID": "e47c1968-88ac-4996-8c9c-5e88925ea8f1", "error": "connection dial timeout", "duration": 5000},
    {"deploymentInstanceID": "e47c1968-88ac-4996-8c9c-5e88925ea8f1", "error": "connection dial timeout", "duration": 5000},
    {"deploymentInstanceID": "e47c1968-88ac-4996-8c9c-5e88925ea8f1", "error": "connection dial timeout", "duration": 5000}
  ],
  "deploymentInstanceId": "00000000-0000-0000-0000-000000000000"
}
{
  "timestamp": "2026-06-13T22:29:57.705Z",
  "method": "GET",
  "path": "/",
  "httpStatus": 502,
  "upstreamAddress": "",
  "upstreamErrors": [
    {"deploymentInstanceID": "e47c1968-88ac-4996-8c9c-5e88925ea8f1", "error": "connection dial timeout", "duration": 5000},
    {"deploymentInstanceID": "e47c1968-88ac-4996-8c9c-5e88925ea8f1", "error": "connection dial timeout", "duration": 5000},
    {"deploymentInstanceID": "e47c1968-88ac-4996-8c9c-5e88925ea8f1", "error": "connection dial timeout", "duration": 5000}
  ],
  "deploymentInstanceId": "00000000-0000-0000-0000-000000000000"
}
```

**Facts extracted:**
- Both HTTP requests (from Session 1 curl tests) resulted in `upstreamAddress: ""`.
- Railway proxy made 3 retry attempts of 5000ms each per request (total: 15,000ms per request).
- All retry attempts ended with "connection dial timeout".
- `deploymentInstanceId` in the routed request is `00000000-0000-0000-0000-000000000000` — Railway had no active instance to route to at request time.
- These requests were made at `22:29:40Z` and `22:29:57Z` — after the instance was already EXITED.

**What this evidence does NOT prove:**
- Whether a listener was ever active at an earlier point (these requests were made after EXITED state, not during the container's 880ms active window).
- Why no listener was reached.
- Whether `node dist/index.js` executed or attempted to bind a port.

**Limitation:** The only HTTP requests in the log are the two curl tests from Session 1, made at `22:29:40Z` and `22:29:57Z`. This is more than 13 minutes after the last container log (`22:22:16.488Z`). There are no HTTP log entries from the container's active window (`22:22:15Z`–`22:22:16Z`). No conclusion can be drawn about listener state during that window from this data.

---

---

## E16 — railway deployment list --json (Session 2 — full metadata)

**Command:** `railway deployment list --json`  
**When run:** Session 2  
**Status classification:** VERIFIED

**Facts extracted (supplementing E08):**

| Deployment | Status | Builder | Commit | healthcheckPath | healthcheckTimeout | startCommand |
|---|---|---|---|---|---|---|
| `6374e890` | SUCCESS/EXITED | DOCKERFILE | `1fe83916` | null | null | `npx prisma migrate deploy && node dist/index.js` |
| `c750a361` | REMOVED | DOCKERFILE | `55249b22` | null | null | `npx prisma migrate deploy && node dist/index.js` |
| `5cc45fd4` | FAILED | DOCKERFILE | `55249b22` | `/health` | null | `npx prisma migrate deploy && node dist/index.js` |
| `e689b9c9` | FAILED | DOCKERFILE | `1e8d2fc0` | `/health` | 300 | `npx prisma migrate deploy && node dist/index.js` |
| `cdef2b9a` | FAILED | DOCKERFILE | `1e8d2fc0` | `/health` | 300 | `npx prisma migrate deploy && node dist/index.js` |
| `d9a75949` | FAILED | NIXPACKS | `50986586` | `/health` | 300 | `npx prisma migrate deploy && node dist/index.js` |
| `cd54e785` | FAILED | NIXPACKS | `bba4eac3` | `/health` | 300 | `npx prisma migrate deploy && node dist/index.js` |
| `45fe513d` | FAILED | NIXPACKS | `bba4eac3` | `/health` | 300 | `npx prisma migrate deploy && node dist/index.js` |
| `b499ca3d` | FAILED | NIXPACKS | `bba4eac3` | `/health` | 300 | `npx prisma migrate deploy && node dist/index.js` |
| `1e736842` | FAILED | NIXPACKS | `bba4eac3` | `/health` | 300 | `npx prisma migrate deploy && node dist/index.js` |

**Additional fact — commit message vs. startCommand discrepancy:**
- Deployment `6374e890` commit message reads: `"fix: use prisma db push instead of migrate deploy on startup"`
- The actual `startCommand` recorded in the deployment metadata is still: `"npx prisma migrate deploy && node dist/index.js"`
- These do not match. The Railway service `startCommand` was not changed when this commit was deployed.
- The Dockerfile CMD may have been changed in the commit, but the Railway service-level `startCommand` overrides the Dockerfile CMD at runtime, and it still references `prisma migrate deploy`.

---

## E17 — railway logs (deployment e689b9c9)

**Command:** `railway logs --deployment e689b9c9-2b3d-479a-a250-983129a6e729 --json`  
**When run:** Session 2 (Task 3)  
**Status classification:** VERIFIED

**Timeline:**
- Start: `2026-06-13T21:50:15.546Z`
- Stop: `2026-06-13T21:55:55.965Z`
- Runtime: 340.4 seconds

**Log entry counts:**
- "Starting Container": 1
- "Stopping Container": 1 (Railway-initiated)
- Prisma migration completed: YES ("No pending migrations to apply.")
- Prisma errors: NONE
- Node output: **ABSENT**

**Facts extracted:**
- Prisma migration completed cleanly — identical pattern to `6374e890`.
- Container ran for 340 seconds after migration completion with zero node output.
- Railway killed the container ("Stopping Container") — consistent with healthcheckTimeout: 300 (plus overhead).
- No application-level output appeared in 340 seconds of container lifetime.

---

## E18 — railway logs (deployment cdef2b9a)

**Command:** `railway logs --deployment cdef2b9a-520d-447b-9218-cd4a50052a3b --json`  
**When run:** Session 2 (Task 3)  
**Status classification:** VERIFIED

**Timeline:**
- Start: `2026-06-13T21:00:36.621Z`
- Stop: `2026-06-13T21:06:00.257Z`
- Runtime: 323.6 seconds

**Log entry counts:**
- "Starting Container": 1
- "Stopping Container": 1 (Railway-initiated)
- Prisma migration completed: YES
- Prisma errors: NONE
- Node output: **ABSENT**

**Facts extracted:**
- Identical migration-completes pattern to `6374e890` and `e689b9c9`.
- Zero node output across 323 seconds.
- Railway-killed at ~323s (healthcheckTimeout: 300 + overhead).

---

## E19 — railway logs (deployment d9a75949)

**Command:** `railway logs --deployment d9a75949-12b4-401f-b265-12fa1c26794e --json`  
**When run:** Session 2 (Task 3)  
**Status classification:** VERIFIED

**Timeline:**
- Start: `2026-06-13T20:51:55.446Z`
- Stop: `2026-06-13T20:58:12.900Z`
- Runtime: 377.5 seconds

**Repeated error pattern (emitted multiple times):**
```
"prisma:warn Prisma failed to detect the libssl/openssl version to use, and may not work as expected. Defaulting to \"openssl-1.1.x\"."
"Please manually install OpenSSL and try installing Prisma again."
"Error: Could not parse schema engine response: SyntaxError: Unexpected token 'E', \"Error load\"... is not valid JSON"
```

**Facts extracted:**
- Builder: NIXPACKS
- Prisma migration: FAILED — OpenSSL not found. Schema engine could not produce valid JSON output.
- The migration command exited non-zero (or was retried multiple times based on log cycling).
- Node output: ABSENT (migration failure precedes node invocation via `&&`).
- "Stopping Container": YES (Railway-killed at 377.5s).
- This is a DIFFERENT failure class from DOCKERFILE deployments. The `&&` chain would not proceed to `node dist/index.js` because migration failed.

---

## E20 — railway logs (deployment cd54e785)

**Command:** `railway logs --deployment cd54e785-7868-486c-912b-1ce0636f9dab --json`  
**When run:** Session 2 (Task 3)  
**Status classification:** VERIFIED

**Timeline:**
- Start: `2026-06-13T20:46:41.164Z`
- Stop: `2026-06-13T20:56:00.039Z`
- Runtime: 558.9 seconds

**Facts extracted:**
- Builder: NIXPACKS
- Same OpenSSL/libssl Prisma failure pattern as E19.
- Migration failed. Node output: ABSENT.
- "Stopping Container": YES.

---

## E21 — railway logs (deployment 45fe513d)

**Command:** `railway logs --deployment 45fe513d-537f-4f9c-8fb9-683d7ae48ca8 --json`  
**When run:** Session 2 (Task 3)  
**Status classification:** VERIFIED

**Timeline:**
- Start: `2026-06-13T20:46:31.543Z`
- Stop: `2026-06-13T20:52:59.520Z`
- Runtime: 387.9 seconds

**Facts extracted:**
- Builder: NIXPACKS. Same OpenSSL failure. Migration failed. Node output: ABSENT.

---

## E22 — railway logs (deployment b499ca3d)

**Command:** `railway logs --deployment b499ca3d-a9fe-43b4-b820-ad80968c2e67 --json`  
**When run:** Session 2 (Task 3)  
**Status classification:** VERIFIED

**Timeline:**
- Start: `2026-06-13T20:46:21.180Z`
- Stop: `2026-06-13T20:53:18.784Z`
- Runtime: 417.6 seconds

**Facts extracted:**
- Builder: NIXPACKS. Same OpenSSL failure. Migration failed. Node output: ABSENT.

---

## E23 — railway logs (deployment 1e736842)

**Command:** `railway logs --deployment 1e736842-ce4c-4723-abf2-df567e66f38d --json`  
**When run:** Session 2 (Task 3)  
**Status classification:** VERIFIED

**Timeline:**
- Start: `2026-06-13T20:46:10.616Z`
- Stop: `2026-06-13T20:56:00.139Z`
- Runtime: 589.5 seconds

**Facts extracted:**
- Builder: NIXPACKS. Same OpenSSL failure. Migration failed. Node output: ABSENT.

---

## CROSS-DEPLOYMENT SUMMARY (E17–E23)

| Deployment | Builder | Prisma Completed | Node Output Seen | Stopping Container | Runtime | Unique Errors |
|---|---|---|---|---|---|---|
| `6374e890` | DOCKERFILE | YES | No | No | <2s active logs | None |
| `5cc45fd4` | DOCKERFILE | YES | No | YES | 473.3s | None |
| `e689b9c9` | DOCKERFILE | YES | No | YES | 340.4s | None |
| `cdef2b9a` | DOCKERFILE | YES | No | YES | 323.6s | None |
| `d9a75949` | NIXPACKS | NO | No | YES | 377.5s | OpenSSL/libssl not found |
| `cd54e785` | NIXPACKS | NO | No | YES | 558.9s | Same |
| `45fe513d` | NIXPACKS | NO | No | YES | 387.9s | Same |
| `b499ca3d` | NIXPACKS | NO | No | YES | 417.6s | Same |
| `1e736842` | NIXPACKS | NO | No | YES | 589.5s | Same |

**Cross-deployment verified findings:**
1. Zero node output has appeared in any log stream across all 9 deployments, including containers that ran for up to 589 seconds.
2. NIXPACKS deployments show a distinct failure: Prisma migration itself fails with OpenSSL errors. The `&&` chain would not reach `node dist/index.js` in these cases.
3. DOCKERFILE deployments (5cc45fd4, e689b9c9, cdef2b9a) show Prisma migration completing cleanly — the same pattern as `6374e890` — followed by zero node output and eventual Railway-initiated stop.
4. No deployment has produced multiple "Starting Container" events, ruling out ON_FAILURE restart cycling as a visible pattern in these log streams.
5. Commit message for `6374e890` references `prisma db push` but the running `startCommand` remains `npx prisma migrate deploy && node dist/index.js`.

**Node execution state:** UNKNOWN for all DOCKERFILE deployments. The log absence across 300+ second lifetimes increases the gap to explain, but does not constitute direct evidence of execution state.

---

## E24 — Extended log window verification (deployment 6374e890)

**Commands run:**
```
railway logs --deployment 6374e890-3ba5-4d9e-a940-ed132872bd46 --json --filter "@level:error" --lines 50
railway logs --deployment 6374e890-3ba5-4d9e-a940-ed132872bd46 --json --since 2026-06-13T22:22:00Z --until 2026-06-13T22:30:00Z
```
**When run:** Session 3  
**Status classification:** VERIFIED

**Facts extracted:**
- The extended window query (`22:22:00Z–22:30:00Z`) returned the same 13 entries as E06. No additional entries appeared in the 8 minutes following the last log line at `22:22:16.488Z`.
- The error-level filter returned only the 5 npm notice entries already present in E06.
- The 13-entry log set for deployment `6374e890` is confirmed complete.

**What this evidence does NOT prove:**
- Whether node ran and produced output that was not captured by Railway's log collector.
- Why no output appeared after `22:22:16.488Z`.

---

## E25 — Module system verification

**Files read:** `tsconfig.json`, `package.json`  
**When run:** Session 3  
**Status classification:** VERIFIED

**Relevant fields:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}

// package.json — no "type" field present
{
  "main": "dist/index.js"
}
```

**Facts extracted:**
- `tsconfig.json` declares `"module": "commonjs"`. TypeScript compiles to CommonJS output.
- `package.json` does not declare `"type": "module"`. Node.js treats `.js` files as CommonJS by default.
- `__dirname` used at `src/index.ts:55` and `require()` at `src/index.ts:35` and `src/index.ts:104` are valid in a CommonJS context.
- ESM/CJS mismatch is not a factor in the compiled output.

---

## E26 — p-limit import scan

**Command:** `grep -r "p-limit\|pLimit" src/**/*.ts`  
**When run:** Session 3  
**Status classification:** VERIFIED

**Output:** No matches found.

**Facts extracted:**
- `p-limit@^5.0.0` is listed as a dependency in `package.json`.
- No `.ts` file in `src/` imports or requires `p-limit`.
- `ERR_REQUIRE_ESM` caused by `p-limit` is not a possible failure mode — the package is never loaded at runtime.

---

## E27 — Dockerfile CMD verification

**File read:** `Dockerfile`  
**When run:** Session 3  
**Status classification:** VERIFIED

**Relevant lines:**
```dockerfile
EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
```

**Facts extracted:**
- Dockerfile CMD uses `prisma db push --skip-generate`.
- Railway runtime `startCommand` uses `npx prisma migrate deploy && node dist/index.js` (Fact #2, E08, E09, E16).
- The Railway service-level `startCommand` overrides the Dockerfile CMD at runtime. The Dockerfile CMD is never executed in production.
- The Dockerfile `EXPOSE 3001` is a hint only; Railway does not use it to configure routing.
- This confirms the startCommand discrepancy recorded in Fact #40 and E16.

**What this evidence does NOT prove:**
- Whether changing the Railway startCommand to match the Dockerfile CMD would resolve the runtime failure.

---

## E28 — Dashboard port configuration

**File read:** `src/dashboard/server.ts`  
**When run:** Session 3  
**Status classification:** VERIFIED

**Relevant line:**
```typescript
// src/dashboard/server.ts:14
const PORT = parseInt(process.env.PORT ?? process.env.DASHBOARD_PORT ?? '3001', 10);
```

**Facts extracted:**
- Dashboard uses `process.env.PORT` as first priority, falling back to `DASHBOARD_PORT`, then `3001`.
- Railway injects a `PORT` environment variable automatically. The dashboard will bind to Railway's assigned port.
- Port mismatch between dashboard and Railway proxy is not a factor.
- `DASHBOARD_PORT = 3001` is confirmed present in Railway environment variables (E02).

**What this evidence does NOT prove:**
- Whether `startDashboard()` was ever called in the deployed container.
- Whether the process reached the point of binding any port.

---

## NOT YET RUN

| Command | Purpose | Priority |
|---|---|---|
| Railway GraphQL API instance lifecycle query | Obtain exit code, stop reason, restart history — not exposed by CLI | Priority 1 |
| `railway ssh` | Direct container shell (requires running instance) | Priority 1 (blocked: needs RUNNING instance) |
| `railway redeploy` + live log stream | Reproduce failure with real-time observation | Priority 2 |
