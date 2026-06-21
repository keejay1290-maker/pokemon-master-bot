# Pack Reveal Recovery

Date: 2026-06-21

## Fixed

- Removed the Redis reveal lock from the interactive pack path.
- PostgreSQL `PackSession.currentIndex` compare-and-swap is now the only reveal
  concurrency authority.
- Button clicks are acknowledged before database or cache work, preventing
  Discord's three-second interaction timeout.
- Older `pack:lock:*` keys can no longer strand a valid PostgreSQL session behind
  a permanent "Already revealing" response.
- Added a regression test proving a reveal advances through PostgreSQL without
  creating or consulting a Redis reveal lock.

## Safety

Duplicate grants remain prevented by:

```text
UPDATE pack_sessions
SET current_index = current_index + 1
WHERE session_id = ? AND current_index = expected_index
```

Only one concurrent click can advance the expected index. Losing clicks receive
the latest-message notice without granting another card.
