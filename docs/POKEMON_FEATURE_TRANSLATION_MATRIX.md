# Pokemon Feature Translation Matrix

> Every dank-bot system translated into its Pokemon-centric equivalent.
> Rule: no feature added unless it integrates with Trainer XP, Pokémon progression, collection, TCG, or Gym systems.
> Scored: Retention (1-5) | Effort (1-5, 1=easy) | Progression impact | Social impact

---

## Translation table

| dank-bot feature | Pokemon-Master equivalent | Core integration | Ret | Eff | Prog | Social |
|---|---|---|---|---|---|---|
| **Battle Pass** (DankPass) | **Trainer Journey** (PokéPass) | Trainer XP → tier unlocks; rewards = Pokémon, packs, TCG cards, titles | 5 | 3 | 5 | 4 |
| **Stocks** | **Pokémon Card Market** | TCG card `marketValue` (tcgplayer.prices); buy/sell card futures | 4 | 3 | 3 | 3 |
| **Factions** | **Trainer Teams** | Team XP pools; team battles; team Gym control battles | 5 | 4 | 4 | 5 |
| **Territories** | **Gym Control System** | Teams compete for Gym Badges; Gym XP bonuses; daily coin income for holders | 5 | 4 | 5 | 5 |
| **Missions** | **Trainer Challenges** | PokeAPI-linked objectives (catch type X, win N battles); reward = XP + rare spawn | 4 | 2 | 4 | 3 |
| **Bounties** | **Legendary Hunts** | Target = specific legendary; first to catch clears hunt; bounty reward from pool | 5 | 3 | 4 | 5 |
| **Casino / Game Corner** | **Game Corner** | Coin-operated slots/Voltorb Flip; spend PokéCoins; prize = Pokémon or TCG packs | 4 | 2 | 2 | 3 |
| **Marketplace** | **Pokémon Exchange** | List Pokémon or TCG cards for fixed-price sale; browse by type/rarity | 5 | 2 | 3 | 4 |
| **Auctions** | **Auction House** | Time-limited bids on rare/shiny Pokémon or foil TCG cards; integrated with `MarketListing.isAuction` | 5 | 2 | 3 | 5 |
| **Prestige** | **Trainer Rebirth** | At Trainer level 100: reset to 1 with cosmetic badge + permanent stat bonus; retain Collection | 4 | 2 | 5 | 3 |
| **Kill streak** | **Battle Win Streak** | Consecutive battle wins = XP multiplier; 5-streak post to leaderboard; resets on loss | 4 | 2 | 4 | 4 |
| **Rob** | **Pickpocket** | Steal small coin amount from trainer; counter = held item "Amulet Coin" that protects wallet | 3 | 2 | 2 | 3 |
| **Contracts** | **Breeder Contracts** | Commission another trainer to level a Pokémon to X; pays XP + coins on delivery | 3 | 3 | 4 | 4 |
| **Insurance** | **Pokémon Daycare** | Pay daily coins; on next battle loss the losing Pokémon is "recovered" rather than losing HP bonus | 2 | 2 | 2 | 2 |
| **Wager/duel** | **Stake Battle** | `/battle stake` — bet PokéCoins on a ranked battle; loser transfers stake | 4 | 2 | 3 | 4 |
| **Wanted** | **Trainer Bounty Board** | Post a "wanted" notice on a rival trainer; public board; bounty claimed by defeating them | 3 | 2 | 3 | 4 |
| **Squad** | **Trainer Party** | Up to 4 trainers queue together for multi-battles or co-op Legendary Hunt | 3 | 3 | 3 | 5 |
| **Featured reward** | **Professor's Daily Pick** | Prof Oak posts a rotating daily card/Pokémon that one trainer can claim first | 4 | 1 | 2 | 3 |
| **Flagmap / territory radar** | **Gym Map** | Interactive embed showing which Trainer Team controls each of 8 Gyms; updates on Gym battles | 3 | 3 | 3 | 4 |
| **Server event** | **Pokémon Festival** | Seasonal event: boosted shiny rates, double XP, exclusive Pokémon spawns, special TCG packs | 5 | 3 | 4 | 5 |
| **Stocks (market sim)** | **Berry Market** | Trade in-game berry items; prices fluctuate daily; berries can be used in battle for stat effects | 2 | 4 | 3 | 2 |

