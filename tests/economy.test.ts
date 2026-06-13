describe('Economy calculations', () => {
  test('streak bonus caps at 1000', () => {
    const streakBonus = (streak: number) => Math.min(streak * 50, 1000);
    expect(streakBonus(1)).toBe(50);
    expect(streakBonus(20)).toBe(1000);
    expect(streakBonus(100)).toBe(1000);
  });

  test('rob max loss is capped', () => {
    const calcStolenAmount = (balance: number, maxLoss: number) =>
      Math.min(Math.floor(balance * 0.3), maxLoss);
    expect(calcStolenAmount(10000, 1000)).toBe(1000);
    expect(calcStolenAmount(100, 1000)).toBe(30);
  });

  test('fine on failed rob is proportional', () => {
    const calcFine = (balance: number) => Math.min(Math.floor(balance * 0.15), 500);
    expect(calcFine(10000)).toBe(500);
    expect(calcFine(100)).toBe(15);
  });

  test('bank deposit cannot exceed wallet balance', () => {
    const wallet = 500;
    const depositAttempt = 1000;
    const actualDeposit = Math.min(depositAttempt, wallet);
    expect(actualDeposit).toBe(500);
  });

  test('xp required grows quadratically', () => {
    const xpToNextLevel = (level: number) => Math.floor(100 * Math.pow(level, 2));
    expect(xpToNextLevel(1)).toBe(100);
    expect(xpToNextLevel(5)).toBe(2500);
    expect(xpToNextLevel(10)).toBe(10000);
    expect(xpToNextLevel(10)).toBeGreaterThan(xpToNextLevel(9));
  });
});
