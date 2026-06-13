# Pokemon Master Bot - AI Continuation Notes

This file serves as the main documentation for AI assistants working on this repository.

## Project Purpose
A Pokemon Discord bot built with TypeScript, discord.js, Prisma, PostgreSQL, and Redis. Features include spawning Pokemon, turn-based battles, economy, TCG card packs, and an AI Professor Oak integration.

## Current State
The project has undergone a comprehensive audit. It is a feature-rich hobby project but currently lacks production readiness. The primary architectural issue is the heavy reliance on in-memory state (battles, spawns, cooldowns), which prevents scaling and causes data loss on restart. The economy also suffers from missing transaction safety.

## Development Roadmap
Priority order as defined by the user:

### P0 — CRITICAL
1. Economy transaction safety
2. Redis state migration
3. Dashboard security

### P1 — HIGH
4. Database indexes
5. Structured logging
6. Health check endpoint
7. Retry logic for external APIs
8. Input validation using Zod
9. User/API rate limiting

### P2 — MEDIUM
10. Integration testing
11. CI/CD pipeline
12. Service abstraction improvements
13. Performance optimization

## Git Rules
* Ensure branch is correct before starting.
* Pull latest changes if necessary.
* Run lint, typecheck, and tests before committing.
* Commit after every logical task with conventional commit format (e.g. `feat: ...`, `fix: ...`, `security: ...`).
* Keep documentation synchronized.
