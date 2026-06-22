# Ranked Battle Stakes and Team Selection

Date: 2026-06-22

## Scope

Ranked battles use only Pokémon captured in the Discord bot and stored as
`UserPokemon`. Pokémon TCG `UserCard` collection entries are never selectable,
locked, transferred, or otherwise involved in battles.

## Player Flow

```text
/battle
→ challenger chooses 1–3 caught Pokémon
→ opponent accepts
→ opponent chooses 1–3 caught Pokémon
→ both teams are shown
→ ranked-risk warning
→ both trainers explicitly confirm
→ battle starts
```

Team selectors show name, level, current HP, type, rarity, and shiny state.
Collections over 25 Pokémon have Previous/Next pagination. Internal ownership
IDs remain hidden inside Discord component values and are revalidated
server-side.

## Ranked Rules

- Ranked team size is 1–3 Pokémon per trainer.
- Favorite, protected, fainted, listed, or non-owned Pokémon cannot enter.
- Both trainers must confirm:
  > Ranked battles are high-stakes. Pokémon used in this battle will transfer
  > to the winner if you lose.
- The losing trainer's complete selected team transfers to the winner.
- Transfer clears team slot, favorite, and protection state.
- Active market listings for stake Pokémon are cancelled during settlement.
- One `OwnershipLedger` row is written per transferred Pokémon.
- Transfers are irreversible once the result transaction commits.

## Reliability

- `BattleParticipantLock.userId` is unique, preventing duplicate simultaneous
  challenges across processes.
- Locks are created in PostgreSQL with the pending battle.
- Team ownership is validated again at battle activation.
- Canonical battle state is persisted to PostgreSQL after actions.
- Expired setup sessions are cancelled and unlocked automatically.
- Expired active battles are recovered after restart and resolved as timeout
  forfeits through the normal result transaction.
- Battle result, ranked Pokémon transfers, ownership ledger, player statistics,
  coin reward ledger, and participant-lock deletion share one transaction.
- `Battle.stakesTransferredAt` and the guarded active-to-finished transition
  prevent duplicate rewards or duplicate transfers.

## Schema

- `BattleParticipantLock`
- `OwnershipLedger`
- `Battle.state`
- confirmation, expiry, and stake-settlement fields on `Battle`
