# Season 18 Career Rework — Post-Implementation Audit

> Date: 2026-06-16
> Auditor: AI Assistant (Cline)
> Scope: Full verification of S18 Career Rework claims

---

## 1. Command Structure Verification

### Commands Confirmed Active

| Command | Status | Evidence |
|---------|--------|----------|
| `/work <career>` | ✅ CONFIRMED | `src/commands/economy/work.ts` — SlashCommandBuilder with `setName('work')`, required `career` string option |
| `/career shop <career>` | ✅ CONFIRMED | `src/commands/economy/career.ts` — Subcommand with career string option |
| `/career view` | ✅ CONFIRMED | `src/commands/economy/career.ts` — Subcommand with optional user option |
| `/career leaderboard` | ✅ CONFIRMED | `src/commands/economy/career.ts` — Subcommand with optional career filter |

### Career Choices Available

| Career | Emoji | Choice Value | Status |
|--------|-------|-------------|--------|
| Miner | ⛏️ | `Miner` | ✅ |
| Researcher | 🔬 | `Researcher` | ✅ |
| Ranger | 🌲 | `Ranger` | ✅ |
| Fisher | 🎣 | `Fisher` | ✅ |
| Rocket | 🚀 | `Rocket` | ✅ |

### Legacy Dropdown Work System — REMOVED

| File | Status | Evidence |
|------|--------|----------|
| `src/commands/economy/fish.ts` | ✅ DELETED | Not in directory listing |
| `src/commands/economy/mine.ts` | ✅ DELETED | Not in directory listing |
| `src/commands/economy/ranger.ts` | ✅ DELETED | Not in directory listing |
| `src/commands/economy/researcher.ts` | ✅ DELETED | Not in directory listing |
| `src/commands/economy/rocket.ts` | ✅ DELETED | Not in directory listing |

**Current economy commands:** `balance.ts`, `bank.ts`, `beg.ts`, `buy.ts`, `career.ts`, `hunt.ts`, `inventory.ts`, `pay.ts`, `rewards.ts`, `rob.ts`, `shop.ts`, `work.ts`

### help.ts Updated

- Economy category shows: `/balance /daily /weekly /beg /work /rob /shop /inventory /pay /bank /rewards /career` — ✅
- No references to old `/fish /mine /ranger /researcher /rocket` — ✅

### Command Registration

`deploy-commands.ts` auto-discovers all `.ts` files in `src/commands/` recursively. The new `work.ts` and updated `career.ts` will be automatically registered.

---

## 2. Equipment Progression Verification

### Equipment Tier System

**Source:** `src/services/career/scenarios.ts` — `TIER_SUCCESS_BONUS` and `TIER_REWARD_MULT` arrays

```
TIER_SUCCESS_BONUS = [0, 0, 0.05, 0.10, 0.15]  // Index = tier
TIER_REWARD_MULT   = [1.0, 1.0, 1.25, 1.5, 2.0] // Index = tier
```

**Career level bonus:** `+0.5%/level` success rate, max +10% (capped at 20 levels). Coin multiplier: `1.0 + (level - 1) × 0.05`.

### Per-Career Equipment

#### Miner ⛏️
| Tier | Item ID | Name | Cost | Success Bonus | Reward Mult |
|------|---------|------|------|---------------|-------------|
| 1 | `pickaxe` | Pickaxe | Base (required) | 0% | ×1.0 |
| 2 | `iron_pickaxe` | Iron Pickaxe | 2,000💰 | +5% | ×1.25 |
| 3 | `steel_pickaxe` | Steel Pickaxe | 8,000💰 | +10% | ×1.5 |
| 4 | `diamond_drill` | Diamond Drill | 25,000💰 | +15% | ×2.0 |

#### Researcher 🔬
| Tier | Item ID | Name | Cost | Success Bonus | Reward Mult |
|------|---------|------|------|---------------|-------------|
| 1 | `research_kit` | Research Kit | Base (required) | 0% | ×1.0 |
| 2 | `data_analyzer` | Data Analyzer | 8,000💰 | +5% | ×1.25 |
| 3 | `pokedex_pro` | Pokédex Pro | 25,000💰 | +10% | ×1.5 |

#### Ranger 🌲
| Tier | Item ID | Name | Cost | Success Bonus | Reward Mult |
|------|---------|------|------|---------------|-------------|
| 1 | `tracking_kit` | Tracking Kit | Base (required) | 0% | ×1.0 |
| 2 | `field_scanner` | Field Scanner | 6,000💰 | +5% | ×1.25 |
| 3 | `ranger_gear` | Ranger Gear | 20,000💰 | +10% | ×1.5 |

