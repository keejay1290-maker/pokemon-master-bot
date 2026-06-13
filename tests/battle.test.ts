import { applyStatusDamage, checkFainted, getBattleResultText } from '../src/services/battleService';
import type { BattlePokemon } from '../src/types/index';

function makePokemon(overrides: Partial<BattlePokemon> = {}): BattlePokemon {
  return {
    userPokemonId: 'test-id',
    pokemonId: 1,
    name: 'Bulbasaur',
    level: 50,
    isShiny: false,
    nature: 'Hardy',
    moves: ['tackle', 'growl'],
    maxHp: 150,
    currentHp: 150,
    attack: 100,
    defense: 100,
    spAttack: 100,
    spDefense: 100,
    speed: 100,
    statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    volatileStatus: [],
    ability: 'overgrow',
    ...overrides,
  };
}

describe('Battle engine', () => {
  test('checkFainted returns true at 0 HP', () => {
    const p = makePokemon({ currentHp: 0 });
    expect(checkFainted(p)).toBe(true);
  });

  test('checkFainted returns false at positive HP', () => {
    const p = makePokemon({ currentHp: 1 });
    expect(checkFainted(p)).toBe(false);
  });

  test('applyStatusDamage returns 1/8 HP for poison', () => {
    const p = makePokemon({ statusEffect: 'poison', maxHp: 160, currentHp: 160 });
    const { damage } = applyStatusDamage(p);
    expect(damage).toBe(20);
  });

  test('applyStatusDamage returns 1/16 HP for burn', () => {
    const p = makePokemon({ statusEffect: 'burn', maxHp: 160, currentHp: 160 });
    const { damage } = applyStatusDamage(p);
    expect(damage).toBe(10);
  });

  test('applyStatusDamage returns 0 with no status', () => {
    const p = makePokemon();
    const { damage } = applyStatusDamage(p);
    expect(damage).toBe(0);
  });

  test('applyStatusDamage minimum is 1', () => {
    const p = makePokemon({ statusEffect: 'poison', maxHp: 1, currentHp: 1 });
    const { damage } = applyStatusDamage(p);
    expect(damage).toBeGreaterThanOrEqual(1);
  });

  test('getBattleResultText formats correctly', () => {
    const result = getBattleResultText('Alice', 'Bob', 5);
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
    expect(result).toContain('5');
  });
});
