import { configuredSpawnChannelIds, spawnChanceFromRate } from '../src/services/spawnService';

describe('spawn configuration helpers', () => {
  test('converts percentage spawn rates to probabilities', () => {
    expect(spawnChanceFromRate(5)).toBe(0.05);
    expect(spawnChanceFromRate(100)).toBe(1);
  });

  test('clamps invalid spawn rates', () => {
    expect(spawnChanceFromRate(-5)).toBe(0);
    expect(spawnChanceFromRate(250)).toBe(1);
  });

  test('merges legacy and multi-channel configuration without duplicates', () => {
    expect(configuredSpawnChannelIds({
      spawnChannelIds: ['alpha', 'beta', 'alpha'],
      pokeSpawnsChannelId: 'beta',
    })).toEqual(['alpha', 'beta']);
  });

  test('preserves a legacy single spawn channel during migration', () => {
    expect(configuredSpawnChannelIds({
      spawnChannelIds: [],
      pokeSpawnsChannelId: 'legacy',
    })).toEqual(['legacy']);
  });
});
