# Tasks — Next Session (S15)

> Updated: 2026-06-15 (S14 wrap-up)
> Last commit pushed: `a9d76e0` (pack open interaction fix + tier pricing)
> Start by reading: `docs/S14_SESSION_HANDOFF.md` and `COMMON_MISTAKES.md`

---

## FIRST TASK — @grimbot / Professor Grim AI (STILL BROKEN — P0)

@mention AI is still returning "My research terminal seems to be offline right now."
The model fix (`llama-3.3-70b-versatile`) is committed but the bot may not be running
the latest code, OR `GROQ_API_KEY` is missing/invalid on Railway.

**Diagnosis steps (do these first):**
1. `railway logs --tail 50` — search for `[Groq]` lines
2. If `GROQ_API_KEY present=false` → add key to Railway env vars
3. If `API error — status=400` → model issue, switch to `llama-3.1-8b-instant`
4. If `API error — status=401` → rotate key at console.groq.com
5. If no `[Groq] module loaded` line → the groqService.ts fix was never deployed; run `railway up --detach`

**After fixing:** Rename the AI persona from "Professor Oak" to "Professor Grim":
- Update system prompt in `groqService.ts`: character is "Professor Grim" — GrimRipperCards' in-house Pokémon expert
- Professor Grim knows: all Pokémon species/mechanics, Grim's livestream schedule and highlights, all bot commands
- Add livestream knowledge section to system prompt (ask user for stream schedule/highlights content to inject)
- Keep the @mention flow identical — only the persona name and knowledge base changes

---

## P0 — Remove /auction command

The `/auction` command was supposed to be removed in a previous session but still exists.
**Remove it:**
1. Delete `src/commands/economy/auction.ts` (verify file path first)
2. Remove any import/registration in `deploy-commands.ts`
3. Remove any button/select handlers in `interactionCreate.ts` with `auction_` prefix
4. `npm run build` → `npm run deploy:commands` → verify command no longer shows in Discord
5. Check `auctionJob.ts` — if it only serves the auction command, schedule its removal too

---

## P0 — Remove /professor ask command

The `/professor ask` slash command was supposed to be replaced entirely by the @mention system.
**Remove it:**
1. Delete `src/commands/utility/professor.ts`
2. Remove import/registration in `deploy-commands.ts`
3. `npm run deploy:commands` to deregister from Discord
4. The @mention path is the ONLY AI entry point going forward

---

## P0 — Card images missing in pack reveal (PACK-IMAGES-NULL)

Some cards from the TCG API return `images: {}` or no images field.
Affects: older sets (Base Set era), promos, some SV trainer cards.
Current code in `packRevealHandler.ts`:
```typescript
if (card.imageLarge) embed.setImage(card.imageLarge);
else if (card.imageSmall) embed.setThumbnail(card.imageSmall);
// else: no image at all
```
**Fix:** Either filter imageless cards out during `openPack()`, or add a placeholder
card-back image URL as fallback. Placeholder option preferred — every card should
show something.

---

## P0 — FK constraint on XP upsert for new users (DB-FK-GUILDUSER)

`guildUser.upsert()` in `messageCreate.ts` fails for brand-new members with
`guild_users_userId_fkey` FK violation because no `User` record exists yet.
**Fix:** Call `ensureUser(client.prisma, userId)` before the `guildUser.upsert()` call.
Also check `spawnService.ts` for the same pattern before `userPokemon.create`.

---

## P1 — Battle V2 Lite wiring into battle.ts

Helpers are all committed in `battleService.ts` (`3333cb8`) — none are wired yet.
Wire in this order:
1. `applyStatusDamage()` at turn start before move
2. `checkStatusBlock()` before move execution
3. `checkAccuracy()` before `calcDamage()`
4. `💥 Critical hit!` log line when `isCrit` is true
5. Speed-based `roundLeaderId` recomputed each round
6. Coin reward on battle win (50 + turns×2 + ranked?100:0)

---

## P1 — REDIS_URL on Railway

Verify `REDIS_URL` is set in Railway env vars. If not, add Railway Redis add-on.
`client.redis.isReady` guards are in place — the bot won't crash, but pack sessions
and cooldowns won't persist across the current backoff window.

---

## P1 — /deploy-commands after /bank and /rewards

`/bank` and `/rewards` commands were committed (`ceed1ea`) but `/deploy-commands`
has not been run since then. New slash commands won't appear in Discord until this runs.
Run: `npm run deploy:commands` (or the `/deploy-commands` slash command if registered).

---

## Carry-Forward Bugs

| ID | Description | Priority |
|----|-------------|----------|
| GRIMBOT-OFFLINE | @mention AI returns "terminal offline" — GROQ_API_KEY or model issue | 🔴 P0 |
| AUCTION-EXISTS | /auction command never removed | 🔴 P0 |
| PROFESSOR-EXISTS | /professor ask never removed | 🔴 P0 |
| PACK-IMAGES-NULL | Some cards have no image in pack reveal embeds | 🔴 P0 |
| DB-FK-GUILDUSER | XP upsert fails FK constraint for new users | 🟡 P1 |
| REDIS-URL-RAILWAY | REDIS_URL may not be set in Railway | 🟡 P1 |
| BATTLE-STATUS-DOT | applyStatusDamage() never called | 🔴 P0 |
| BATTLE-ACCURACY | checkAccuracy() never called | 🟡 P1 |
| BATTLE-SPEED-ROUND | Speed only determines first turn, not each round | 🟡 P1 |
| BATTLE-CRIT-LOG | Crit computed but no log line | 🟢 P2 |
| QUEST-SILENT | No DM on quest completion | 🟡 P1 |

---

## S14 Completed Deliverables

| Feature | Status | Commit |
|---------|--------|--------|
| Repository audit (S11/S12 uncommitted work) | ✅ | Multiple |
| Groq diagnostic logging + missing-key guard | ✅ | 674d971 |
| Economy consolidation (13 files removed, /bank + /rewards) | ✅ | ceed1ea |
| Pack Economy V2 (5-tier pricing) | ✅ | 775320b |
| Pack Opening V3 (rich card embeds, market value) | ✅ | 775320b |
| Battle V2 Lite helpers (not yet wired) | ✅ | 3333cb8 |
| Pack open interaction timeout fix (deferUpdate) | ✅ | a9d76e0 |
| Pack tier + cost shown in autocomplete | ✅ | a9d76e0 |
| S14 session docs | ✅ | pending |
| @grimbot root cause identified (model decommissioned → fixed in code, not verified live) | ⚠️ | 674d971 |

---

## Arch Reminders

- `addXp(prisma, userId, N)` — never raw `trainerXp: { increment: N }`
- `transferBalance` throws `'INSUFFICIENT_FUNDS'` — always catch
- `calcDamage()` in `battleService.ts` is the ONLY damage source — never inline
- `PokemonMove` rows may not exist — always fall back to `MOVE_TABLE`
- Button customId prefix must be in `interactionCreate.ts` or silently fails
- After schema: `npx prisma generate` → `npm run build` → `npm run db:push`
- Pack itemId format: `pack:${setId}` — never use set name
- `client.redis.isReady` check before every Redis call
- Discord slash command `.setDescription()` max 100 chars — exceeding = Railway crash
