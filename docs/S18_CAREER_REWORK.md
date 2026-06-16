# Season 18 — Career System Rework Report
> Date: 2026-06-16

---

## 1. Career Architecture

### New Command Structure
| Command | Purpose |
|---------|---------|
| `/work <career>` | Start interactive career shift with scenario-based gameplay |
| `/career shop <career>` | Buy career-specific equipment upgrades |
| `/career view` | View career overview, levels, earnings, progress |
| `/career leaderboard` | Top 10 trainers by career earnings |

### Active Careers (5)
| Career | Emoji | Base Equipment | Required Item ID | Scenarios |
|--------|-------|---------------|------------------|-----------|
| Miner | ⛏️ | Pickaxe | `pickaxe` | 3 |
| Researcher | 🔬 | Research Kit | `research_kit` | 3 |
| Ranger | 🌲 | Tracking Kit | `tracking_kit` | 3 |
| Fisher | 🎣 | Fishing Rod | `old_rod` | 3 |
| Rocket | 🚀 | Rocket Gear | `gadget_kit` | 3 |

### Scenario System
- **15 total scenarios** (3 per career)
- **2–3 button choices per scenario** (45+ unique choices)
- **4 risk levels:** Safe (green), Moderate (blue), Risky (grey), Dangerous (red)
- **Equipment tier affects:** Success rate (+5%/+10%/+15%) and coin rewards (×1.0/×1.25/×1.5/×2.0)
- **Career level affects:** Success rate (+0.5%/level, max +10%) and coin rewards (×1.0 + level × 0.05)
- **Item drops:** 6 unique item drops across careers (Thunder Stone, Moon Stone, Old Amber, Poke Ball, Ultra Ball)

---

## 2. Files Modified
| File | Change |
|------|--------|
| `src/commands/economy/career.ts` | Removed `work` subcommand, removed Breeder, imported scenario engine, updated view/shop/leaderboard |
| `src/commands/utility/help.ts` | Updated economy command list: replaced `/fish /mine /ranger /researcher /rocket` with `/work` |
| `src/services/groqService.ts` | Updated Professor Oak career knowledge |
| `src/commands/economy/inventory.ts` | Updated item descriptions for career equipment |
| `src/services/PricingService.ts` | Updated incubator description |

---

## 3. Files Created
| File | Purpose |
|------|---------|
| `src/services/career/scenarios.ts` | Career scenario engine — types, definitions, outcome resolver, equipment tier checker |
| `src/commands/economy/work.ts` | New `/work` slash command with interactive button-based scenario system |

---

## 4. Legacy Code Removed
| File | Description |
|------|-------------|
| `src/commands/economy/fish.ts` | Standalone `/fish` command (103 lines) — duplicate of Fisher career |
| `src/commands/economy/mine.ts` | Standalone `/mine` command (90 lines) — duplicate of Miner career |
| `src/commands/economy/ranger.ts` | Standalone `/ranger` command (67 lines) — duplicate of Ranger career |
| `src/commands/economy/researcher.ts` | Standalone `/researcher` command (67 lines) — duplicate of Researcher career |
| `src/commands/economy/rocket.ts` | Standalone `/rocket` command (67 lines) — duplicate of Rocket career |

**Total removed:** 394 lines of duplicated legacy code

---

## 5. Equipment Requirements
| Career | Base (Tier 1) | Tier 2 | Tier 3 | Tier 4 |
|--------|---------------|--------|--------|--------|
| Fisher | Old Rod (`old_rod`) | Good Rod (`good_rod`) — 2,000💰 | Super Rod (`super_rod`) — 8,000💰 | Master Rod (`master_rod`) — 25,000💰 |
| Miner | Pickaxe (`pickaxe`) | Iron Pickaxe (`iron_pickaxe`) — 2,000💰 | Steel Pickaxe (`steel_pickaxe`) — 8,000💰 | Diamond Drill (`diamond_drill`) — 25,000💰 |
| Researcher | Research Kit (`research_kit`) | Data Analyzer (`data_analyzer`) — 8,000💰 | Pokédex Pro (`pokedex_pro`) — 25,000💰 | — |
| Ranger | Tracking Kit (`tracking_kit`) | Field Scanner (`field_scanner`) — 6,000💰 | Ranger Gear (`ranger_gear`) — 20,000💰 | — |
| Rocket | Rocket Gear (`gadget_kit`) | Hacking Tools (`hacking_tools`) — 15,000💰 | Master Plan (`master_plan`) — 40,000💰 | — |

**Equipment is required** — players without base equipment see a purchase prompt.

---

## 6. Scenario Count Per Career
| Career | Scenarios | Total Choices |
|--------|-----------|---------------|
| Miner | 3 | 9 |
| Researcher | 3 | 9 |
| Ranger | 3 | 9 |
| Fisher | 3 | 9 |
| Rocket | 3 | 9 |
| **Total** | **15** | **45** |

---

## 7. Audit Status

> Full audit: `docs/S18_CAREER_AUDIT.md` (2026-06-16)

**Classification: ⚠️ Needs Improvements** — Functionally complete, 3 bugs found.

### 🔴 Bugs (Fix Before Production)

| # | Issue | Severity |
|---|-------|----------|
| 1 | **`master_rod` missing from `/shop` and PricingService** — Fisher tier 4 only purchasable via `/career shop fisher` | High |
| 2 | **Price discrepancy between `/shop` and `/career shop`** — Good Rod: 500💰 vs 2,000💰; Super Rod: 1,500💰 vs 8,000💰 | High |
| 3 | **`drill` item is orphaned** — In `shop.ts` but not used by any career | Low |

### 🟡 Remaining Technical Debt
- **Breeder items in shop** — `incubator`, `improved_incubator`, `advanced_incubator`, `perfect_incubator` still exist in `shop.ts` and `PricingService.ts` but have no active career. Can be removed in future session.
- **CooldownService class** — Still exists alongside `utils/cooldown.ts` functions. Both do the same thing (Redis cooldown). Consider consolidating.
- **guildService.ts** — Still has `{ name: 'Breeder', color: 0x2ecc71 }` in a color map. Cosmetic only.
- **Emoji typo** — ` artifact` (leading space) in Abandoned Mine scenario, `scenarios.ts:219`.
- **No database migration needed** — All existing `UserJob` records remain valid (career names unchanged).

---

## 8. Recommended Next Improvements
1. **Remove Breeder shop items** from `shop.ts` and `PricingService.ts`
2. **Consolidate cooldown systems** — deprecate `CooldownService` in favor of `utils/cooldown.ts`
3. **Add career-specific achievements** (e.g., "Complete 100 Miner shifts")
4. **Add seasonal career events** (double rewards during weekends)
5. **Career mastery system** — special titles at level 50+ (e.g., "Master Miner", "Legendary Fisher")