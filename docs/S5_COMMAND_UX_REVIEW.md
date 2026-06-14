# S5 Command UX Review
Date: 2026-06-14 | Session: S5

---

## Scoring Method

Each command rated on:
- **Description clarity** (does it explain what it does and what to expect?)
- **Option clarity** (are parameters self-explanatory?)
- **Response quality** (does the embed give meaningful feedback?)
- **Error messages** (are failure states friendly?)

---

## Economy

| Command | Description | Options | Response | UX Issues |
|---------|-------------|---------|----------|-----------|
| /balance | ✅ Clear | N/A | ✅ Shows wallet + bank | None |
| /beg | ✅ Clear | N/A | ✅ Themed responses | Cooldown not shown in response |
| /buy | ✅ Clear | `item` — needs fuzzy guidance | ✅ Confirms purchase, shows remaining | No autocomplete on item names; user must know `/shop` first |
| /daily | ✅ Clear | N/A | ✅ Shows streak + XP | None |
| /deposit | ✅ Clear | `amount` | ✅ Shows new balances | None |
| /fish | ✅ Clear | N/A | ✅ Outcome + XP | None |
| /hunt | ✅ Clear | N/A | ✅ Outcome + XP | None |
| /market browse | ✅ | type, page | ✅ | `shortId` not explained until footer |
| /market list | Needs context: "what happens after listing?" | type, name, price | ✅ Shows listing ID | `name` is free text — no validation |
| /market buy | ✅ | listing_id | ✅ | Requires knowing shortId from browse |
| /market cancel | ✅ | listing_id | ✅ | None |
| /monthly | ✅ Clear | N/A | ✅ Streak + XP + bonus | None |
| /pay | ✅ Clear | user, amount | ✅ Confirms both sides | None |
| /rob | ✅ Clear | user | Varies | Failure message could be more thematic |
| /shop | ✅ Clear | N/A | ✅ | Items listed but no quantities in stock shown |
| /weekly | ✅ Clear | N/A | ✅ Streak + XP | None |
| /withdraw | ✅ Clear | amount | ✅ | None |
| /work | ✅ Clear | job (choice list) | ✅ Event + XP + level | Good |

---

## Careers

| Command | Description | UX Issues |
|---------|-------------|-----------|
| /career | ✅ NEW S5 — shows all careers | First-time users won't know careers exist without /help |
| /fisher | ✅ Clear | Rod tier not obvious from description — "try /shop for rods" added in footer |
| /researcher | ✅ | None |
| /ranger | ✅ | None |
| /breeder | ✅ | None |
| /miner | ✅ | None |
| /rocket | ✅ — mentions "high-risk" | Fail message should name the fine amount |

---

## Pokemon

| Command | Description | UX Issues |
|---------|-------------|-----------|
| /box | ✅ | No IV display yet (S6 item) |
| /catch | Misleading — redirects to button click | "Use /catch" instructions in spawn embed, then /catch says go click button — confusing |
| /favorite | ✅ | None |
| /pokedex | ✅ | None |
| /pokemon | ✅ | None |
| /team | ✅ | None |
| /trade | ✅ — requires knowing Pokemon IDs | ID lookup is friction point; no autocomplete |

---

## Moderation

| Command | Description | UX Issues |
|---------|-------------|-----------|
| /ban | ✅ — description clear | None |
| /unban | ✅ | None |
| /kick | ✅ | None |
| /timeout | ✅ | `duration` in minutes — not obvious |
| /warn | ✅ | None |
| /warnings | ✅ | None |
| /lock | ✅ | None |
| /unlock | ✅ | None |
| /slowmode | ✅ | None |
| /purge | ✅ | None |

---

## Social

| Command | Description | UX Issues |
|---------|-------------|-----------|
| /profile | ✅ — rich embed | None |
| /leaderboard | ✅ | Type options not all documented in help |
| /achievements | ✅ | No progress shown for unearned achievements |
| /quests | ✅ | Quest completion not wired — display only |

---

## Utility

| Command | Description | UX Issues |
|---------|-------------|-----------|
| /help | ✅ | Could group by category better |
| /ping | ✅ | None |
| /professor | ✅ — AI chatbot | Rate limit not shown to user |
| /setup | ✅ | None |
| /welcome | ✅ | None |

---

## Priority UX Fixes (S6)

| Fix | Impact | Effort |
|----|--------|--------|
| Add autocomplete to `/buy item` using SHOP_ITEMS names | High — removes friction | Low (30 min) |
| Add autocomplete to `/pokemon_id` in `/trade` from user's box | High — removes friction | Medium (1h) |
| Fix `/catch` wording — spawn embed says "Use /catch" but /catch redirects to button | Medium | Low (10 min) |
| Show IV total in `/box` embed per Pokémon | Medium | Low (20 min) |
| Add progress bars to `/achievements` for unearned achievements | Low | Medium |
| Add `/career` mention to `/help` | Low | Low (5 min) |
| Show coin reserve in `/auction bid` (coins are not held in escrow yet) | Medium | Depends on escrow implementation |
