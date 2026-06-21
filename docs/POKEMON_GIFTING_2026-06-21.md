# Pokémon Gifting

Date: 2026-06-21

## Command

`/gift pokemon recipient:<user> pokemon:<autocomplete selection>`

The picker combines:

- caught Pokémon shown in `/pokedex` and `/box`;
- Pokémon TCG cards shown in `/collection`.

Users see names, level, IV percentage, rarity, foil state, and quantity. Internal
ownership identifiers are carried only in the autocomplete value and are never
typed or displayed as part of the workflow.

## Safety

- Sender and recipient cannot be the same user.
- Bots cannot receive gifts.
- Ownership is checked before review and again inside the transfer transaction.
- Team members, favorites, and market-listed caught Pokémon cannot be gifted.
- Card gifts transfer exactly one copy and preserve foil state.
- The ownership mutation and `AuditLog` row are committed in the same
  PostgreSQL transaction.
- Confirmation expires after 60 seconds without changing ownership.

## Audit Actions

- `GIFT_POKEMON`
- `GIFT_CARD`
