# Pokémon Gifting

Date: 2026-06-21

## Command

Commands:

- `/gift pokemon pokedex`
- `/gift pokemon collection`

Each path has its own autocomplete picker and confirmation screen. Pokédex
autocomplete only offers eligible captured Pokémon. Collection autocomplete
shows TCG cards with rarity, foil state, and quantity.

Users see names, level, IV percentage, rarity, foil state, and quantity. Internal
ownership identifiers are carried only in the autocomplete value and are never
typed or displayed as part of the workflow.

## Safety

- Sender and recipient cannot be the same user.
- Bots cannot receive gifts.
- Ownership is checked before review and again inside the transfer transaction.
- Team members, favorites, protected Pokémon, and market-listed caught Pokémon
  cannot be gifted.
- `/protect` provides an autocomplete-driven lock toggle for captured Pokémon.
- Caught Pokémon cannot be gifted while the sender has an active battle.
- Card gifts transfer exactly one copy and preserve foil state.
- The ownership mutation and `AuditLog` row are committed in the same
  PostgreSQL transaction.
- Confirmation expires after 60 seconds without changing ownership.

## Social Result

Successful gifts create a rich public channel embed showing the sender,
recipient, gifted asset, collection source, and artwork when available. The
sender still receives a private confirmation and the recipient receives a DM
when DMs are open.

## Audit Actions

- `GIFT_POKEMON`
- `GIFT_CARD`
