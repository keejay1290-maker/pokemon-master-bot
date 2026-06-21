# Dashboard Security Hardening

Date: 2026-06-21

## Implemented

- Production startup now rejects missing dashboard session and Discord OAuth environment variables.
- Development no longer uses a known fallback session secret; it generates an ephemeral secret and logs a warning.
- Session cookies are HTTP-only, same-site, secure in production, and use a non-default cookie name.
- Production enables Express proxy trust for secure cookies behind Railway or another reverse proxy.
- CORS is restricted to the configured dashboard origin and expected methods.
- JSON request bodies are limited to 32 KB.
- Every guild-scoped API route now requires authentication and Manage Server or Administrator permission.
- Discord permission values are parsed with `BigInt`, avoiding unsafe integer truncation.
- Guild setting updates use strict Zod validation with bounded values and reject unknown or empty payloads.
- Public query parameters for leaderboards, pagination, and giveaways are validated.
- Async route failures are handled centrally and logged without leaking internal errors.

## Validation

- `npm run typecheck`: pass
- Dashboard source lint: pass
- `npm test -- --runInBand`: 5 suites, 31 tests pass

## Remaining Work

- Add a distributed API rate limiter.
- Add CSRF tokens if the dashboard gains cross-site form or cookie-authenticated POST workflows.
- Move production sessions to Redis once Redis is guaranteed to be provisioned.
- Add HTTP integration tests when the project adopts a request-test dependency such as Supertest.
