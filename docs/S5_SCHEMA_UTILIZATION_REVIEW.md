# S5 Schema Utilization Review
Date: 2026-06-14 | Session: S5

---

## Purpose

Map every schema model and field to its utilization status. Identify ready-to-use systems that haven't been exposed as commands yet.

---

## Model Utilization

### User ✅ Fully Used

| Field | Used By | Notes |
|-------|---------|-------|
| id, username, avatarUrl | All commands | Auto-synced on interaction |
| trainerLevel, trainerXp | /profile, addXp(), getTrainerTitle() | ✅ Fully wired S4+S5 |
| trainerTitle | /profile display | Set by getTrainerTitle() |
| balance, bankBalance | All economy commands | ✅ |
| totalEarned, totalSpent | Tracking | ✅ |
| dailyStreak, weeklyStreak, monthlyStreak | /daily /weekly /monthly | ✅ |
| lastDaily/Weekly/Monthly/Work/Fish/Hunt/Beg/Rob | Cooldown gates | ✅ |
| battlesWon, battlesLost, rankedPoints, rankedTier | /profile, /battle, /leaderboard | ✅ |
| pokemonCaught, shinyCaught, legendariesCaught | /profile | ✅ |
| cardsCollected | /profile | ✅ |
| isBanned, banReason | /ban command | ✅ |

---

### Guild ✅ Mostly Used

| Field | Used By | Notes |
|-------|---------|-------|
| Channel IDs (all) | Event routing | Most optional; used when configured |
| welcomeEnabled, welcomeMessage | guildMemberAdd event | ✅ |
| modEnabled, antiSpam, antiRaid, scam | moderationService | ✅ |
| dailyReward, weeklyReward, workCooldown | /daily /weekly /work | ✅ |
| spawnEnabled, spawnCooldown, rates | spawnService | ✅ |
| battleEnabled, battleTimeout, rankedEnabled | battleService | ✅ |
| currentEvent, eventStartedAt, eventEndsAt | eventJob | ✅ |
| monthlyReward | /monthly | ✅ |
| robEnabled, robSuccessRate, robCooldown | /rob | ✅ |

**Unused:**
- `pokecoinsChannelId` — no channel-specific economy routing
- `gymChallengesChannelId`, `eliteFourChannelId` — gym system not built

---

### UserPokemon ⚡ Partially Used

| Field | Used By | Notes |
|-------|---------|-------|
| id, userId, pokemonId | All pokemon commands | ✅ |
| level, xp | /box, battles | Level stored; xp gained in battles but not levelup |
| isShiny, isFavorite | /box, /profile | ✅ |
| isInTeam, teamSlot | /team | ✅ |
| IVs (all 6) | Stored on catch | **Not displayed** — S6 add to /box |
| EVs (all 6) | Stored as 0 | **Never modified** — S6 via careers |
| nature | Stored | Not applied to battle stats |
| moves | Stored | Used in battles |
| heldItem | Stored as null | Item effects not implemented |
| caughtIn | Set to "Poke Ball" | Not shown anywhere |
| nickname | Stored as null | **No /nickname command** — S6 |

**Ready for quick wins**: IV display in /box, nickname command

---

### Card ⚡ Partially Used

| Field | Used By | Notes |
|-------|---------|-------|
| id, name, supertype | /card, /pack, /collection | ✅ |
| rarity, setName, imageSmall/Large | /card display | ✅ |
| pullRate | pack opening logic | ✅ |
| marketValue | **Stored S4** via pack.ts | **Not shown in /collection** — S6 |

**Quick win**: `/collection value` — sum marketValue * quantity for user

---

### Achievement ⚡ Partially Used

| Field | Used By | Notes |
|-------|---------|-------|
| id, name, description, category, icon | /achievements display | ✅ |
| xpReward, coinReward | Schema — **not awarded** | Achievement unlock logic not implemented |
| rarity | Display only | ✅ |
| condition (JSON) | **Not evaluated** | No trigger system |

**Gap**: Achievements are seeded and displayed but never unlocked automatically. Achievement triggers need to be added to key actions (catch, battle win, trade, etc.)

---

### Quest ⚡ Partially Used

| Field | Used By | Notes |
|-------|---------|-------|
| id, name, description, type | /quests display | ✅ |
| xpReward, coinReward | Schema — **not awarded** | Quest completion not implemented |
| requirement (JSON) | **Not evaluated** | No progress tracking |

**Gap**: Quests are displayed but progress is never incremented. Need to wire quest progress hooks into daily/catch/battle/trade actions.

---

### MarketListing ✅ Fully Used

All fields in use via /market and /auction commands. Settlement job added S5 closes the last gap.

---

### UserJob ✅ Fully Used

All 6 career commands read and write UserJob. Level, timesWorked, totalEarned all tracked.

---

### AuditLog ✅ Fully Used

`logModAction()` writes to AuditLog on all 5 moderation actions (ban, unban, kick, timeout, warn).

---

### Battle ✅ Fully Used

Both challenger/opponent, winnerId, turns, rankedPointsChange, battleLog all written by battleService.

---

### Trade ✅ Fully Used

initiatorId, receiverId, status, completedAt written on trade completion.

---

### Spawn ✅ Fully Used

spawnedAt, isCaught, caughtById, caughtAt all written by spawnService.

---

## Systems Fully Modeled but Unused

| System | Tables | Effort to Activate | Priority |
|--------|--------|--------------------|---------|
| Achievement unlock logic | Achievement, UserAchievement | Medium — need trigger hooks | P2 |
| Quest progress tracking | Quest, UserQuest | Medium — need increment hooks | P2 |
| IV display | UserPokemon.iv* | Low — add to /box | P1 |
| EV training | UserPokemon.ev* | Medium — wire to careers | P3 |
| Pokémon nickname | UserPokemon.nickname | Low — new command | P1 |
| Pokémon release | UserPokemon delete | Low — new command | P1 |
| Card collection value | Card.marketValue + UserCard | Low — aggregation query | P1 |
| Held item effects | UserPokemon.heldItem | Medium — passive hooks | P2 |
| Item inventory | No table yet | Medium — new table + buy hook | P2 |
| Evolution | Pokemon.evolvesFromId | Medium — data + command | P2 |

---

## Summary

The schema is very well designed — multiple high-value systems are fully modeled and waiting for command-layer activation. The biggest bang-for-buck items are:
1. Achievement unlock hooks (schema exists, just needs triggers)
2. Quest progress tracking (same)
3. IV display in /box (pure read, one field addition)
4. /release and /nickname (trivial new commands)
5. /collection value (one aggregation query)
