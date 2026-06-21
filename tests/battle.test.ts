import {
  applyMoveEffect,
  applyStatusDamage,
  calculateBattleRewards,
  calcDamage,
  checkFainted,
  getBattleResultText,
  getEffectiveSpeed,
  getMoveData,
} from '../src/services/battleService';
import type { BattlePokemon, BattleState } from '../src/types/index';

function makePokemon(overrides: Partial<BattlePokemon> = {}): BattlePokemon {
  return {
    userPokemonId: 'test-id',
    pokemonId: 1,
    name: 'Bulbasaur',
    level: 50,
    isShiny: false,
    nature: 'Hardy',
    types: ['grass', 'poison'],
    moves: ['tackle', 'growl'],
    moveData: [
      { name: 'tackle', type: 'normal', category: 'Physical', power: 40, accuracy: 100, pp: 35 },
      { name: 'growl', type: 'normal', category: 'Status', power: 0, accuracy: 100, pp: 40 },
    ],
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

  test('burn halves physical attack damage', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const attacker = makePokemon({ attack: 120 });
    const defender = makePokemon({ defense: 100, types: ['normal'] });
    const move = getMoveData('tackle');

    const normalDamage = calcDamage(attacker, defender, move, 'clear').damage;
    attacker.statusEffect = 'burn';
    const burnedDamage = calcDamage(attacker, defender, move, 'clear').damage;

    expect(burnedDamage).toBeLessThan(normalDamage);
    jest.restoreAllMocks();
  });

  test('type immunity deals zero damage', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const attacker = makePokemon({
      types: ['electric'],
      moves: ['thunderbolt'],
      moveData: [getMoveData('thunderbolt')],
    });
    const groundDefender = makePokemon({ types: ['ground'] });
    const result = calcDamage(attacker, groundDefender, getMoveData('thunderbolt'), 'clear');
    expect(result.effectiveness).toBe(0);
    expect(result.damage).toBe(0);
    jest.restoreAllMocks();
  });

  test('Growl lowers the defender attack stage', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const defender = makePokemon();
    const message = applyMoveEffect(getMoveData('growl'), defender);
    expect(defender.statStages.attack).toBe(-1);
    expect(message).toContain('Attack fell');
    jest.restoreAllMocks();
  });

  test('paralysis halves effective speed', () => {
    const healthy = makePokemon({ speed: 100 });
    const paralyzed = makePokemon({ speed: 100, statusEffect: 'paralysis' });
    expect(getEffectiveSpeed(healthy)).toBe(100);
    expect(getEffectiveSpeed(paralyzed)).toBe(50);
  });

  test('battle rewards favor decisive wins and ranked play', () => {
    const baseState: BattleState = {
      id: 'battle-1',
      challengerId: 'one',
      opponentId: 'two',
      guildId: 'guild',
      type: 'unranked',
      status: 'active',
      turn: 5,
      currentTurnUserId: 'one',
      challengerTeam: [makePokemon()],
      opponentTeam: [makePokemon()],
      challengerActivePokemonIndex: 0,
      opponentActivePokemonIndex: 0,
      weather: 'clear',
      weatherTurns: 0,
      battleLog: [],
      channelId: 'channel',
    };

    const fast = calculateBattleRewards(baseState);
    const slow = calculateBattleRewards({ ...baseState, turn: 25 });
    const ranked = calculateBattleRewards({ ...baseState, type: 'ranked' });
    expect(fast.coinReward).toBeGreaterThan(slow.coinReward);
    expect(ranked.coinReward).toBeGreaterThan(fast.coinReward);
    expect(ranked.rankedGain).toBe(25);
    expect(fast.loserXp).toBeGreaterThan(0);
  });
});
