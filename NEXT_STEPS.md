# Next Steps

This file tracks the immediate and upcoming tasks for the Pokemon Master Bot.

## Current Task: P0 - Redis State Migration Verification
- [x] Verify repository identity before modifications
- [x] Replace non-atomic spawn catch claim with Redis `GETDEL`
- [x] Remove remaining `/catch` dependency on `client.activeSpawns`
- [x] Confirm command cooldowns are Redis-backed
- [x] Repair build and Jest verification blockers
- [x] Run typecheck, build, and tests successfully

## Upcoming Tasks
- **P0 - Economy Transaction Safety**
* Existing economy transaction edits are present and should be reviewed next as a separate logical task.
- **P0 - Redis State Migration (VERIFIED WITH FOLLOW-UP RISKS)**
* Moved all in-memory `Map` objects (`client.activeSpawns`, `client.activeBattles`, `client.spawnTimers`) to Redis.
* Ensured state persists across bot restarts.
* Cooldowns migrated to use Redis TTLs.
* Spawn catch claims now use Redis `GETDEL` to prevent double catches.
* Implemented cross-request concurrency locks (`battle:user:{userId}`) to prevent users from starting overlapping battles.
- Remaining follow-up: improve Redis outage/degraded-mode handling; current startup and command paths mostly fail closed when Redis is unavailable.
- **P0 - Dashboard Security**: Add CSRF protection, enforce auth routes, migrate session storage.
- **P1 - Database Indexes**: Update `schema.prisma` with appropriate indexes.
- **P1 - Structured Logging**: Enforce use of Winston over `console.log`.
