# Slash Command Quality Review

> Generated S2 (2026-06-14). **Benchmark: the owner's `dank-bot` (DayZ) quality bar** — branded embeds with a fixed color palette, brand author icon/thumbnail, persistent DB-backed button handlers that survive restarts, consistent shared embed builders, image-generated badges, and footers with timestamps. Source: `src/commands/**`.

## dank-bot quality bar (what to match)

| dank-bot convention | Pokémon-bot current state | Gap |
|---|---|---|
| All embeds branded (author icon = brand logo, consistent footer) | Embeds set color + title; no brand author icon; footers inconsistent | Add shared brand author/footer to `utils/embeds.ts` |
| Fixed semantic color palette (per-event hex) | Ad-hoc colors per command (`0xffcb05`, `0x00ff00`, `0xff4444`) | Define a palette constant (success/error/economy/legendary/etc.) |
| Persistent button handlers (DB-lookup, survive restart) | `/battle`,`/trade`,`/giveaway` use **in-memory collectors** (die on restart) | Move to persistent customId-routed handlers |
| Shared embed builders (no inline duplication) | Each command builds embeds inline | Centralize builders |
| Image-generated badges/cards | Static text/thumbnails only | Optional: card/profile image generation |

## Headline

- **42/42 commands have a name + description.** ✅
- **All options have descriptions.** ✅ (no missing `setDescription` on any option)
- **Naming is consistent:** all lowercase, single-token command names; subcommand groups used for multi-action commands (`/team`, `/welcome`, `/config`, `/giveaway`, `/professor`). ✅
- **Gap vs Dank Memer:** descriptions are functional but terse/inconsistent in voice and punctuation; replies mix `content:` strings and embeds; ephemeral usage is inconsistent.

## Description consistency issues

| Issue | Examples | Fix |
|---|---|---|
| Inconsistent currency spelling | `/balance` "PokeCoin", `/daily` "PokeCoin", but `/beg` "PokéCoins", `/fish` "PokéCoins" | Standardize to **PokéCoins** everywhere (incl. command descriptions). |
| Inconsistent terminal punctuation | `/fish` "Go fishing for PokéCoins!" (!), `/hunt` "...for PokéCoins!" (!) vs most others no period | Pick one style; Dank Memer uses no trailing period, sentence case. |
| Terse vs descriptive | `/box` "View your Pokemon collection" vs `/pokedex` "View your Pokedex progress" (good); `/rob` "Attempt to rob another trainer" (good) | Aim for verb + object + flavor, ≤100 chars. |
| Missing accent | "Pokemon" vs "Pokémon" used inconsistently in descriptions | Use **Pokémon** consistently. |

## Reply/UX consistency issues

| Issue | Where | Fix |
|---|---|---|
| Mixed `content:` vs embeds | `/pack`,`/timeout`,`/kick` use plain `content:`; most others use embeds | Standardize on branded embeds (shared `utils/embeds.ts`). |
| Inconsistent ephemeral | Cooldown/error replies are ephemeral in some commands, public in others | Errors/cooldowns → ephemeral; results → public (dank-bot convention). |
| `JSON.stringify` shown to users | `/config` replies print raw `JSON.stringify(data)` | Render a readable field list instead of raw JSON. |
| No `deferReply` on slow ops | TCG/AI commands defer (`/pack`,`/professor`); some PokéAPI lookups may not | Ensure any API-backed command defers within 3s. |

## Per-category description polish suggestions (dank-bot-grade voice)

| Command | Current | Suggested |
|---|---|---|
| `/balance` | Check your PokeCoin balance | Check your PokéCoin wallet and bank |
| `/beg` | Beg for PokéCoins | Beg strangers for a few PokéCoins |
| `/work` | Work a job to earn PokéCoins | Clock in at a job for a PokéCoin paycheck |
| `/fish` | Go fishing for PokéCoins! | Cast a line and sell your catch for PokéCoins |
| `/hunt` | Hunt Pokemon in the wild for PokéCoins! | Hunt in the tall grass for a PokéCoin reward |
| `/rob` | Attempt to rob another trainer | Risk it all to rob another trainer's wallet |
| `/box` | View your Pokemon collection | Browse the Pokémon you've caught |
| `/shop` | Browse and buy items from the PokéShop | Browse the PokéShop and spend your coins |
| `/config` | Configure Pokemon Master settings | Configure the bot for this server (admin) |

## Strengths (keep)

- Subcommand grouping is clean and matches Discord best practice.
- Options use `setRequired`, `setMinValue`/`setMaxValue`, `addChoices`, and `setAutocomplete` appropriately (`/pokemon`, `/pack` autocomplete; `/timeout` duration bounds; `/purge` 1-100).
- Permission-gated commands use `setDefaultMemberPermissions`.

## NEXT_SESSION_TASKS
- [ ] Standardize "PokéCoins"/"Pokémon" spelling + punctuation across all descriptions.
- [ ] Route all replies through `utils/embeds.ts`; consistent ephemeral policy.
- [ ] Replace `/config` raw JSON with formatted fields.
- [ ] Audit every API-backed command for `deferReply` within 3s.
