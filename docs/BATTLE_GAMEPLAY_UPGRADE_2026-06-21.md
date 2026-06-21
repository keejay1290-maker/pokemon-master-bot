# Battle Gameplay Upgrade

Date: 2026-06-21

## Audit Findings

The live battle command had several high-impact gameplay defects:

- status moves such as Growl, Leer, and Tail Whip dealt zero damage but applied
  no effect;
- burn did not halve physical Attack;
- paralysis did not reduce Speed when choosing the next round leader;
- secondary effects were inferred from every move of a type instead of the
  actual move;
- opponent turns could render both sides with the same trainer name;
- battles had no explicit forfeit control;
- five-minute timeouts cleared Redis but left PostgreSQL battles active;
- rewards were not shown and battle coins bypassed the economy ledger;
- faster wins earned fewer coins than intentionally prolonged battles.

## Shipped Improvements

- Curated move effects for common damaging and status moves.
- Growl lowers Attack; Leer and Tail Whip lower Defense.
- Burn halves physical damage and paralysis halves effective Speed.
- Stat stages now use the canonical -6 through +6 Pokémon multipliers.
- Stable trainer labels on every turn.
- A visible **Forfeit** button.
- Move buttons show type emoji and power or status classification.
- Battle embeds show level, type, HP, status, and remaining team size.
- Timeout and forfeit paths persist a winner, battle log, teams, and end time.
- Result writes are idempotent to prevent duplicate rewards.
- Winner coins use `EconomyLedger` with the `BATTLE_REWARD` type.
- Both trainers receive XP; decisive wins receive a speed bonus.
- End screens display coins, XP, and ranked-point changes.

## Next Highest-Value Work

1. Replace sequential clicks with simultaneous action selection so move
   priority can be resolved accurately.
2. Add manual switching with a select menu and switch priority.
3. Persist each action as a normalized battle turn for restart recovery.
4. Add PvE opponents using scored move selection and switch decisions.
5. Expand move metadata from PokeAPI for recoil, healing, multi-hit moves,
   abilities, and held-item effects.
