# Competitor Gap Analysis — Pokémon Master Bot

> Generated S2 (2026-06-14). Feature competitors: **Dank Memer** (economy), **Pokétwo** (Pokémon catching/collection), **Mudae** (gacha/collect), **OwO** (economy/animals/battle). Quality/UX bar: the owner's **dank-bot** (branded embeds, persistent button handlers, color palette).
> Current bot: 42 slash commands, economy + Pokémon catch/collection + real TCG cards + battles + moderation + giveaways + AI professor.

## Feature matrix (Present / Missing / Better / Worse)

| Feature area | This bot | Dank Memer | Pokétwo | Mudae | OwO |
|---|---|---|---|---|---|
| Currency wallet + bank | ✅ | ✅ (gold std) | ➖ | ➖ | ✅ |
| Daily/weekly/work/beg | ✅ | ✅ | ➖ | ➖ | ✅ |
| Shop + buy items | ⚠️ shop view, **no `/buy`** | ✅ | partial | ➖ | ✅ |
| Inventory/items usage | ❌ | ✅ deep | ➖ | ➖ | ⚠️ |
| Rob/PvP economy | ✅ | ✅ | ➖ | ➖ | ✅ |
| Gambling minigames | ❌ | ✅ (slots, blackjack, etc.) | ➖ | ➖ | ✅ |
| Pokémon spawns + catch | ✅ (message-triggered) | ➖ | ✅ (gold std) | ➖ | ⚠️ |
| Catch via name typing | ❌ (`/catch` only) | ➖ | ✅ type the name | ➖ | ➖ |
| Collection/box + filters/sort | ✅ basic | ➖ | ✅ rich (`--name --level --iv`) | ✅ | ⚠️ |
| IV/stats/nature/level | ❌ | ➖ | ✅ | ➖ | ➖ |
| Shiny mechanic | ⚠️ shiny rate config exists | ➖ | ✅ | ➖ | ➖ |
| Trading w/ confirmation+lock | ⚠️ button confirm, **no Redis-safe lock on trade** | ✅ | ✅ | ✅ | ✅ |
| Market/auction house | ❌ | ✅ | ✅ | ➖ | ⚠️ |
| Real TCG cards + packs | ✅ (unique strength) | ➖ | ➖ | ➖ | ➖ |
| TCG pricing/value | ❌ | ➖ | ➖ | ➖ | ➖ |
| Battles (PvP) | ✅ | ➖ | ✅ (duel) | ➖ | ✅ |
| Battle vs wild/NPC/gyms | ❌ | ➖ | ⚠️ | ➖ | ⚠️ |
| Leveling/XP from chat | ✅ | ⚠️ | ✅ | ➖ | ✅ |
| Quests/achievements | ✅ | ✅ | ⚠️ | ➖ | ✅ |
| Leaderboards | ✅ | ✅ | ✅ | ✅ | ✅ |
| Giveaways | ✅ | ⚠️ | ➖ | ➖ | ➖ |
| Moderation suite | ✅ (9 cmds) | ➖ | ➖ | ➖ | ➖ |
| AI assistant | ✅ (Groq professor) | ➖ | ➖ | ➖ | ➖ |
| Web dashboard | ✅ (Express + Discord OAuth) | ⚠️ | ➖ | ➖ | ➖ |
| Branded embeds/buttons (dank-bot bar) | ⚠️ inconsistent | ✅ polished | ✅ | ⚠️ | ⚠️ |
| Persistent buttons (survive restart) | ❌ in-memory collectors | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ strong · ⚠️ partial · ❌ missing · ➖ not applicable to that bot.

## Where this bot is BETTER
- **Real Pokémon TCG cards + packs** — none of the four competitors do this. Biggest differentiator.
- **All-in-one**: economy + catching + TCG + moderation + giveaways + dashboard + AI in one bot (competitors are single-purpose).
- **AI Professor (Groq)** and **web dashboard with OAuth** are above-market.

## Where this bot is WORSE
- **No persistent components** (battles/trades/giveaways die on restart) — below the dank-bot bar.
- **Shallow collection mechanics** vs Pokétwo (no IV/nature/level/sort filters, weak shiny).
- **Incomplete economy loop** (`/shop` with no `/buy`, no item usage, no gambling).
- **No market/auction** (Pokétwo & Dank Memer both have one).
- **Inconsistent embed branding/UX** vs dank-bot.

---

## TOP 25 high-impact features (ranked)

### P1 — do first (close broken loops + table stakes)
1. **`/buy`** to complete the shop loop (economy is currently dead-ended). *(also COMMAND_AUDIT C1)*
2. **Persistent button handlers** for battle/trade/giveaway (survive restart) — dank-bot bar.
3. **Provision Redis / graceful Redis fallback** so cooldowns, spawns, battles work. *(blocker)*
4. **Catch-by-typing** wild Pokémon name (Pokétwo's core hook) in addition to `/catch`.
5. **IV / level / nature** on caught Pokémon + show in `/box`/`/pokemon`.
6. **Collection filters & sort** (`/box --name --rarity --shiny --sort`).
7. **TCG collection value + set completion** (use tcgplayer prices). *(TCG audit P1)*
8. **Shiny pulls done right** (visible odds, sparkle embed, shiny flag in collection).
9. **Branded embed system** (shared builder, color palette, brand author/footer).
10. **Gambling minigames** (slots / coinflip / blackjack) — major economy retention.

### P2 — strong value
11. **Market / auction house** (list, browse, buy Pokémon & cards).
12. **Trade safety** (atomic ownership validation + Redis lock for `/trade`).
13. **Item inventory + usable items** (poké balls improve catch, lures boost spawns).
14. **Card trading** (extend `/trade` to TCG cards). *(TCG audit P2)*
15. **Daily featured card + daily streak rewards** beyond `/daily`.
16. **NPC / gym battles** (PvE progression, not just PvP).
17. **`/unban`** + full mod-log channel. *(COMMAND_AUDIT C2)*
18. **Achievements tied to TCG/collection milestones**.
19. **Profile cards as images** (dank-bot-style generated card).
20. **Auto-register commands on deploy** (currently manual `deploy:commands`).

### P3 — depth / nice-to-have
21. **Deck builder + sharing** (TCG). *(TCG audit P3)*
22. **Breeding / evolution** mechanics.
23. **Server-configurable spawn channels & rates UI** in dashboard.
24. **Seasonal events / battle pass** (dank-bot has DankPass).
25. **Crafting / fusion** sink for duplicate cards.

## NEXT_SESSION_TASKS
- [ ] Lock the P1 list into a build order; start with `/buy`, persistent buttons, Redis, catch-by-typing.
- [ ] Decide product positioning: lead with the **unique real-TCG** angle competitors lack.
