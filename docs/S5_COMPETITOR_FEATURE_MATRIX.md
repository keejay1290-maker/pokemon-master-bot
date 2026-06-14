# S5 Competitor Feature Matrix
Date: 2026-06-14 | Session: S5

---

## Competitors Analyzed

1. **Pokétwo** — most popular Discord Pokémon bot (50M+ servers)
2. **Pokecord** (original, now defunct) — pioneered the catching mechanic
3. **Dank Memer** — economy bot with Pokémon-adjacent systems
4. **Karuta** — TCG/collection bot
5. **PokeBot** variants — various community bots

---

## Feature Comparison Matrix

### Core Catching

| Feature | Pokétwo | Pokecord | Us | Gap |
|---------|---------|---------|----|----|
| Spawn on message activity | ✅ | ✅ | ✅ | None |
| Shiny Pokémon | ✅ | ✅ | ✅ | None |
| Legendary rarity | ✅ | ✅ | ✅ | None |
| Name the Pokémon to catch | ✅ | ✅ | ❌ | We use button — simpler but less memorable |
| Regional forms | ✅ | ❌ | ❌ | Future |
| Mythical Pokémon | ✅ | ✅ | ✅ | None |
| IV system | ✅ | ❌ | ✅ (schema) | Display not wired yet |
| EV system | ✅ | ❌ | ✅ (schema) | Not implemented |
| Natures | ✅ | ❌ | ✅ | Stored, not used in battles |

---

### Economy

| Feature | Pokétwo | Dank Memer | Us | Gap |
|---------|---------|------------|----|----|
| Daily reward | ✅ | ✅ | ✅ | None |
| Weekly reward | ✅ | ✅ | ✅ | None |
| Monthly reward | ❌ | ❌ | ✅ | We have more |
| Work command | ❌ | ✅ (8 jobs) | ✅ (8 jobs) | None |
| Rob command | ❌ | ✅ | ✅ | None |
| P2P transfer | ✅ | ✅ | ✅ | None |
| Shop with items | ✅ | ✅ | ✅ (20 items) | None |
| Market / GTL | ✅ (Global Trade) | ❌ | ✅ | None |
| Auction house | ❌ | ❌ | ✅ | We have more |
| Career system | ❌ | ❌ | ✅ (6 careers) | We have more |

---

### Pokémon Management

| Feature | Pokétwo | Us | Gap |
|---------|---------|----|----|
| Box view (paginated) | ✅ | ✅ | None |
| Favoriting | ✅ | ✅ | None |
| Nickname | ✅ | Schema ✅ | Not exposed as command |
| Release Pokémon | ✅ | ❌ | S6 — needs /release |
| Pokédex completion | ✅ | ✅ | None |
| Trade with confirmation | ✅ | ✅ | None |
| Market/GTS trade | ✅ | ✅ | None |

---

### Progression / Trainer

| Feature | Pokétwo | Us | Gap |
|---------|---------|----|----|
| Trainer level | ❌ | ✅ | We have more |
| Rank title | ❌ | ✅ (7 tiers) | We have more |
| Achievements | ❌ | ✅ (schema + display) | Unlock logic not wired |
| Quests / Daily tasks | ❌ | ✅ (schema + display) | Completion logic not wired |
| Battle pass / seasonal | ❌ | ❌ | Future (PokéPass) |
| Leaderboards | ✅ | ✅ | None |

---

### Battle System

| Feature | Pokétwo | Us | Gap |
|---------|---------|----|----|
| 1v1 Pokémon battles | ✅ (turn-based) | ✅ | None |
| Ranked battles | ✅ | ✅ (points system) | None |
| Gym system | ✅ | ❌ | S7+ |
| Elite Four | ✅ | ❌ (title only) | S7+ |
| Move system | ✅ | ✅ (stored) | Not fully used in battle |

---

### Social

| Feature | Pokétwo | Dank Memer | Us | Gap |
|---------|---------|------------|----|----|
| Trainer profile | ✅ | ✅ | ✅ | None |
| Leaderboards | ✅ | ✅ | ✅ | None |
| Giveaways | ❌ | ❌ | ✅ | We have more |
| Events system | ❌ | ✅ | ✅ (schema) | Event bonuses not implemented |

---

### TCG / Cards

| Feature | Karuta | Us | Gap |
|---------|--------|----|----|
| Card pulls | ✅ | ✅ | None |
| Market value | ✅ | ✅ (S4) | None |
| Collection view | ✅ | ✅ | None |
| Card trading | ✅ | ❌ | S6 — /trade for cards |
| Foil/holo variants | ✅ | ✅ (schema) | Not exposed |
| Set browsing | ✅ | ✅ (/card) | None |
| Collection total value | ✅ | ❌ | S6 — /collection value |

---

## Key Differentiators We Have

1. **Career system** — Fisher/Researcher/Ranger/Breeder/Miner/Rocket — no major bot has this
2. **Monthly reward** with streak — unique
3. **Auction house** — Pokétwo has market but not auctions; we have both
4. **Trainer progression** — level + rank title system — Pokétwo lacks this
5. **AI Professor** via Groq — unique in market
6. **Giveaway system** — most bots lack integrated giveaways

## Where We Lag

1. **Name-to-catch** — Pokétwo requires typing the Pokémon name to catch, which creates memorable moments. Our button click is easier but less engaging.
2. **Pokémon release** — can't release unwanted Pokémon for coins/XP
3. **Nickname command** — nickname stored in schema but no `/nick` command
4. **Gym/Elite Four system** — titles only; no actual gym challenges
5. **EV training** — schema exists, not used
6. **Evolution** — schema exists (`evolvesFromId`, `evolutionLevel`), not implemented
