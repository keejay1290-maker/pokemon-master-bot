# Slash Command Deployment Report — S3 (2026-06-14)

> Run: `railway run --service pokemon-master-bot npm run deploy:commands`
> Result: ✅ `Deploying 42 commands... ✅ Commands deployed globally!`

## Registration summary

| Metric | Value |
|---|---|
| Commands registered | 42 |
| Scope | Global (all servers) |
| Propagation | Up to 1 hour |
| Failures | 0 |
| Warnings | 0 |
| Skipped | 0 |

## Command list (all 42 registered)

**Economy:** `/balance`, `/beg`, `/daily`, `/weekly`, `/work`, `/fish`, `/hunt`, `/rob`, `/deposit`, `/withdraw`, `/shop`

**Pokémon:** `/box`, `/pokedex`, `/pokemon`, `/catch`, `/team`, `/trade`, `/favorite`

**Cards/TCG:** `/pack`, `/collection`, `/card`

**Battles:** `/battle`

**Social:** `/profile`, `/achievements`, `/quests`, `/leaderboard`

**Utility:** `/ping`, `/help`, `/professor`, `/setup`, `/welcome`

**Giveaways:** `/giveaway`

**Admin:** `/config`

**Moderation:** `/ban`, `/kick`, `/timeout`, `/warn`, `/warnings`, `/purge`, `/lock`, `/unlock`, `/slowmode`

## Notes

- Registration method: `REST.put(Routes.applicationCommands)` — global, affects all guilds.
- Not run automatically on deploy — must be re-run after adding or removing commands.
- Recommended: add `npm run deploy:commands` as a Railway **Pre-Deploy** command or trigger it from CI after push.
- Missing: `/buy` (not implemented), `/unban` (not implemented) — not registered because they don't exist yet.
