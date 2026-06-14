# COMMAND UX AUDIT — S4
Generated: 2026-06-14 | Session S4 | 54 total commands

---

## Summary

| Category | Count | UX Issues |
|---|---|---|
| Admin | 1 | 0 |
| Cards | 3 | 0 |
| Economy (core) | 8 | 1 |
| Economy (career) | 6 | 0 |
| Economy (market) | 2 | 0 |
| Giveaways | 1 | 0 |
| Moderation | 10 | 1 |
| Pokémon | 7 | 1 |
| Battles | 1 | 0 |
| Social | 4 | 0 |
| Utility | 5 | 1 |
| **Total** | **54** | **4** |

---

## Admin

| Command | Description | Permissions | Cooldown | Mod Log | Notes |
|---|---|---|---|---|---|
| /config | Configure bot settings | Administrator | None | No | ✅ Clean |

---

## Cards

| Command | Description | Permissions | Cooldown | Notes |
|---|---|---|---|---|
| /card | Look up a TCG card by name | None | None | ✅ Clean |
| /collection | View your card collection | None | None | ✅ Clean |
| /pack | Open a card pack (500 coins) | None | 1h | ✅ Now persists Card.marketValue |

---

## Economy — Core

| Command | Description | Permissions | Cooldown | XP | Notes |
|---|---|---|---|---|---|
| /balance | View your balance | None | None | No | ✅ Clean |
| /beg | Beg for coins (low reward) | None | 30m | No | ⚠️ No addXp — low priority |
| /buy | Buy shop items | None | None | No | ✅ S4 new |
| /daily | Daily coin claim | None | 24h | +50–150 XP | ✅ S4 wired |
| /deposit | Deposit to bank | None | None | No | ✅ Clean |
| /fish | Go fishing | None | 30m | +10–20 XP | ✅ S4 wired |
| /hunt | Hunt wild Pokémon | None | 30m | +10–25 XP | ✅ S4 wired |
| /monthly | Monthly coin claim | None | 30d | +200 XP | ✅ S4 new |
| /pay | Pay another user | None | None | No | ✅ S4 new |
| /rob | Rob another user | None | 1h | No | ✅ Clean |
| /shop | View available shop items | None | None | No | ✅ Clean |
| /weekly | Weekly coin claim | None | 7d | No | ⚠️ No addXp — add in S5 |
| /withdraw | Withdraw from bank | None | None | No | ✅ Clean |
| /work | Generic job work | None | 1h | +25–50 XP | ✅ S4 wired + job levels |

---

## Economy — Career (all S4 new)

| Command | Description | Cooldown | Fail Rate | XP | Equipment Tiers |
|---|---|---|---|---|---|
| /fisher | Fish for rare catches | 1h | 8% | +20–60 XP | Old Rod / Good Rod / Super Rod / Master Rod |
| /researcher | Research Pokémon discoveries | 1h | 0% | +30–80 XP | Notebook / Pokédex Scanner / Lab Kit / Professor Kit |
| /ranger | Track and encounter Pokémon | 1h | 0% | +25–70 XP | Net / Tracking Kit / Field Scanner / Ranger Gear |
| /breeder | Work at Day Care | 1h | 0% | +25–70 XP | Incubator / Incubator+ / Nursery Pass / Breeding Kit |
| /miner | Mine for stones and fossils | 1h | 0% | +25–70 XP | Pickaxe / Steel Pickaxe / Drill / Excavation Gear |
| /rocket | Team Rocket heists | 2h | 30% base | +30–80 XP | None (rank reduces failure) |

---

## Economy — Market & Auction (all S4 new)

| Command | Subcommands | Notes |
|---|---|---|
| /market | browse, list, buy, cancel | Max 10 active listings per user. ShortId = last 6 chars of cuid |
| /auction | place, bid, view, browse | Instant buyout triggers transferBalance immediately. Bids stored as Json array |

---

## Giveaways

| Command | Description | Permissions | Notes |
|---|---|---|---|
| /giveaway | Create a giveaway | ManageGuild | ✅ Clean |

---

## Moderation

| Command | Description | Permissions | Mod Log |
|---|---|---|---|
| /ban | Ban a member | BanMembers | ✅ logModAction called |
| /kick | Kick a member | KickMembers | ✅ logModAction called |
| /lock | Lock a channel | ManageChannels | ⚠️ No logModAction (channel action, low priority) |
| /purge | Bulk delete messages | ManageMessages | ⚠️ No logModAction (low priority) |
| /slowmode | Set channel slowmode | ManageChannels | ⚠️ No logModAction (low priority) |
| /timeout | Timeout a member | ModerateMembers | ✅ logModAction called |
| /unban | Unban a user by ID | BanMembers | ✅ S4 new — logModAction called |
| /unlock | Unlock a channel | ManageChannels | ⚠️ No logModAction (low priority) |
| /warn | Warn a member | ModerateMembers | ✅ logModAction called |
| /warnings | View a member's warnings | ModerateMembers | ✅ Clean |

---

## Pokémon

| Command | Description | Permissions | Notes |
|---|---|---|---|
| /box | View your Pokémon box | None | ✅ Clean |
| /catch | Catch wild Pokémon | None | ✅ Clean |
| /favorite | Mark a Pokémon as favorite | None | ✅ Clean |
| /pokedex | Look up a Pokémon | None | ✅ Clean |
| /pokemon | View a specific Pokémon | None | ✅ Clean |
| /team | Manage your team | None | ✅ Clean |
| /trade | Trade Pokémon with a player | None | ⚠️ No XP for trade — add in S5 |

---

## Battles

| Command | Description | Notes |
|---|---|---|
| /battle | Battle another trainer | ✅ S4 fixed — now calls addXp via saveBattleResult() |

---

## Social

| Command | Description | Notes |
|---|---|---|
| /achievements | View achievement progress | ✅ Clean |
| /leaderboard | Server leaderboard | ✅ Clean |
| /profile | View trainer profile with rank | ✅ Shows trainer XP, level, title |
| /quests | View daily quests | ✅ Clean |

---

## Utility

| Command | Description | Notes |
|---|---|---|
| /help | Help menu | ✅ Clean |
| /ping | Latency check | ✅ Clean |
| /professor | Ask Professor Oak (AI) | ✅ Clean |
| /setup | Server setup wizard | ✅ Clean |
| /welcome | Configure welcome message | ⚠️ Generic description — "Configure the welcome message" |

---

## UX Issues Summary (for S5)

1. `/weekly` — no addXp call. Add +75 XP.
2. `/beg` — no addXp call. Add +5 XP.
3. `/trade` — no XP for completing a trade. Add +50 XP.
4. `/welcome` description overly generic — could be clearer about channel and message customization.
5. Channel-action mod commands (lock/unlock/slowmode/purge) could log to mod log channel for full auditability.
