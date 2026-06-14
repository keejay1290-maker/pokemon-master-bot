# S7 Pack & Economy Review
> Date: 2026-06-14 | Session S7

---

## Pack Entry Points (Post-S7)

| Path | Cost | Who Initiates | Cards Go To |
|------|------|--------------|-------------|
| `/pack [set]` | 500 PokéCoins | User (self) | User who ran cmd |
| `/giftpack user set quantity` | Free (admin) | Admin | Target user |
| `/giveaway create` (prize_type=packs) | Free (admin) | Admin sets up | Winners |

All three paths call the same `openPack(client, setId)` from `pokemonTcgService.ts` and use identical card upsert logic. No duplicate code paths.

---

## /pack Command

- Cost: 500 PokéCoins, deducted before pack opens
- Cooldown: 1 hour (Redis key `cooldown:{userId}:pack`)
- Refund: issued if `openPack()` returns empty (API failure)
- Cards: 10 per pack, weighted by rarity (slots 0–7 = any rarity, slots 8–9 = non-Common/Uncommon)
- `cardsCollected` stat incremented
- Achievement check fires after
- `open_pack` quest progress incremented after ✅ NEW S7

---

## /giftpack Command (NEW S7)

- Location: `src/commands/admin/giftpack.ts`
- Permission: `Administrator` or server owner
- Max quantity: 20 packs per invocation
- Set validation: checked against TCG API before distributing
- Audit log: `AuditLog` entry created with full metadata
- DM notification: sent to recipient (silent fail if DMs closed)
- `cardsCollected` stat incremented for recipient

---

## Giveaway Pack Prizes (NEW S7)

- Set validated at giveaway creation (not just on end)
- Each winner receives cards independently via `openPack()`
- Cards inserted with `upsert` (quantity+1 if already owned)
- Winner DM'd with card count and collection reminder
- Fails silently per-winner if member has left server

---

## Shop Items (Not Yet Implemented)

Items sold in `/shop` are deducted in `/buy` but never stored. No `UserInventory` table exists.

| Item | Effect | Status |
|------|--------|--------|
| Shiny Charm | +shiny rate | Deducted, NOT applied |
| Amulet Coin | 2× work coins | Deducted, NOT applied |
| Exp. Candy S/M/XL | Pokémon XP | Deducted, NOT applied |
| Repel, Lure | Spawn modifier | Deducted, NOT applied |
| Master Ball | 100% catch | Deducted, NOT applied |

**This is the highest-severity remaining gap.** Users pay real coins for items with no effect.

---

## Priority for S8

1. `UserInventory` table (schema migration) + `/buy` persistence
2. Apply Shiny Charm in `spawnService.selectRandomPokemon` — check `userInventory.shinyCharm` before rolling
3. Apply Amulet Coin multiplier in career/work commands
4. `/inventory` command to view owned items