#### Fisher 🎣
| Tier | Item ID | Name | Cost | Success Bonus | Reward Mult |
|------|---------|------|------|---------------|-------------|
| 1 | `old_rod` | Old Rod | Base (required) | 0% | ×1.0 |
| 2 | `good_rod` | Good Rod | 2,000💰 | +5% | ×1.25 |
| 3 | `super_rod` | Super Rod | 8,000💰 | +10% | ×1.5 |
| 4 | `master_rod` | Master Rod | 25,000💰 | +15% | ×2.0 |

#### Rocket 🚀
| Tier | Item ID | Name | Cost | Success Bonus | Reward Mult |
|------|---------|------|------|---------------|-------------|
| 1 | `gadget_kit` | Rocket Gear | Base (required) | 0% | ×1.0 |
| 2 | `hacking_tools` | Hacking Tools | 15,000💰 | +5% | ×1.25 |
| 3 | `master_plan` | Master Plan | 40,000💰 | +10% | ×1.5 |

### Equipment Progression Assessment

✅ **Higher tier equipment matters.** The progression is meaningful:
- Tier 4 gives +15% success rate and ×2.0 coin multiplier (doubles earnings)
- Combined with career level (max +10% success, ×1.95 coin mult at level 20), a maxed-out player has +25% success and ×3.9 coin multiplier vs a fresh player
- This creates strong incentive to invest in equipment upgrades

### ⚠ BUGS FOUND

1. **`master_rod` missing from `/shop` and PricingService** — The Fisher tier 4 item exists in `career.ts` CAREER_SHOPS and `scenarios.ts` but is NOT in `shop.ts` Career Tools category or `PricingService.ts`. Players can only buy it via `/career shop fisher`.

2. **Price discrepancy between `/shop` and `/career shop`** — The same items have different prices:
   | Item | `/shop` Price (PricingService) | `/career shop` Price |
   |------|-------------------------------|---------------------|
   | Good Rod | 500💰 | 2,000💰 |
   | Super Rod | 1,500💰 | 8,000💰 |
   Players can exploit by buying from `/shop` at 75% discount.

3. **`drill` item is orphaned** — `drill` exists in `shop.ts` (1,000💰) and `PricingService.ts` but is NOT referenced by any career system. Stale item from a previous iteration.

---

## 3. Scenario Quality Verification

### All 15 Scenarios — Detailed Breakdown

#### Miner ⛏️ (3 scenarios, 9 choices)

