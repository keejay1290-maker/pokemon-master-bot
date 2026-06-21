# Dashboard Redis Sessions

Date: 2026-06-21

## Implemented

- Replaced the production `express-session` `MemoryStore` with
  `connect-redis` v7.
- Reused the bot's existing Redis client.
- Added a dedicated `pokemon-master:dashboard-session:` key prefix.
- Session TTL matches the seven-day secure cookie lifetime.
- Production startup now requires `REDIS_URL`.
- Production dashboard startup waits up to ten seconds for Redis and fails if
  Redis does not become ready.
- Development may fall back to the in-memory store with an explicit warning.

## Result

The dashboard no longer emits the production MemoryStore warning when Redis is
healthy, sessions survive process restarts, and multiple bot instances can
share authenticated dashboard sessions.
