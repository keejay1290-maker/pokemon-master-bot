# Tasks — Next Session (S16)

> Updated: 2026-06-15 (S15 wrap-up)
> Last commit pushed: `0e1e9a9` (S15: @grimbot fix, Grim rebrand, Battle V2 Lite, FK guards)
> Start by reading: `docs/S15_SESSION_HANDOFF.md` and `COMMON_MISTAKES.md`

---

## FIRST TASK — Verify @grimbot is working (P0)

Run `railway logs --tail 50` and look for:
```
[Groq] askProfessor — model=llama-3.3-70b-versatile ...
[Groq] response received — contentLen=N
```

If you see `model=llama-3.1-70b-versatile` still → the Railway deploy from S15 didn't pick up the env var change. Run `railway up --detach` to force redeploy.

**After confirming working**: test `@grimbot what is pikachu` in Discord.

---

## P0 — Deregister /auction and /professor from Discord

These command files were deleted from disk in S15 but Discord still has them registered until we run:
```
npm run deploy:commands
```
or Railway runs it automatically on next deploy. Confirm the commands are gone from Discord's slash menu.

---

## P0 — Inject GrimRipperCards stream schedule into Professor Grim system prompt

User request from S15: audit `https://www.whatnot.com/en-GB/user/grimrippercards` for:
- Current stream schedule (days/times)
- Recent highlights or notable streams
- Any recurring formats (pack openings, box breaks, etc.)

Then update the system prompt in `src/services/groqService.ts` (`PROFESSOR_GRIM_SYSTEM_PROMPT`) — replace the placeholder "stream schedule not yet configured" section with real schedule data.

---

## P1 — Work Commands Tiered Shop + XP System

User request from S15: each work command (/work, /fish, /hunt) should have:
- Per-job tiered rewards (higher tier = better loot, requires progression)
- XP system tied to career level
- Each job has its own shop with required Pokémon-related materials (e.g., Fishing Rod upgrades from Pokémon drops)

**Before implementing**: read `src/commands/economy/career.ts`, `src/commands/economy/work.ts`, `src/commands/economy/hunt.ts`, `src/commands/economy/fish.ts` (if they exist), and the career DB schema. Plan the tier/XP system in a design doc first.

---

## P1 — Remove auctionJob.ts (if no active auctions in DB)

Check the DB for any active auction listings:
```typescript
await client.prisma.marketListing.count({ where: { isAuction: true, status: 'active' } })
```
If 0 → remove `src/jobs/auctionJob.ts` and the import from `src/jobs/index.ts`.

---

## P1 — REDIS_URL on Railway

Verify `REDIS_URL` is set in Railway env vars. If not, add Railway Redis add-on.
`client.redis.isReady` guards are in place but pack sessions and cooldowns won't persist.

---

## P1 — /deploy-commands after /bank and /rewards

`/bank` and `/rewards` commands were committed but never deployed. Run:
```
npm run deploy:commands
```
to register them.

---

## P2 — Battle V2 Full (Schema Migration)

Battle V2 Lite is complete. V2 Full requires:
1. Schema migration: add `statusInflict String?`, `effectChance Int?`, `priority Int @default(0)`, `recoilPercent Float?`, `healPercent Float?` to `PokemonMove`
2. PokeAPI re-seed script: ~500 move calls to populate status/priority/recoil data
3. Wire status from DB (replace `tryInflictStatus` type-inference with real DB data)
4. Priority moves: Quick Attack, Extreme Speed go first regardless of speed

See `docs/MOVE_DATA_AUDIT.md` for full spec.

---

## P2 — Quest completion DM

No DM is sent when a quest completes. Add DM notification in `questService.ts` `incrementQuestProgress()` when a quest reaches completion.

---

## Carry-Forward Bugs

| ID | Description | Priority |
|----|-------------|----------|
| GRIMBOT-OFFLINE | Verify @grimbot works after S15 env var fix | 🔴 P0 |
| DISCORD-DEPLOY | /auction and /professor still registered on Discord | 🔴 P0 |
| STREAM-SCHEDULE | Professor Grim system prompt missing stream schedule | 🔴 P0 |
| WORK-TIER-SHOP | Work commands need tiered rewards + job shops | 🟡 P1 |
| AUCTION-JOB | auctionJob.ts can be removed once DB listings are clear | 🟢 P2 |
| REDIS-URL-RAILWAY | REDIS_URL may not be set in Railway | 🟡 P1 |
| BATTLE-V2-FULL | Schema migration for status/priority/recoil from PokeAPI | 🟢 P2 |
| QUEST-SILENT | No DM on quest completion | 🟡 P1 |

---

## S15 Completed Deliverables

| Feature | Status | Commit |
|---------|--------|--------|
| @grimbot root cause confirmed + Railway env var fixed | ✅ | `0e1e9a9` |
| groqService model validation (rejects stale GROQ_MODEL) | ✅ | `0e1e9a9` |
| Professor Grim rebrand (system prompt + embeds + beg.ts) | ✅ | `0e1e9a9` |
| /auction command removed | ✅ | `0e1e9a9` |
| /professor ask command removed | ✅ | `0e1e9a9` |
| PACK-IMAGES-NULL card-back fallback | ✅ | `0e1e9a9` |
| DB-FK-GUILDUSER ensureUser guards (messageCreate + spawnService) | ✅ | `0e1e9a9` |
| Battle V2 Lite fully wired (status DoT, block, accuracy, inflict, crit, speed order, coins) | ✅ | `0e1e9a9` |
| BattleState.roundLeaderId field | ✅ | `0e1e9a9` |
| AI_MENTION_SYSTEM.md root cause documented | ✅ | `0e1e9a9` |

---

## Arch Reminders

- `addXp(prisma, userId, N)` — never raw `trainerXp: { increment: N }`
- `transferBalance` throws `'INSUFFICIENT_FUNDS'` — always catch
- `calcDamage()` in `battleService.ts` is the ONLY damage source — never inline
- `PokemonMove` rows may not exist — always fall back to `MOVE_TABLE`
- Button customId prefix must be in `interactionCreate.ts` or silently fails
- After schema: `npx prisma generate` → `npm run build` → `npm run db:push`
- Pack itemId format: `pack:${setId}` — never use set name
- `client.redis.isReady` check before every Redis call (or `.catch(() => null)`)
- Discord slash command `.setDescription()` max 100 chars — exceeding = Railway crash
- Professor Grim AI entry point = @mention ONLY (not /professor)
- `/auction` is removed — direct sale is `/market` only
