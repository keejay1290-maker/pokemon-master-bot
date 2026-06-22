# Changelog

## 2026-06-22 — Spawn System Recovery

- Fixed silent spawn failure when Redis is unavailable by adding a database cooldown fallback.
- Made spawn catches database-authoritative and restart-safe through the global button router.
- Added concurrent encounters and multiple configured spawn channels.
- Added `/spawn now`, `/spawn channels`, `/spawn settings`, and `/spawn status` administrator controls.
- Connected the existing `spawnRate` guild setting to the actual per-message spawn probability.
- Made catch ownership and Pokédex collection creation atomic in one database transaction.

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Initialized Git repository to track AI continuation work.
- Added `CLAUDE.md`, `NEXT_STEPS.md`, and `CHANGELOG.md` for project tracking.
- Added `.gitignore` for generated build, dependency, coverage, and environment files.
- Added Redis key helpers for guild spawn lookup.
- Added Jest module mapping for local `.js` imports emitted from TypeScript-style source imports.

### Fixed
- Fixed spawn catch atomicity by replacing Redis `MULTI` `GET`/`DEL` with single-command `GETDEL`.
- Fixed `/catch` to read active spawn state from Redis instead of removed in-memory `client.activeSpawns`.
- Fixed TypeScript build blockers in shared command typing, spawn move selection, moderation channel narrowing, and `node-cron` typing.
- Fixed Pokemon dual-type effectiveness test expectation for Electric vs Water/Flying.