**Scenario 1: Crystal Cave** (`crystal_cave`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 🕳️ Explore the deep tunnel | Risky (grey) | 50% | 800–2,000 | 60/15 | 200 | — |
| ⛏️ Mine the rich ore vein | Moderate (blue) | 70% | 400–1,000 | 40/10 | 100 | — |
| 🪨 Collect surface minerals | Safe (green) | 95% | 150–350 | 20/5 | 0 | — |

**Scenario 2: Abandoned Mine** (`abandoned_mine`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 🔮 Investigate the strange artifact | Risky (grey) | 45% | 1,000–3,000 | 70/15 | 300 | Thunder Stone (8%) |
| 🔧 Salvage old equipment | Safe (green) | 90% | 200–500 | 20/5 | 0 | — |
| ⬇️ Descend into the deep shaft | Dangerous (red) | 35% | 2,000–5,000 | 100/20 | 500 | Moon Stone (5%) |

**Scenario 3: Fossil Dig Site** (`fossil_dig`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 🦴 Excavate carefully | Moderate (blue) | 75% | 300–800 | 35/10 | 50 | Old Amber (10%) |
| 🚜 Use heavy machinery | Risky (grey) | 55% | 600–1,500 | 50/12 | 200 | — |
| 🔍 Search for rare specimens | Dangerous (red) | 40% | 1,200–3,500 | 80/18 | 400 | — |

#### Researcher 🔬 (3 scenarios, 9 choices)

**Scenario 1: Ancient Fossil** (`ancient_fossil`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 📊 Run extensive analysis | Safe (green) | 90% | 250–600 | 25/8 | 0 | — |
| 📄 Publish preliminary findings | Moderate (blue) | 70% | 500–1,200 | 40/12 | 100 | — |
| 🧬 Attempt gene sequencing | Risky (grey) | 45% | 1,000–3,000 | 70/15 | 300 | — |

**Scenario 2: Lab Discovery** (`lab_discovery`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 📝 Write a detailed report | Safe (green) | 95% | 200–450 | 20/5 | 0 | — |
| 🧪 Replicate the experiment | Moderate (blue) | 65% | 500–1,400 | 45/12 | 150 | — |
| 💰 Seek corporate funding | Risky (grey) | 50% | 800–2,500 | 55/12 | 200 | — |

**Scenario 3: Mysterious Signal** (`mysterious_signal`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 💻 Analyze the data carefully | Safe (green) | 85% | 300–700 | 30/8 | 0 | — |
| 📖 Cross-reference with Pokédex | Moderate (blue) | 70% | 400–1,000 | 35/10 | 50 | — |
| 📻 Broadcast a response | Dangerous (red) | 30% | 1,500–4,000 | 90/20 | 500 | — |

#### Ranger 🌲 (3 scenarios, 9 choices)

**Scenario 1: Rare Pokémon Tracks** (`rare_tracks`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 🚶 Follow the tracks cautiously | Safe (green) | 90% | 200–500 | 25/8 | 0 | — |
| 📷 Set up a hidden camera trap | Moderate (blue) | 70% | 400–1,000 | 40/10 | 100 | — |
| ⛰️ Track through dangerous terrain | Risky (grey) | 50% | 700–1,800 | 55/12 | 200 | — |

**Scenario 2: Lost Trainer** (`lost_trainer`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 🆘 Guide them to safety | Safe (green) | 95% | 250–500 | 20/5 | 0 | — |
| 🔍 Search the surrounding area | Moderate (blue) | 65% | 400–1,200 | 45/12 | 100 | — |
| 🌧️ Rush into the storm | Dangerous (red) | 35% | 1,000–3,000 | 80/18 | 400 | — |

**Scenario 3: Wild Encounter** (`wild_encounter`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 🔭 Observe from a distance | Safe (green) | 90% | 150–400 | 20/5 | 0 | — |
| 🤝 Attempt to calm the Pokémon | Moderate (blue) | 60% | 500–1,300 | 50/12 | 150 | — |
| ⚔️ Engage directly | Risky (grey) | 45% | 800–2,000 | 60/15 | 300 | Poke Ball (10%) |

#### Fisher 🎣 (3 scenarios, 9 choices)

**Scenario 1: Deep Sea Fishing** (`deep_sea`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 🎣 Cast in calm waters | Safe (green) | 90% | 150–400 | 20/5 | 0 | — |
| ⛵ Troll the deep channel | Moderate (blue) | 65% | 400–1,200 | 45/10 | 100 | — |
| 🐉 Chase the legendary shadow | Risky (grey) | 40% | 1,000–3,000 | 70/15 | 250 | — |

**Scenario 2: Storm Catch** (`storm_catch`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| ⏳ Wait for the storm to pass | Safe (green) | 95% | 100–300 | 15/5 | 0 | — |
| 🌊 Fish in the rough waters | Moderate (blue) | 60% | 500–1,400 | 50/12 | 150 | — |
| 🌀 Dive into the whirlpool | Dangerous (red) | 30% | 1,500–4,000 | 90/20 | 500 | — |

**Scenario 3: Night Fishing** (`night_fishing`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 🌕 Fish by moonlight | Safe (green) | 85% | 200–500 | 25/8 | 0 | — |
| ✨ Use bioluminescent bait | Moderate (blue) | 65% | 450–1,100 | 40/10 | 100 | Poke Ball (8%) |
| 🚢 Explore the sunken ship | Risky (grey) | 45% | 800–2,200 | 60/12 | 250 | — |

#### Rocket 🚀 (3 scenarios, 9 choices)

**Scenario 1: PokéStop Raid** (`pokestop_raid`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 💰 Snatch the easy loot | Safe (green) | 90% | 200–500 | 20/5 | 0 | — |
| 🚛 Ambush the delivery truck | Moderate (blue) | 65% | 500–1,500 | 45/12 | 200 | — |
| 🏦 Rob the Silph Vault | Dangerous (red) | 30% | 2,000–5,000 | 100/20 | 600 | — |

**Scenario 2: Cargo Theft** (`cargo_theft`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 🎒 Intercept a small shipment | Safe (green) | 85% | 250–600 | 25/8 | 0 | — |
| 🚂 Hijack the cargo train | Moderate (blue) | 55% | 600–1,800 | 50/12 | 250 | — |
| 🌟 Steal from Team Galactic | Risky (grey) | 40% | 1,000–3,500 | 75/15 | 500 | Ultra Ball (5%) |

**Scenario 3: Secret Mission** (`secret_mission`)
| Choice | Risk | Success Rate | Reward Range | XP | Fail Penalty | Item Drop |
|--------|------|-------------|--------------|-----|-------------|-----------|
| 📋 Gather intel quietly | Safe (green) | 90% | 200–500 | 20/5 | 0 | — |
| 💻 Hack the security system | Moderate (blue) | 60% | 600–1,600 | 50/12 | 200 | — |
| 🗡️ Double-cross the boss | Dangerous (red) | 25% | 2,500–6,000 | 100/20 | 800 | — |

### Scenario Quality Assessment

✅ **All 15 scenarios are genuinely unique.** Each has:
- Distinct narrative theme fitting its career
- Unique choice sets (no copy-pasted choices between scenarios)
- Appropriate risk/reward scaling across all 4 risk levels
- Thematic success/failure messages
- Item drops on 6 specific choices across the system

### ⚠ MINOR ISSUE
- **Emoji typo:** Scenario "Abandoned Mine" choice "Investigate the strange artifact" has emoji ` artifact` (with leading space, line 219 of `scenarios.ts`). Should be a proper emoji like `🔮`.

---

## 4. Button Handling Verification

### Work Command Buttons

| Check | Status | Evidence |
|-------|--------|----------|
| Buttons acknowledge interaction correctly | ✅ | `btn.update({ embeds: [resultEmbed], components: disabledButtons })` in collector `collect` handler |
| Custom ID includes userId for filtering | ✅ | `work:${userId}:${careerName}:${scenarioId}:${choiceIndex}` |
| User filter on collector | ✅ | `filter: (btn) => btn.user.id === interaction.user.id` |
| Timeout handling | ✅ | `collector.on('end')` disables buttons after 30s |
| Error handling | ✅ | Wrapped in try/catch with `editReply` fallback |

### Career Shop Buttons

| Check | Status | Evidence |
|-------|--------|----------|
| Buttons acknowledge correctly | ✅ | `btn.update()` on success, `btn.reply()` on errors |
| Balance check before purchase | ✅ | Fresh DB read before each purchase |
| Transaction safety | ✅ | `prisma.$transaction()` for balance decrement + inventory create |
| Collector timeout | ✅ | 30s with button disable on end |

### ⚠ PERSISTENCE CONCERN

**Storage method:** In-memory collectors with 30-second timeout.

- **After Railway restart:** Any active scenario buttons become non-functional (collector dies). This is acceptable because:
  - 30s timeout is short — very unlikely a restart happens mid-interaction
  - Users simply run `/work` again
  - No data is lost (no DB writes happen until a button is clicked)

- **After bot restart:** Same as Railway restart. Collectors are in-memory only.

- **Works on normal operation:** ✅ Yes, 30s is more than enough for users to make a choice.

This is a reasonable design for short-lived interactive scenarios. The spawn/catch system uses a different pattern (Redis + DB persistence) because spawns last 5 minutes, but career scenarios only need 30 seconds.

---

## 5. Cooldown Verification

### Global Cooldown Key

| Check | Status | Evidence |
|-------|--------|----------|
| Cooldown key is `career:work` | ✅ | `work.ts` line 38: `checkCooldown(client, ..., 'career:work', 3600)` |
| Set after completing a shift | ✅ | `work.ts` line 155: `setCooldown(client, ..., 'career:work', 3600)` |
| Duration is 3600s (1 hour) | ✅ | Both check and set use 3600 |
| All careers share cooldown | ✅ | Single `career:work` key for all 5 careers |
| `CAREERS_META` references same key | ✅ | `scenarios.ts` line 1041: `cooldownKey: 'career:work'` |
| Displayed in career view | ✅ | `career.ts` reads Redis TTL for `cooldown:{userId}:career:work` |

---

## 6. Catch System Verification

> Note: The catch system is NOT part of the S18 Career Rework. It's a pre-existing system verified here for completeness.

### Spawn → Catch Flow

| Step | Status | Evidence |
|------|--------|----------|
| **Spawn** | ✅ | `spawnService.ts` — random 5% chance per message, respects guild cooldown |
| **Catch button** | ✅ | Spawn message includes "Catch!" button with custom ID `catch:{pokemonId}:{isShiny}` |
| **Atomic claim** | ✅ | `GETDEL` on Redis spawn key prevents race conditions |
| **Inventory update** | ✅ | `userPokemon.create` with full stat generation (level, nature, IVs, moves) |
| **Pokédex update** | ✅ | `pokemonCaught` incremented on User record |
| **Milestone rewards** | ✅ | Coin rewards at 10/25/50/100/250/500 catches |
| **FK guard** | ✅ | `ensureUser()` called before `userPokemon.create` (fixed in S15) |
| **Shiny Charm** | ✅ | Bonus shiny roll if user owns `shiny_charm` item |
| **Error handling** | ✅ | Try/catch around entire flow with `editReply` fallback |
| **Interaction timeout prevention** | ✅ | `interaction.deferReply({ ephemeral: true })` immediately |

### "Interaction Failed" Error Assessment

The catch system uses `deferReply()` before any async work, which prevents Discord's 3-second interaction timeout. The only remaining risk is if `editReply()` itself fails (e.g., bot loses permissions), which is handled by the error catch block.

**No "Interaction Failed" error paths identified.**

---

## 7. Runtime Health

### TypeScript Compilation

```
npx tsc --noEmit → NO ERRORS
```

### Import Resolution

All imports verified:
- `work.ts` → imports from `scenarios.ts`, `cooldown.ts`, `userService.ts`, `embeds.ts` ✅
- `career.ts` → imports from `scenarios.ts`, `embeds.ts` ✅
- `scenarios.ts` → imports only `discord.js` (ButtonStyle) ✅

### Command Registration

`deploy-commands.ts` auto-discovers all `.ts/.js` files in `src/commands/`. Both `work.ts` and `career.ts` will be picked up automatically.

### Unable to Test Live

Live command testing requires a running bot connected to Discord. The Railway instance status is unclear from the NEXT_SESSION_TASKS.md (previously EXITED). TypeScript compilation confirms the code is syntactically and type-safe.

---

## 8. Final Classification

### ⚠️ Needs Improvements

The S18 Career Rework is **functionally complete and well-architected**, but has the following issues that should be addressed:

### 🔴 Bugs (Fix Before Production)

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | **`master_rod` missing from `/shop` and PricingService** — Fisher tier 4 item only purchasable via `/career shop fisher` | High | `shop.ts`, `PricingService.ts` |
| 2 | **Price discrepancy between `/shop` and `/career shop`** — Same items (Good Rod, Super Rod) sold at different prices in the two shops. Players can buy Good Rod for 500💰 in `/shop` vs 2,000💰 in `/career shop` | High | `shop.ts` vs `career.ts` |
| 3 | **`drill` item is orphaned** — Exists in `shop.ts` (1,000💰) and `PricingService.ts` but not referenced by any career | Low | `shop.ts`, `PricingService.ts` |

### 🟡 Technical Debt (Fix in Future Session)

| # | Issue | Location |
|---|-------|----------|
| 4 | Breeder items (`incubator`, `improved_incubator`, `advanced_incubator`, `perfect_incubator`) still in `shop.ts` and `PricingService.ts` | `shop.ts`, `PricingService.ts` |
| 5 | `guildService.ts` still has `{ name: 'Breeder', color: 0x2ecc71 }` in color map | `guildService.ts` |
| 6 | Emoji typo: ` artifact` (leading space) in Abandoned Mine scenario | `scenarios.ts:219` |
| 7 | `CooldownService` class exists alongside `utils/cooldown.ts` — redundant | `CooldownService.ts` |

### ✅ What Works Well

- Clean separation: `scenarios.ts` (engine) ↔ `work.ts` (UI) ↔ `career.ts` (management)
- Equipment progression is meaningful and creates genuine upgrade incentive
- All 15 scenarios are unique with appropriate risk/reward curves
- Button interactions are well-handled with proper acknowledgement
- Global `career:work` cooldown prevents abuse across all careers
- TypeScript compiles cleanly with zero errors
- Legacy code fully removed (394 lines deleted)
- Help system updated to reflect new commands
- Transaction safety in career shop purchases (`prisma.$transaction`)
- Atomic spawn claiming in catch system (GETDEL)

---

## 9. Recommended Fix Priority

1. **Align prices** — Either remove career tools from `/shop` (keep them exclusive to `/career shop`) or update PricingService prices to match CAREER_SHOPS prices
2. **Add `master_rod` to PricingService and shop.ts** — Or remove it from shop.ts if `/career shop` is the intended purchase path
3. **Remove orphaned `drill` item** from shop.ts and PricingService.ts
4. **Remove Breeder items** from shop.ts and PricingService.ts (documented debt)
5. **Fix emoji typo** in scenarios.ts