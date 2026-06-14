# INVESTIGATION SUMMARY
**Project:** pokemon-master-bot  
**Scope:** This file applies ONLY to the pokemon-master-bot repository and Railway project.  
**Last updated:** 2026-06-14 (Session 2)  

---

## SECTION 1 — EXECUTIVE SUMMARY

**Incident:** Pokemon Master Bot is not serving requests. All slash commands are non-responsive.

**Production impact:**
- HTTP endpoint `https://pokemon-master-bot-production.up.railway.app/health` returns 502.
- Bot does not respond to Discord slash commands.
- Service is not running.

**Current deployment state:**
- Deployment `6374e890` build status: SUCCESS
- Instance `e47c1968` runtime status: EXITED
- `deploymentStopped: true`

**Investigation status:** INCOMPLETE  
The failure boundary has been narrowed. Build logs confirm the Docker image contains compiled `dist/` output. HTTP access logs confirm Railway could not reach a listener after the container started. What happens between migration completion and instance EXITED — whether `node dist/index.js` executes, what exit code is produced, and why no listener is ever reached — remains UNKNOWN.

**Current confidence level:** HIGH confidence in all facts listed in Section 2. LOW confidence in any statement about what happens after the last log line at `22:22:16.488Z`.

---

## SECTION 2 — VERIFIED FACTS