---

## Ranked by combined score (Ret + Prog + Social − Effort)

| Rank | Feature | Combined |
|---|---|---|
| 1 | **Gym Control System** (Territories) | 12 |
| 2 | **Trainer Journey / PokéPass** (Battle Pass) | 11 |
| 3 | **Legendary Hunts** (Bounties) + **Trainer Teams** (Factions) | 10 |
| 4 | **Auction House** (Auctions) + **Battle Win Streak** (Kill Streak) | 10 |
| 5 | **Pokémon Exchange** (Marketplace) | 10 |
| 6 | **Game Corner** (Casino) | 7 |
| 7 | **Stake Battle** (Wager) + **Pokémon Card Market** (Stocks) | 8 |

---

## Pokemon-centric integration map

```
Trainer XP ──────────────────────────────────────────┐
  ↑ from: battles, quests, daily streak, pack opens   │
  ↑ from: Gym challenge wins, message XP               │
  → feeds: Trainer Journey tiers, Trainer Rebirth     │
  → unlocks: higher Gym challenges, TCG set access    │
                                                       │
Pokemon Level / XP ───────────────────────────────────┤
  ↑ from: battle participation (not yet wired)        │
  ↑ from: Breeder Contracts (P3)                      │
  → feeds: IV/EV stat efficiency, evolution           │
  → unlocks: Gym eligibility (min level requirements) │
                                                       │
TCG Collection ──────────────────────────────────────┤
  ↑ from: PokéCoins → /buy pack → open with /pack    │
  ↑ from: Trainer Journey tier rewards                │
  ↑ from: Game Corner prizes                          │
  → feeds: Card Market prices, collection value       │
  → Auction House listings                            │
  → Trainer Rebirth cosmetic badge from TCG ach.      │
                                                       │
Gym Control ─────────────────────────────────────────┤
  ↑ from: Trainer Teams competing via /battle stake   │
  → feeds: Team daily coin income                     │
  → feeds: Trainer XP bonus for Gym holders           │
  → feeds: Legendary Hunt eligibility                 │
                                                       │
PokéCoins ────────────────────────────────────────────┘
  ↑ from: /work /daily /fish /hunt /beg + Game Corner
  → spent: /buy (shop), /pack, Auction House, Exchange
  → staked: /battle stake, Legendary Hunt prize pool
```

---

## Build order (exploit schema first)

The schema already supports Auction House and Pokémon Exchange (`MarketListing`), card market value (`Card.marketValue`), battle win tracking (`User.battlesWon`), and Pokemon XP/level/IV/EV. These require ZERO schema changes.

```
WEEK 1 — Zero schema changes, max impact
  1. /buy command (closes shop loop)
  2. /market list/browse/buy (MarketListing, fixed price — Pokemon + cards)
  3. /auction place/bid/end (MarketListing.isAuction — already modeled)
  4. Battle win streak announce + XP multiplier (User.battlesWon already tracked)
  5. Show IVs/stats in /box + /pokemon (calc functions already exist)

WEEK 2 — Small schema changes
  6. Wire addXp() to battle wins + announce level-up
  7. Pokemon level-up from battle XP
  8. /monthly command (schema ready)
  9. Game Corner /gamecorner coinflip/slots (new table: GameCornerStats)
  10. Trainer Journey / PokéPass (new tables: TrainerPass, TrainerPassTier)

WEEK 3 — Medium schema changes
  11. Trainer Teams (new tables: Team, TeamMember, TeamXp)
  12. Gym Control System (new tables: Gym, GymChallenge, GymHolder)
  13. Legendary Hunts (extend Quest table or new LegendaryHunt table)
  14. Pokemon Festival seasonal events (Event model exists!)
  15. Stake battles (extend Battle: addedStake Int)
```
