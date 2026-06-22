# Spawn System Recovery Handover

Date: 2026-06-22

## Outcome

The chat spawn and Pokédex collection path was rebuilt around persistent database state. Wild encounters no longer require Redis to function, multiple encounters can coexist, and administrators can configure or force spawns directly from Discord.

## Confirmed Root Causes

1. `src/index.ts` treated Redis as optional, but `handleSpawnMessage()` called Redis without a readiness guard.
2. `messageCreate.ts` swallowed spawn exceptions, so Redis failures looked like the bot simply stopped spawning.
3. `Guild.spawnRate` existed but was ignored; a hard-coded 5% chance was always used.
4. One Redis `guildSpawn` pointer represented only one active spawn per guild, so concurrent/multi-channel encounters overwrote each other.
5. Catch buttons depended on an in-memory message collector. A restart left visible buttons that could no longer be handled.

## Implemented

- Database fallback for automatic-spawn cooldowns when Redis is unavailable.
- Redis `SET NX EX` cooldown claim when Redis is healthy.
- Persistent `catch_spawn:<spawnId>` buttons routed through `interactionCreate`.
- Atomic database claim + `UserPokemon` creation + collection counter update.
- Multiple active encounters per guild and per channel.
- Multiple configured channels through `Guild.spawnChannelIds`.
- Automatic channel mode:
  - `random`: one configured channel per wave.
  - `all`: one encounter in every configured channel per wave.
- `/spawn now` supports forced count, target channel, all-channel waves, and exact Pokémon name/Pokédex number.
- `/spawn channels`, `/spawn settings`, and `/spawn status`.
- `/catch` now lists up to five active database-backed encounters.
- Full setup writes the generated `poke-spawns` channel into the new channel list.
- Permission checks for View Channel, Send Messages, and Embed Links.
- Spawn errors are logged instead of silently discarded.

## Schema Change

`Guild` now includes:

```prisma
spawnChannelIds String[] @default([])
spawnMode       String   @default("random")
```

Apply before deploying:

```bash
npm run db:push
```

The legacy `pokeSpawnsChannelId` is read for backward compatibility. The first `/spawn channels` mutation writes the merged list and clears the legacy field.

## Verification

- `npm run typecheck`
- `npx jest tests/spawnService.test.ts --runInBand`
- `npx prisma validate`
- Focused ESLint run on changed source files

Broader test result before applying the schema to the configured local database: **59 passed, 1 failed**. The only failure is `tests/cooldown.test.ts`, because the existing database does not yet have `guilds.spawnChannelIds`. This is the expected deployment gate and is resolved by `npm run db:push`.

The repository-wide lint command still reports unrelated pre-existing errors in other features. Changed spawn files have no lint errors; `messageCreate.ts` retains two pre-existing `no-explicit-any` warnings in the Professor Grim handler.

## Live Test Checklist

1. `/spawn status`
2. Add two channels with `/spawn channels action:add`.
3. Set `mode:random`, force three encounters, and catch each one.
4. Set `mode:all`, send messages until a wave triggers, and verify one spawn per configured channel.
5. Restart the bot while an encounter is active; its button must still work.
6. Stop Redis and verify automatic spawning still works after the configured database cooldown.
7. Confirm each catch appears in `/pokedex` and that two users cannot claim the same encounter.

## Follow-up Ideas

- Per-channel weights and quiet hours.
- Seasonal encounter tables and biome-themed channel pools.
- Admin-selectable shiny/manual rarity override.
- A scheduled “safari wave” event with a capped number of concurrent encounters.