| # | Fact | Evidence | Source |
|---|---|---|---|
| 1 | Builder = DOCKERFILE | `fileServiceManifest.build.builder: "DOCKERFILE"` | `railway deployment list --json` |
| 2 | Runtime start command = `npx prisma migrate deploy && node dist/index.js` | `serviceManifest.deploy.startCommand` and `serviceInstance.startCommand` | `railway status --json` + `railway deployment list --json` |
| 3 | Deployment `6374e890` build status = SUCCESS | `"status": "SUCCESS"` | `railway deployment list --json` |
| 4 | Deployment `6374e890` imageDigest exists | `sha256:e7fb3336ea1c457d76c05a9946057369a24dcc5bd8ac6d91ffc9d7a8f1dcda97` | `railway deployment list --json` |
| 5 | Instance `e47c1968` runtime status = EXITED | `"instances": [{"status": "EXITED"}]` | `railway status --json` |
| 6 | `deploymentStopped = true` for deployment `6374e890` | `"deploymentStopped": true` | `railway status --json` |
| 7 | Service endpoint returns HTTP 502 | `curl` response body: `"Application failed to respond"`, `HTTP_STATUS:502` | Live HTTP test |
| 8 | Container started | Log entry: `"Starting Container"` at `2026-06-13T22:22:15.608657501Z` | `railway logs --deployment 6374e890 --json` |
| 9 | `prisma migrate deploy` ran inside container | Log entries: `"No migration found in prisma/migrations"`, `"Prisma schema loaded..."`, `"No pending migrations to apply."` | `railway logs --deployment 6374e890 --json` |
| 10 | Last log entry for deployment `6374e890` | `"npm notice"` (level: error) at `2026-06-13T22:22:16.488122433Z` | `railway logs --deployment 6374e890 --json` |
| 11 | Total log entries for deployment `6374e890` | 13 entries. All within 880ms of container start. | Full JSON parse of `railway logs --deployment 6374e890 --json` |
| 12 | No "Stopping Container" event in `6374e890` logs | Absent from complete 13-entry log set | Full JSON parse |
| 13 | Only 1 "Starting Container" event in `6374e890` logs | Count from full JSON parse = 1 | Full JSON parse |
| 14 | `prisma migrate deploy` exits 0 | Local execution: `EXIT_CODE:0` | Local terminal test |
| 15 | Railway captures stderr for this service | npm notices appear at `"level": "error"` in JSON logs | `railway logs --deployment 6374e890 --json` |
| 16 | Deployment `5cc45fd4` emitted "Stopping Container" | Log entry: `"Stopping Container"` at `2026-06-13T22:01:08.740249710Z` | `railway logs --deployment 5cc45fd4 --json` |
| 17 | Deployment `5cc45fd4` container lifetime | 473.3 seconds (21:53:15Z to 22:01:08Z) | Calculated from log timestamps |
| 18 | `healthcheckPath = null` | `"healthcheckPath": null` | `railway status --json` |
| 19 | `healthcheckTimeout = null` | `"healthcheckTimeout": null` | `railway status --json` |
| 20 | Restart policy = ON_FAILURE, max 5 retries | `"restartPolicyType": "ON_FAILURE"`, `"restartPolicyMaxRetries": 5` | `railway status --json` |
| 21 | Deployment `6374e890` commit hash | `1fe83916a4e542da5bcb3f86c5ccb7a132ce718c` | `railway deployment list --json` |
| 22 | Domain `targetPort = null` | `"targetPort": null` | `railway status --json` |
| 23 | `REDIS_URL` environment variable = empty string | Shown as blank in variable table | `railway variables` |
| 24 | `pokemon-master-redis` service runs Postgres image | `"image": "ghcr.io/railwayapp-templates/postgres-ssl:18"` | `railway status --json` |
| 25 | `dist/` directory is gitignored and not tracked in git | Entry in `.gitignore`; `git ls-files dist/` returns empty | Repository inspection |
| 26 | `railway logs` flag `--build` is available | Documented in `railway logs --help` | CLI help output |
| 27 | Docker build step `[builder 9/9] RUN npm run build` completed without error | Vertex completed at `22:21:42.051Z`; only stdout output was `> pokemon-master-bot@1.0.0 build\n> tsc\n\n`; no error lines emitted | `railway logs --build 6374e890 --json` (E14) |
| 28 | tsc produced no error output during build | The log entry for the build vertex contains only the build header line and no TypeScript diagnostics | `railway logs --build 6374e890 --json` (E14) |
| 29 | `[production 5/8] COPY --from=builder /app/dist ./dist` completed | Vertex entry shows `cached: true`, `completed` timestamp present | `railway logs --build 6374e890 --json` (E14) |
| 30 | `dist/` directory exists inside the deployed Docker image | Build stage produced `dist/` (Facts 27–28); production stage copied it (Fact 29) | `railway logs --build 6374e890 --json` (E14) |
| 31 | Production image export completed successfully | Log entry: `exporting to docker image format` completed at `22:21:59.074Z`; image size: 159,934,523 bytes | `railway logs --build 6374e890 --json` (E14) |
| 32 | HTTP access log shows "connection dial timeout" for all requests | Three retry attempts of 5000ms each; `upstreamAddress`: `""`; no upstream connection established | `railway logs --http --json` (E15) |
| 33 | HTTP access log `deploymentInstanceId` for failed requests = all-zeros UUID | `"deploymentInstanceId": "00000000-0000-0000-0000-000000000000"` — Railway proxy had no active instance to route to | `railway logs --http --json` (E15) |
| 34 | No HTTP listener was reached by Railway's proxy at any point | Every HTTP request resulted in `upstreamAddress: ""`; no successful upstream connection recorded | `railway logs --http --json` (E15) |
| 35 | Zero node output across ALL 4 DOCKERFILE deployments (6374e890, 5cc45fd4, e689b9c9, cdef2b9a) | No application-level log message appears in any of the four deployments' log streams | E07, E17, E18 |
| 36 | Zero node output persists across container lifetimes of 323–473 seconds for DOCKERFILE builds with completed migrations | E689b9c9 lived 340s, cdef2b9a 323s, 5cc45fd4 473s — all with no node output | E07, E17, E18 |
| 37 | No deployment shows multiple "Starting Container" events | Single "Starting Container" per deployment across all 9 deployments retrieved | E06, E07, E17–E23 |
| 38 | NIXPACKS deployments failed at Prisma migration with OpenSSL error | Error: "Prisma failed to detect the libssl/openssl version"; "Could not parse schema engine response" | E19–E23 |
| 39 | NIXPACKS deployments show Prisma migration failure followed by zero node output | Migration errors are logged; no node-level output follows in any of the 5 NIXPACKS deployments | E19–E23 |
| 40 | Commit `1fe83916` message says "use prisma db push instead of migrate deploy" but actual running startCommand is still `npx prisma migrate deploy && node dist/index.js` | Both `fileServiceManifest.deploy` and `serviceManifest.deploy.startCommand` in `6374e890` metadata confirm the startCommand unchanged | E16 |
| 41 | Deployment `6374e890` log set is definitively complete at 13 entries | Extended window query (`22:22:00Z–22:30:00Z`) returned the same 13 entries. No additional entries in the 8 minutes after `22:22:16.488Z`. | E24 |
| 42 | TypeScript is compiled to CommonJS output | `tsconfig.json`: `"module": "commonjs"`. `package.json`: no `"type"` field. | E25 |
| 43 | `__dirname` and `require()` usage in `src/index.ts` are valid | Both are CommonJS globals; output module format is CJS. | E25 |
| 44 | `p-limit` is not imported anywhere in `src/` | Grep of `src/**/*.ts` for `p-limit` and `pLimit` returned no matches. | E26 |
| 45 | Dockerfile CMD uses `prisma db push --skip-generate`; Railway startCommand uses `prisma migrate deploy` | Railway service-level `startCommand` overrides Dockerfile CMD. Dockerfile CMD is never executed at runtime. | E27 |
| 46 | Dashboard binds to `process.env.PORT` first, not a hardcoded port | `src/dashboard/server.ts:14`: `process.env.PORT ?? process.env.DASHBOARD_PORT ?? '3001'`. Railway's `PORT` injection is consumed correctly. | E28 |

