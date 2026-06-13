import { calcHp, calcStat, getTypeEffectiveness, levelFromXp, xpToNextLevel } from '../src/utils/pokemon';

describe('Pokemon stat calculations', () => {
  test('calcHp with base 45 at level 50', () => {
    const hp = calcHp(45, 31, 252, 50);
    expect(hp).toBeGreaterThan(100);
    expect(hp).toBeLessThan(200);
  });

  test('calcStat with nature boost', () => {
    const boosted = calcStat(100, 31, 252, 50, 'Adamant', 'attack');
    const neutral = calcStat(100, 31, 252, 50, 'Hardy', 'attack');
    expect(boosted).toBeGreaterThan(neutral);
  });

  test('calcStat with nature reduce', () => {
    const reduced = calcStat(100, 31, 252, 50, 'Adamant', 'spAttack');
    const neutral = calcStat(100, 31, 252, 50, 'Hardy', 'spAttack');
    expect(reduced).toBeLessThan(neutral);
  });

  test('type effectiveness super effective', () => {
    const eff = getTypeEffectiveness('fire', 'grass');
    expect(eff).toBe(2);
  });

  test('type effectiveness not very effective', () => {
    const eff = getTypeEffectiveness('fire', 'water');
    expect(eff).toBe(0.5);
  });

  test('type effectiveness immunity', () => {
    const eff = getTypeEffectiveness('normal', 'ghost');
    expect(eff).toBe(0);
  });

  test('type effectiveness dual type', () => {
    const eff = getTypeEffectiveness('electric', 'water', 'flying');
    expect(eff).toBe(4);
  });

  test('xpToNextLevel grows with level', () => {
    const xp10 = xpToNextLevel(10);
    const xp20 = xpToNextLevel(20);
    expect(xp20).toBeGreaterThan(xp10);
  });

  test('levelFromXp round-trip', () => {
    const level = 15;
    const xp = xpToNextLevel(level);
    const recovered = levelFromXp(xp);
    expect(recovered).toBeLessThanOrEqual(level + 1);
  });
});

describe('Battle type chart', () => {
  test('fire beats grass, ice, bug, steel', () => {
    expect(getTypeEffectiveness('fire', 'grass')).toBe(2);
    expect(getTypeEffectiveness('fire', 'ice')).toBe(2);
    expect(getTypeEffectiveness('fire', 'bug')).toBe(2);
    expect(getTypeEffectiveness('fire', 'steel')).toBe(2);
  });

  test('water beats fire, ground, rock', () => {
    expect(getTypeEffectiveness('water', 'fire')).toBe(2);
    expect(getTypeEffectiveness('water', 'ground')).toBe(2);
    expect(getTypeEffectiveness('water', 'rock')).toBe(2);
  });

  test('electric immune to ground', () => {
    expect(getTypeEffectiveness('electric', 'ground')).toBe(0);
  });

  test('ghost immune to normal', () => {
    expect(getTypeEffectiveness('normal', 'ghost')).toBe(0);
  });

  test('dragon immune to fairy', () => {
    expect(getTypeEffectiveness('dragon', 'fairy')).toBe(0);
  });
});
