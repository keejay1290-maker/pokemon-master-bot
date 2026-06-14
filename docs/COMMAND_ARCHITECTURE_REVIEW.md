# Command Architecture Review — S9

> Written: S9 | Status: ANALYSIS COMPLETE

---

## Current Command Count: 61 (S8 end) → 62 (S9 adds: no new top-level commands)

S9 restructured existing commands (pack → subcommands, auction added cancel) without adding net new top-level commands.

---

## Full Command Inventory (Post-S9)

### Admin
| Command | Subcommands | Status |
|---------|-------------|--------|
| `/config` | — | ✅ |
| `/giftpack` | — | ✅ Modified S9 |

### Battles
| Command | Subcommands | Status |
|---------|-------------|--------|
| `/battle` | — | ✅ |

### Cards / TCG
| Command | Subcommands | Status |
|---------|-------------|--------|
| `/card` | — | ✅ |
| `/collection` | — | ✅ |
| `/pack` | buy, open, inventory | ✅ Restructured S9 |

### Economy
| Command | Subcommands | Status |
|---------|-------------|--------|
| `/auction` | create, bid, view, browse, cancel | ✅ Restructured S9 |
| `/balance` | — | ✅ |
| `/beg` | — | ✅ Enhanced S9 |
| `/breeder` | — | ⚠️ Standalone — target for Career V2 |
| `/buy` | — | ✅ |
| `/career` | — | ⚠️ Partial — Career V2 S10 |
| `/daily` | — | ✅ |
| `/deposit` | — | ✅ |
| `/fish` | — | ⚠️ Duplicate of /fisher |
| `/fisher` | — | ⚠️ Standalone — target for Career V2 |
| `/hunt` | — | ✅ Enhanced S9 (ball system) |
| `/inventory` | — | ✅ |
| `/market` | — | ✅ |
| `/miner` | — | ⚠️ Standalone — target for Career V2 |
| `/monthly` | — | ✅ |
| `/pay` | — | ✅ |
| `/ranger` | — | ⚠️ Standalone — target for Career V2 |
| `/researcher` | — | ⚠️ Standalone — target for Career V2 |
| `/rob` | — | ✅ |
| `/rocket` | — | ⚠️ Standalone — target for Career V2 |
| `/shop` | — | ✅ |
| `/weekly` | — | ✅ |
| `/withdraw` | — | ✅ |
| `/work` | — | ✅ Enhanced S9 |

### Giveaways
| Command | Subcommands | Status |
|---------|-------------|--------|
| `/giveaway` | — | ✅ |

### Moderation
| Command | Subcommands | Status |
|---------|-------------|--------|
| `/ban` | — | ✅ |
| `/kick` | — | ✅ |
| `/lock` | — | ✅ |
| `/purge` | — | ✅ |
| `/slowmode` | — | ✅ |
| `/timeout` | — | ✅ |
| `/unban` | — | ✅ |
| `/unlock` | — | ✅ |
| `/warn` | — | ✅ |
| `/warnings` | — | ✅ |

### Pokemon
| Command | Subcommands | Status |
|---------|-------------|--------|
| `/box` | — | ✅ |
| `/catch` | — | ✅ |
| `/evolve` | — | ✅ |
| `/favorite` | — | ✅ |
| `/nickname` | — | ✅ |
| `/pokedex` | — | ✅ |
| `/pokemon` | — | ✅ |
| `/release` | — | ✅ |
| `/team` | — | ✅ |
| `/trade` | — | ✅ |

### Social
| Command | Subcommands | Status |
|---------|-------------|--------|
| `/achievements` | — | ✅ |
| `/leaderboard` | — | ✅ |
| `/profile` | — | ✅ |
| `/quests` | — | ✅ |

### Utility
| Command | Subcommands | Status |
|---------|-------------|--------|
| `/help` | — | ✅ |
| `/ping` | — | ✅ |
| `/professor` | — | ✅ (also accessible via @mention) |
| `/setup` | — | ✅ |
| `/welcome` | — | ✅ |

---

## Consolidation Targets (S10)

### Career Commands → `/career work`

Remove: `/fisher`, `/ranger`, `/breeder`, `/miner`, `/researcher`, `/rocket`, `/fish`
Keep: `/career work [type]`, `/career view`, `/career leaderboard`, `/career shop`
Savings: 7 commands removed, 3 added = **net -4**

### Bank → `/bank`

Merge: `/balance`, `/deposit`, `/withdraw` → `/bank view/deposit/withdraw`
Savings: 2 commands removed = **net -2**

### Rewards → `/rewards`

Merge: `/daily`, `/weekly`, `/monthly` → `/rewards daily/weekly/monthly`
Savings: 2 commands removed = **net -2**

### Target: 62 → 54 (S10)

---

## Subcommand Conversion (Already Done S9)

| Before S9 | After S9 |
|-----------|----------|
| `/auction place` | `/auction create` (select menu) |
| `/pack` (single) | `/pack buy`, `/pack open`, `/pack inventory` |
| No `/auction cancel` | `/auction cancel` |
| No `@mention` AI | `@mention` → Professor Oak |

---

## Rules: When to Use Subcommands vs Separate Commands

**Use subcommands when:** Multiple related actions on the same noun (`/pack buy`, `/pack open`, `/pack inventory`).

**Use separate commands when:** Conceptually different activities (`/hunt` vs `/fish` — both are career work but different enough to stand alone until Career V2 consolidates them).

**Never:** Use subcommands to hide related but already-working standalone commands until there's a real consolidation plan ready.
