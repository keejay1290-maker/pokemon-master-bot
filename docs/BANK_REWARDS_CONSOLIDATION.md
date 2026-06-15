# Bank + Rewards Consolidation Design

> Generated: 2026-06-14
> Target: Reduce command count by 4 (55 → 51)

---

## Overview

Consolidate 6 standalone commands into 2 grouped commands:

| Current (6 files) | Proposed (2 files) | Change |
|-------------------|-------------------|--------|
| `/balance` | `/bank view` | Merge |
| `/deposit` | `/bank deposit` | Merge |
| `/withdraw` | `/bank withdraw` | Merge |
| `/daily` | `/rewards daily` | Merge |
| `/weekly` | `/rewards weekly` | Merge |
| `/monthly` | `/rewards monthly` | Merge |

Total files removed: 6
Total files created: 2
Net change: -4 command registrations

---

## Design: `/bank` Command

```typescript
data: new SlashCommandBuilder()
  .setName('bank')
  .setDescription('Manage your PokéCoin bank account')
  .addSubcommand((sub) =>
    sub.setName('view')
      .setDescription('Check your wallet and bank balance')
      .addUserOption((o) => o.setName('user').setDescription('View another user\'s balance'))
  )
  .addSubcommand((sub) =>
    sub.setName('deposit')
      .setDescription('Deposit PokéCoins into your bank')
      .addStringOption((o) =>
        o.setName('amount')
          .setDescription('Amount to deposit (or "all")')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('withdraw')
      .setDescription('Withdraw PokéCoins from your bank')
      .addStringOption((o) =>
        o.setName('amount')
          .setDescription('Amount to withdraw (or "all")')
          .setRequired(true)
      )
  )
```

### Behavior Preservation
- **`/bank view`**: Identical to current `/balance` — shows wallet, bank, total earned/spent, same embed format
- **`/bank deposit`**: Identical to current `/deposit` — `$transaction` with `INSUFFICIENT_FUNDS` check
- **`/bank withdraw`**: Identical to current `/withdraw` — `$transaction` with `INSUFFICIENT_FUNDS` check

### Code Migration
- Copy `balance.ts` execute handler → bank.ts `handleView`
- Copy `deposit.ts` execute handler → bank.ts `handleDeposit`
- Copy `withdraw.ts` execute handler → bank.ts `handleWithdraw`
- No logic changes — pure relocation

---

## Design: `/rewards` Command

```typescript
data: new SlashCommandBuilder()
  .setName('rewards')
  .setDescription('Claim your daily, weekly, and monthly rewards')
  .addSubcommand((sub) =>
    sub.setName('daily')
      .setDescription('Claim your daily PokéCoin reward')
  )
  .addSubcommand((sub) =>
    sub.setName('weekly')
      .setDescription('Claim your weekly PokéCoin reward')
  )
  .addSubcommand((sub) =>
    sub.setName('monthly')
      .setDescription('Claim your monthly PokéCoin reward')
  )
```

### Behavior Preservation
- **`/rewards daily`**: Same as current `/daily` — streak system, streak bonus, XP gain, achievement trigger, quest progress
- **`/rewards weekly`**: Same as current `/weekly` — weekly streak, reward calc
- **`/rewards monthly`**: Same as current `/monthly` — monthly streak, reward calc

---

## Cooldown Preservation

| Current Key | New Key | Impact |
|-------------|---------|--------|
| `user.lastDaily` | Same field | ✅ Unchanged |
| `user.lastWeekly` | Same field | ✅ Unchanged |
| `user.lastMonthly` | Same field | ✅ Unchanged |
| `user.dailyStreak` | Same field | ✅ Unchanged |
| `user.weeklyStreak` | Same field | ✅ Unchanged |
| `user.monthlyStreak` | Same field | ✅ Unchanged |

All streaks and last-claim timestamps are stored on the `User` model — no schema changes needed.

---

## Deletion Steps (when implementing)

1. Delete: `balance.ts`, `deposit.ts`, `withdraw.ts`, `daily.ts`, `weekly.ts`, `monthly.ts`
2. Create: `bank.ts`, `rewards.ts` in `src/commands/economy/`
3. Run `npm run build` → verify clean
4. Run `npm run deploy:commands` → 4 fewer commands registered
5. Verify command count: 55 → 51

---

## Data Safety

| Item | Safe? | Reason |
|------|-------|--------|
| Wallet balances | ✅ | Stored in User.balance — no change |
| Bank balances | ✅ | Stored in User.bankBalance — no change |
| Daily streaks | ✅ | Stored in User.dailyStreak — preserved |
| Weekly streaks | ✅ | Stored in User.weeklyStreak — preserved |
| Monthly streaks | ✅ | Stored in User.monthlyStreak — preserved |
| Last claim timestamps | ✅ | Stored in User.lastDaily/Weekly/Monthly — preserved |
| Guild custom reward amounts | ✅ | Stored in Guild.dailyReward etc — preserved |

---

## Implementation Complexity

| Aspect | Rating | Notes |
|--------|--------|-------|
| Code changes | Simple (2/10) | Pure copy-paste + subcommand routing |
| Schema changes | None | No Prisma migrations needed |
| Data migration | None | All fields already exist on User model |
| User experience | Neutral | Users learn 2 new commands instead of 6 |
| Build risk | Low | Straightforward TypeScript |
| Deployment risk | Low | Discord API deregisters old, registers new |