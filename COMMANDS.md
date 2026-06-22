# Commands Reference

All commands use Discord slash commands (`/`).

---

## 🎮 Pokemon Commands

### `/pokemon <name>`
Look up any Pokemon's stats, types, abilities, and description.
- **name** — Pokemon name or dex number (supports autocomplete)

### `/pokedex`
View your Pokedex completion stats and caught Pokemon by rarity.

### `/catch`
Find active wild encounters in your server. Wild Pokémon spawn automatically in configured channels. Use the **Throw Poké Ball** button on an encounter to catch it.

### `/spawn` *(Administrator)*
Control wild encounters:
- `/spawn now` — force encounters immediately, optionally choosing a Pokémon, channel, or every configured channel.
- `/spawn channels` — add, remove, clear, or list multiple spawn channels.
- `/spawn settings` — toggle automatic spawns and configure message chance, cooldown, and random/all-channel mode.
- `/spawn status` — inspect active encounters and current spawn health.

### `/box [page]`
Browse your Pokemon collection with pagination.
- Shows level, shiny status, favorites
- Paginated 10 per page

### `/team <subcommand>`
Manage your 6-Pokemon battle team.
- **view** — See your current team
- **add <pokemon_id> <slot>** — Add Pokemon from box (ID from `/box`) to a slot (1-6)
- **remove <slot>** — Remove Pokemon from team slot

### `/trade <user> <pokemon_id> <request>`
Trade Pokemon with another trainer.
- **user** — Trainer to trade with
- **pokemon_id** — Your Pokemon ID to offer
- **request** — Their Pokemon ID you want

### `/favorite <pokemon_id>`
Toggle a Pokemon as favorite (shows with ❤️ in box, pinned at top).

---

## 💰 Economy Commands

### `/balance [user]`
Check wallet and bank balance. View another user's balance optionally.

### `/daily`
Claim your daily PokéCoin reward.
- Base: 500 coins + streak bonus (up to +1000)
- Resets every 24 hours
- Keep your streak by claiming daily!

### `/weekly`
Claim your weekly PokéCoin reward.
- Base: 2500 coins + streak bonus (up to +2000)
- Resets every 7 days

### `/work <job>`
Work a job shift to earn coins. Jobs have different pay ranges and cooldowns.

Available jobs:
| Job | Pay Range | Cooldown |
|-----|-----------|----------|
| Pokemon Professor | 400–800 | 1h |
| Pokemon Ranger | 350–700 | 1h |
| Gym Assistant | 300–600 | 1h |
| PokeMart Worker | 250–500 | 1h |
| Safari Guide | 450–900 | 1h |
| Breeder | 350–700 | 1h |
| Researcher | 500–1000 | 1h |
| Nurse Assistant | 300–600 | 1h |

### `/fish`
Go fishing for coins. 30-minute cooldown.
- Chance to catch: Magikarp → Dratini
- Rare catches give higher rewards!

### `/hunt`
Hunt wild Pokemon in tall grass for coins. 1-hour cooldown.
- Encounters: Rattata → Dragonite
- 15% chance of finding nothing

### `/beg`
Beg passerby trainers for coins. 10-minute cooldown.
- Low reward but fast cooldown

### `/rob <user>`
Attempt to steal coins from another trainer.
- 40% success rate (server configurable)
- On failure: pay a fine
- On success: steal 10-30% of their wallet (capped)
- Cooldown: 24 hours
- Can be disabled per server with `/config rob enabled:false`

### `/deposit <amount|all>`
Move coins from wallet to bank (safe from robbery).

### `/withdraw <amount|all>`
Move coins from bank to wallet.

### `/shop`
Browse the PokéMart shop. Use `/buy <item>` to purchase.

---

## 🃏 Card Commands

### `/pack [set]`
Open a Pokemon TCG card pack (10 cards). Costs 500 PokéCoins.
- Optional: specify a card set (supports autocomplete)
- Cards saved to your collection
- 1-hour cooldown

### `/card <name>`
Look up any Pokemon card by name with artwork.

### `/collection [user]`
View your Pokemon card collection.

---

## ⚔️ Battle Commands

### `/battle <opponent> [type]`
Challenge another trainer to a Pokemon battle.
- **opponent** — Discord user to challenge
- **type** — `Unranked` (default) or `Ranked`

Battle flow:
1. Opponent has 60 seconds to Accept or Decline
2. Turn-based combat using your team
3. Click move buttons on your turn
4. First trainer to faint all opposing Pokemon wins

Ranked battles affect your ranked points and tier (Bronze → Master).

---

## 👥 Social Commands

### `/profile [user]`
View a trainer's full profile:
- Level, XP, ranked tier
- Balance, Pokemon stats, battle record
- Achievements, shiny/legendary counts, streak

### `/leaderboard [type]`
View server leaderboards:
- **balance** (default), **pokemon**, **battles**, **ranked**, **shiny**, **level**

### `/achievements [user]`
View earned achievements. 27 achievements across 6 categories.

### `/quests`
View your active daily and weekly quests with progress bars.

---

## 🎉 Giveaway Commands

### `/giveaway create <title> <prize> <duration> [winners]`
Start a giveaway (no special permissions required).
- **title** — Giveaway title
- **prize** — Description of the prize
- **duration** — Duration in minutes
- **winners** — Number of winners (default: 1, max: 10)

### `/giveaway end <id>`
End a giveaway early. Requires **Manage Server** permission.

### `/giveaway reroll <id>`
Reroll winners for an ended giveaway. Requires **Manage Server** permission.

---

## 🔨 Moderation Commands

All moderation commands require corresponding Discord permissions.

### `/ban <user> [reason] [delete_days]`
Ban a user from the server. Requires `Ban Members`.

### `/kick <user> [reason]`
Kick a user from the server. Requires `Kick Members`.

### `/warn <user> <reason>`
Issue a warning. User is notified via DM. Requires `Moderate Members`.

### `/timeout <user> <duration> [reason]`
Time out a user for 1 minute to 4 weeks. Requires `Moderate Members`.

### `/warnings <user>`
View all warnings for a user. Requires `Moderate Members`.

### `/purge <amount> [user]`
Bulk delete up to 100 messages. Optionally filter by user. Requires `Manage Messages`.

### `/lock [reason]`
Lock current channel (disable @everyone from sending). Requires `Manage Channels`.

### `/unlock`
Unlock current channel. Requires `Manage Channels`.

### `/slowmode <seconds>`
Set channel slowmode (0 to disable). Requires `Manage Channels`.

---

## 🔧 Utility Commands

### `/ping`
Check bot and API latency.

### `/help [category]`
View all commands. Optionally filter by category.

### `/setup <type>`
Configure Pokemon Master for your server. Requires **Administrator**.
- **Full Setup** — Auto-creates all channels and roles
- **Manual** — Skip auto-setup

### `/welcome <subcommand>`
Configure the welcome system. Requires **Manage Server**.
- **setup <channel> [message]** — Set welcome channel and message
  - Use `{user}` for mention, `{server}` for server name
- **preview** — Preview the welcome message
- **disable** — Disable welcome messages

### `/professor ask <question> [model]`
Ask Professor Oak (AI) any Pokemon question.
- Powered by Groq AI (Llama 3.1 70B by default)
- Optional: choose a different AI model
- 15-second cooldown

### `/config <subcommand>`
Configure per-server settings. Requires **Administrator**.
- **economy** — daily/weekly rewards, work cooldown
- **spawns** — enable/disable, cooldown, shiny rate
- **moderation** — anti-spam, scam detection, anti-raid
- **rob** — enable/disable, success rate, cooldown
- **view** — View all current settings
