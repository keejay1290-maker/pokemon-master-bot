# Economy Transaction Safety

Date: 2026-06-21

## Implemented

- Added an `EconomyLedger` model with indexes for sender, recipient, type, and timestamp.
- Shared balance mutations now reject zero, unsafe-integer, negative-transfer, and self-transfer inputs.
- Debits use conditional `updateMany` operations with `balance >= amount`, preventing concurrent overspending.
- Transfers update both users and create the ledger record inside one Prisma transaction.
- Shared credits and debits create ledger records in the same transaction as the balance update.
- `EconomyService` now delegates to the hardened shared functions instead of maintaining a second transaction implementation.

## Validation

- Prisma schema validation: pass
- Prisma client generation: pass
- `npm run typecheck`: pass
- Touched source lint: pass
- `npm test -- --runInBand`: 5 suites, 33 tests pass

## Next Migration Batch

Direct balance writes still exist in rewards, work, robbery, packs, quests, achievements, spawns, and battle rewards. Migrate each path to the shared service with a specific ledger type and contextual metadata.