---

## SECTION 3 — REJECTED THEORIES

| Theory | Reason Rejected | Evidence |
|---|---|---|
| nixpacks.toml used as build system | Deployment metadata explicitly shows `builder: "DOCKERFILE"` | Fact #1 above |
| Dockerfile CMD vs. runtime command mismatch | Both use the same command; `startCommand` overrides Dockerfile CMD at service level — confirmed in `serviceManifest` | Facts #1, #2 |
| Prisma migration failure causing abort | Migration completes with exit 0 and correct output | Facts #9, #14 |
| Healthcheck path killing container | `healthcheckPath = null` — no HTTP healthcheck configured | Facts #18, #19 |
| Different runtime commands between deployments | Both `6374e890` and `5cc45fd4` show identical `startCommand` | `railway deployment list --json` for both |
| `railway run ls dist/` proving dist/ absent from container | `railway run` executes on the local machine filesystem with Railway env vars injected. It does NOT inspect the deployed container. That test result is invalid for container-content claims. | Methodology verification |
| `dist/index.js` is absent from the deployed Docker image | Build logs confirm `npm run build` (tsc) completed without error; production stage `COPY --from=builder /app/dist ./dist` completed. `dist/` exists in the image. | Facts #27–30 (E14) |
| ESM/CJS mismatch causing module load failure | `tsconfig.json` compiles to CommonJS. `package.json` has no `"type": "module"`. `__dirname` and `require()` are valid in the compiled output. | Facts #42–43 (E25) |
| `p-limit` ESM-only package causing `ERR_REQUIRE_ESM` | `p-limit` is listed as a dependency but is not imported anywhere in `src/**/*.ts`. It is never loaded at runtime. | Fact #44 (E26) |
| Dashboard port mismatch causing 502 | Dashboard uses `process.env.PORT` as first priority. Railway's `PORT` injection is consumed correctly. Port mismatch is not a factor. | Fact #46 (E28) |

---

## SECTION 4 — ACTIVE UNKNOWNS

| # | Unknown | Why it matters |
|---|---|---|
| U1 | ~~What files are inside the deployed Docker image?~~ | **RESOLVED** — Build logs confirm `dist/` exists in the image. See Facts #27–30. |
| U2 | ~~What output did the Docker build stage produce?~~ | **RESOLVED** — Build logs confirm `npm run build` (tsc) completed without errors. See Facts #27–28. |
| U3 | ~~Are there HTTP access logs after container start?~~ | **RESOLVED** — HTTP logs retrieved. Railway proxy could not reach any listener. See Facts #32–34. |
| U4 | ~~Does ESM/CJS mismatch affect the compiled output?~~ | **RESOLVED** — Output is CJS. `__dirname` and `require()` are valid. See Facts #42–43. |
| U5 | ~~Could p-limit (ESM-only) cause ERR_REQUIRE_ESM?~~ | **RESOLVED** — p-limit is not imported anywhere. See Fact #44. |
| U6 | ~~Does the dashboard hardcode a port that Railway cannot route to?~~ | **RESOLVED** — Dashboard uses `process.env.PORT` first. Port mismatch eliminated. See Fact #46. |
| U8 | Did `node dist/index.js` execute inside the container? | Core failure boundary. `dist/` exists in the image; the command could run — but no node output has appeared in any log stream across all DOCKERFILE deployments. Node execution state remains unknown. |
| U9 | What was the process exit code when the instance exited? | Determines whether ON_FAILURE restarts were triggered. Not exposed by Railway CLI (status, deployment list, or metrics commands). |
| U10 | What occurred between Prisma migration completion and instance EXITED state? | The full runtime lifecycle after `22:22:16.488Z` is unobserved. No log entry, no exit code, no stop reason is available. |
| U11 | What internal stop reason did Railway record? | Not exposed by `railway deployment list --json` or `railway status --json`. Potentially accessible via Railway GraphQL API (not yet tried). |
| U12 | Were any ON_FAILURE restart attempts made? | Only 1 "Starting Container" event observed per deployment. If retries occurred, they may not be captured in the same log stream or may appear under a different mechanism. |

