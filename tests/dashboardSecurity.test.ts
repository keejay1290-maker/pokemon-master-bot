import {
  guildSettingsSchema,
  hasManageGuildPermission,
} from '../src/dashboard/routes/api';

describe('Dashboard security', () => {
  test('accepts Manage Server and Administrator permission bits', () => {
    expect(hasManageGuildPermission('32')).toBe(true);
    expect(hasManageGuildPermission('8')).toBe(true);
    expect(hasManageGuildPermission('40')).toBe(true);
  });

  test('rejects missing, malformed, and unrelated permission bits', () => {
    expect(hasManageGuildPermission('0')).toBe(false);
    expect(hasManageGuildPermission('16')).toBe(false);
    expect(hasManageGuildPermission('not-a-number')).toBe(false);
  });

  test('accepts a bounded guild settings patch', () => {
    const result = guildSettingsSchema.safeParse({
      dailyReward: 750,
      spawnEnabled: true,
      shinyRate: 0.002,
    });
    expect(result.success).toBe(true);
  });

  test('rejects unknown and out-of-range settings', () => {
    expect(guildSettingsSchema.safeParse({ balance: 999999 }).success).toBe(false);
    expect(guildSettingsSchema.safeParse({ shinyRate: 2 }).success).toBe(false);
    expect(guildSettingsSchema.safeParse({ spawnCooldown: 1 }).success).toBe(false);
    expect(guildSettingsSchema.safeParse({}).success).toBe(false);
  });
});