---

## SECTION 5 — FAILURE BOUNDARY

```
VERIFIED:
  2026-06-13T22:21:29Z  Deployment 6374e890 build marked SUCCESS
  2026-06-13T22:21:36Z  [builder 9/9] RUN npm run build started
  2026-06-13T22:21:42Z  [builder 9/9] RUN npm run build completed — tsc produced no errors
  2026-06-13T22:21:57Z  [production 5/8] COPY --from=builder /app/dist ./dist — completed
  2026-06-13T22:21:59Z  Production image exported (159,934,523 bytes)
  2026-06-13T22:22:15Z  Container starts ("Starting Container")
  2026-06-13T22:22:16Z  prisma migrate deploy runs
  2026-06-13T22:22:16Z  prisma migrate deploy completes (last log at 22:22:16.488Z)
                         dist/ confirmed present in deployed image

══════════════════════════════════════════════════════════════════
  UNKNOWN — NO LOG EVIDENCE EXISTS BEYOND THIS LINE
══════════════════════════════════════════════════════════════════

  ???   node dist/index.js execution state
  ???   any node process output
  ???   process exit code
  ???   number of ON_FAILURE restart attempts
  ???   stop reason

VERIFIED:
  (at some point)       Instance e47c1968 status → EXITED
  (at some point)       deploymentStopped → true
  (at query time)       HTTP requests → connection dial timeout; upstreamAddress = ""; no listener reached
```

---

## SECTION 6 — HYPOTHESES NOT YET PROVEN

These are candidate explanations. None are findings. None should be acted on until evidence is collected.

| Hypothesis | Status | What would prove it | What would disprove it |
|---|---|---|---|
| `dist/index.js` does not exist in Docker image (build stage failed silently) | **DISPROVEN** — Build logs confirm tsc succeeded and dist/ was COPY'd into the production stage. | — | Facts #27–30 (E14) |
| `node dist/index.js` ran and exited immediately with code 0 (no restart triggered) | UNCONFIRMED | Exit code = 0 obtained from Railway; no node output found anywhere | Non-zero exit code confirmed; or node output found |
| `node dist/index.js` ran and exited with non-zero, triggering ON_FAILURE retries not captured in log query | UNCONFIRMED | Logs from FAILED deployments show node output or multiple "Starting Container" events | Exhaustive log retrieval shows single run only |
| `deploymentStopped: true` was set by a manual user action | UNCONFIRMED | Railway audit log or user action record | No user action recorded |
| Node produced log output that was not captured by Railway's collector | UNCONFIRMED | Node output found in a different log stream or window | Confirmed absence after exhaustive log retrieval |

---

## SECTION 7 — INVESTIGATION STATE SNAPSHOT

**Boundary as of Session 3 end:**

The deployed Docker image is confirmed correctly built: `npm run build` (tsc) succeeded, `dist/` was copied into the production image, and the compiled output is CommonJS — eliminating ESM/CJS mismatch, `p-limit` ERR_REQUIRE_ESM, and dashboard port mismatch as failure causes. The 13-entry log set for deployment `6374e890` is confirmed complete across an extended 8-minute window. All surviving failure hypotheses relate to what happens after Prisma migration completes inside the container — a lifecycle window for which no log evidence exists.

Railway CLI does not expose instance exit codes, stop reasons, or restart history through any of its commands (`status`, `deployment list`, `metrics`).

**Resolved across all sessions:**
- `dist/` exists in the deployed image (E14)
- `npm run build` (tsc) succeeded without errors (E14)
- HTTP logs retrieved; no listener was reached (E15)
- Extended log window confirms 13-entry set is complete (E24)
- ESM/CJS mismatch eliminated (E25)
- `p-limit` ERR_REQUIRE_ESM eliminated (E26)
- Dashboard port mismatch eliminated (E28)

**Remaining active unknowns:** U8, U9, U10, U11, U12

**What has NOT been tried yet:**
- Railway GraphQL API — may expose instance lifecycle data not available via CLI (Priority 1)
- `railway ssh` — direct container shell (requires RUNNING instance, currently EXITED)
- Live redeploy with streaming logs

**No changes were made to code, configuration, or Railway settings during this investigation.**
