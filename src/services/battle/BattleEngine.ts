/**
 * Battle Engine — Season 18 Complete Overhaul
 *
 * Implements a simplified Pokémon-style battle engine with:
 * - Critical hits
 * - Type effectiveness
 * - Status effects (Poison, Burn, Paralysis, Sleep)
 * - Turn-based flow (Attack, Defend, Item, Switch)
 * - Speed resolution
 * - Anti-stall system
 * - Timeout handling
 */

import type { BotClient } from '../../types/index.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StatusEffect = 'poison' | 'burn' | 'paralysis' | 'sleep';
export type ActionType = 'attack' | 'defend' | 'item' | 'switch';
export type BattleStatus = 'pending' | 'active' | 'finished';
export type BattleType = 'unranked' | 'ranked' | 'gym';

export interface BattlePokemon {
  userPokemonId: string;
  pokemonId: number;
  name: string;
  level: number;
  isShiny: boolean;
  nature: string;
  types: string[];
  moves: string[];
  moveData: MoveData[];
  heldItem?: string;
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  statStages: Record<string, number>;
  statusEffect?: StatusEffect;
  statusTurns?: number;
  volatileStatus: string[];
  ability: string;
  // Defend boost for current turn
  defending: boolean;
}

export interface MoveData {
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  power: number;
  accuracy: number;
  pp: number;
  effect?: string;
  effectChance?: number;
  priority?: number;
}

export interface PlayerAction {
  type: ActionType;
  moveIndex?: number;
  switchIndex?: number;
}

export interface BattleState {
  id: string;
  challengerId: string;
  opponentId: string;
  guildId: string;
  type: BattleType;
  status: BattleStatus;
  turn: number;
  currentTurnUserId: string;
  challengerTeam: BattlePokemon[];
  opponentTeam: BattlePokemon[];
  challengerActiveIndex: number;
  opponentActiveIndex: number;
  battleLog: string[];
  messageId?: string;
  channelId: string;
  pendingChallengerAction: PlayerAction | null;
  pendingOpponentAction: PlayerAction | null;
  turnPhase: 'waiting_actions' | 'resolving' | 'finished';
  // Anti-stall tracking
  stallTurns: number;
  // Timestamp tracking for timeout
  lastActionTimestamp: number;
  // Current turn's actions for resolution
  weather: string;
  weatherTurns: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CRIT_BASE_RATE = 0.0625; // ~6.25% — Gen 3+ base
const CRIT_MULTIPLIER = 1.5;
const ANTI_STALL_THRESHOLD = 30; // Turns after which stall damage kicks in
const ANTI_STALL_DAMAGE_PERCENT = 0.05; // 5% max HP per turn after threshold
const MAX_TURNS_STANDARD = 50; // ~5-10 min at 6-12s per turn
const MAX_TURNS_RANKED = 75;

// Status effect damage rates
const POISON_DAMAGE = 1 / 8; // 12.5% max HP
const BURN_DAMAGE = 1 / 16; // 6.25% max HP
const BURN_ATTACK_REDUCTION = 0.5; // 50% attack reduction
const PARALYSIS_SPEED_REDUCTION = 0.5; // 50% speed reduction
const PARALYSIS_FULL_PARALYSIS_CHANCE = 0.25; // 25% chance to lose turn
const SLEEP_WAKE_CHANCE = 0.33; // 33% chance to wake each turn

// ── Type Effectiveness Chart ──────────────────────────────────────────────────

const TYPE_EFFECTIVENESS: Record<string, Record<string, number>> = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

// ── Move Table ────────────────────────────────────────────────────────────────

const MOVE_TABLE: Record<string, Omit<MoveData, 'name'>> = {
  // Normal
  tackle:        { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 35 },
  scratch:       { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 35 },
  pound:         { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 35 },
  growl:         { type: 'normal',   category: 'Status',   power: 0,   accuracy: 100, pp: 40 },
  leer:          { type: 'normal',   category: 'Status',   power: 0,   accuracy: 100, pp: 30 },
  quick_attack:  { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 30, priority: 1 },
  headbutt:      { type: 'normal',   category: 'Physical', power: 70,  accuracy: 100, pp: 15 },
  body_slam:     { type: 'normal',   category: 'Physical', power: 85,  accuracy: 100, pp: 15 },
  swift:         { type: 'normal',   category: 'Special',  power: 60,  accuracy: 100, pp: 20 },
  hyper_beam:    { type: 'normal',   category: 'Special',  power: 150, accuracy: 90,  pp: 5  },
  // Fire
  ember:         { type: 'fire',     category: 'Special',  power: 40,  accuracy: 100, pp: 25 },
  flamethrower:  { type: 'fire',     category: 'Special',  power: 90,  accuracy: 100, pp: 15 },
  fire_blast:    { type: 'fire',     category: 'Special',  power: 110, accuracy: 85,  pp: 5  },
  fire_spin:     { type: 'fire',     category: 'Special',  power: 35,  accuracy: 85,  pp: 15 },
  // Water
  water_gun:     { type: 'water',    category: 'Special',  power: 40,  accuracy: 100, pp: 25 },
  surf:          { type: 'water',    category: 'Special',  power: 90,  accuracy: 100, pp: 15 },
  water_pulse:   { type: 'water',    category: 'Special',  power: 60,  accuracy: 100, pp: 20 },
  // Grass
  vine_whip:     { type: 'grass',    category: 'Physical', power: 45,  accuracy: 100, pp: 25 },
  razor_leaf:    { type: 'grass',    category: 'Physical', power: 55,  accuracy: 95,  pp: 25 },
  solar_beam:    { type: 'grass',    category: 'Special',  power: 120, accuracy: 100, pp: 10 },
  // Electric
  thundershock:  { type: 'electric', category: 'Special',  power: 40,  accuracy: 100, pp: 30 },
  thunderbolt:   { type: 'electric', category: 'Special',  power: 90,  accuracy: 100, pp: 15 },
  thunder:       { type: 'electric', category: 'Special',  power: 110, accuracy: 70,  pp: 10 },
  // Psychic
  psychic:       { type: 'psychic',  category: 'Special',  power: 90,  accuracy: 100, pp: 10 },
  confusion:     { type: 'psychic',  category: 'Special',  power: 50,  accuracy: 100, pp: 25 },
  // Ice
  ice_beam:      { type: 'ice',      category: 'Special',  power: 90,  accuracy: 100, pp: 10 },
  blizzard:      { type: 'ice',      category: 'Special',  power: 110, accuracy: 70,  pp: 5  },
  // Rock / Ground
  earthquake:    { type: 'ground',   category: 'Physical', power: 100, accuracy: 100, pp: 10 },
  rock_slide:    { type: 'rock',     category: 'Physical', power: 75,  accuracy: 90,  pp: 10 },
  // Ghost / Dark
  shadow_ball:   { type: 'ghost',    category: 'Special',  power: 80,  accuracy: 100, pp: 15 },
  bite:          { type: 'dark',     category: 'Physical', power: 60,  accuracy: 100, pp: 25 },
  crunch:        { type: 'dark',     category: 'Physical', power: 80,  accuracy: 100, pp: 15 },
  // Dragon / Steel
  dragon_claw:   { type: 'dragon',   category: 'Physical', power: 80,  accuracy: 100, pp: 15 },
  iron_tail:     { type: 'steel',    category: 'Physical', power: 100, accuracy: 75,  pp: 15 },
  // Fighting / Poison / Flying / Bug / Fairy
  karate_chop:   { type: 'fighting', category: 'Physical', power: 50,  accuracy: 100, pp: 25 },
  cross_chop:    { type: 'fighting', category: 'Physical', power: 100, accuracy: 80,  pp: 5  },
  poison_sting:  { type: 'poison',   category: 'Physical', power: 15,  accuracy: 100, pp: 35 },
  gust:          { type: 'flying',   category: 'Special',  power: 40,  accuracy: 100, pp: 35 },
  wing_attack:   { type: 'flying',   category: 'Physical', power: 60,  accuracy: 100, pp: 35 },
  bug_bite:      { type: 'bug',      category: 'Physical', power: 60,  accuracy: 100, pp: 20 },
  moon_blast:    { type: 'fairy',    category: 'Special',  power: 95,  accuracy: 100, pp: 15 },
};

// ── Helper Functions ──────────────────────────────────────────────────────────

function getMoveData(moveName: string): MoveData {
  const key = moveName.toLowerCase().replace(/[ _-]/g, '_').replace(/^_|_$/g, '');
  const resolved = MOVE_TABLE[key] ?? MOVE_TABLE[moveName.toLowerCase().replace(/ /g, '_')];
  if (resolved) return { name: moveName, ...resolved };
  return { name: moveName, type: 'normal', category: 'Physical', power: 50, accuracy: 100, pp: 20 };
}

function getTypeEffectiveness(moveType: string, defType1: string, defType2?: string): number {
  const chart = TYPE_EFFECTIVENESS[moveType.toLowerCase()] || {};
  let eff = chart[defType1.toLowerCase()] ?? 1;
  if (defType2) eff *= chart[defType2.toLowerCase()] ?? 1;
  return eff;
}

function getEffectivenessText(multiplier: number): string {
  if (multiplier === 0) return '💔 No effect!';
  if (multiplier > 1) return '💥 Super effective!';
  if (multiplier < 1) return '🔽 Not very effective...';
  return '';
}

function checkAccuracy(accuracy: number): boolean {
  if (accuracy >= 100) return true;
  return Math.random() * 100 < accuracy;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Core Engine ───────────────────────────────────────────────────────────────

export class BattleEngine {
  private client: BotClient;

  constructor(client: BotClient) {
    this.client = client;
  }

  /**
   * Calculate the effective speed of a Pokémon considering status effects
   */
  getEffectiveSpeed(pokemon: BattlePokemon): number {
    let speed = pokemon.speed;
    if (pokemon.statusEffect === 'paralysis') {
      speed = Math.floor(speed * PARALYSIS_SPEED_REDUCTION);
    }
    const stage = pokemon.statStages['speed'] ?? 0;
    speed = this.applyStatStage(speed, stage);
    return Math.max(1, speed);
  }

  /**
   * Apply stat stage multiplier
   */
  applyStatStage(base: number, stage: number): number {
    const multipliers = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 3 / 2, 2, 3, 4];
    const idx = Math.max(0, Math.min(8, stage + 4));
    return Math.floor(base * multipliers[idx]);
  }

  /**
   * Check if a Pokémon is fully paralyzed
   */
  isFullyParalyzed(pokemon: BattlePokemon): boolean {
    if (pokemon.statusEffect !== 'paralysis') return false;
    return Math.random() < PARALYSIS_FULL_PARALYSIS_CHANCE;
  }

  /**
   * Check if a Pokémon wakes from sleep
   */
  tryWakeUp(pokemon: BattlePokemon): boolean {
    if (pokemon.statusEffect !== 'sleep') return false;
    if (Math.random() < SLEEP_WAKE_CHANCE) {
      pokemon.statusEffect = undefined;
      pokemon.statusTurns = undefined;
      return true;
    }
    return false;
  }

  /**
   * Apply status effect damage at end of turn
   */
  applyStatusDamage(pokemon: BattlePokemon): { damage: number; message: string } {
    if (pokemon.statusEffect === 'poison') {
      const damage = Math.max(1, Math.floor(pokemon.maxHp * POISON_DAMAGE));
      pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
      return { damage, message: `☠️ ${pokemon.name} is hurt by poison! (-${damage} HP)` };
    }
    if (pokemon.statusEffect === 'burn') {
      const damage = Math.max(1, Math.floor(pokemon.maxHp * BURN_DAMAGE));
      pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
      return { damage, message: `🔥 ${pokemon.name} is hurt by its burn! (-${damage} HP)` };
    }
    return { damage: 0, message: '' };
  }

  /**
   * Calculate damage for a move
   */
  calcDamage(
    attacker: BattlePokemon,
    defender: BattlePokemon,
    move: MoveData
  ): { damage: number; effectiveness: number; isCrit: boolean; message: string } {
    if (move.category === 'Status' || !move.power) {
      return { damage: 0, effectiveness: 1, isCrit: false, message: '' };
    }

    const atkStat = move.category === 'Physical' ? attacker.attack : attacker.spAttack;
    let defStat = move.category === 'Physical' ? defender.defense : defender.spDefense;

    // Apply burn attack reduction
    let effectiveAtk = atkStat;
    if (attacker.statusEffect === 'burn' && move.category === 'Physical') {
      effectiveAtk = Math.floor(atkStat * BURN_ATTACK_REDUCTION);
    }

    // Apply stat stages
    const atkStage = move.category === 'Physical'
      ? (attacker.statStages['attack'] ?? 0)
      : (attacker.statStages['spAttack'] ?? 0);
    effectiveAtk = this.applyStatStage(effectiveAtk, atkStage);

    const defStage = move.category === 'Physical'
      ? (defender.statStages['defense'] ?? 0)
      : (defender.statStages['spDefense'] ?? 0);
    defStat = this.applyStatStage(defStat, defStage);

    const levelFactor = (2 * attacker.level) / 5 + 2;
    const baseDmg = Math.floor((levelFactor * move.power * effectiveAtk) / Math.max(1, defStat) / 50) + 2;

    const randomFactor = (randomInt(85, 100)) / 100;

    const stab = attacker.types.some(t => t.toLowerCase() === move.type.toLowerCase()) ? 1.5 : 1.0;

    const effectiveness = getTypeEffectiveness(
      move.type,
      defender.types[0] ?? 'normal',
      defender.types[1]
    );

    const isCrit = Math.random() < CRIT_BASE_RATE;
    const critMod = isCrit ? CRIT_MULTIPLIER : 1;

    const defendMod = defender.defending ? 0.5 : 1;

    const weatherMod = 1;

    const damage = Math.max(1, Math.floor(
      baseDmg * randomFactor * stab * effectiveness * critMod * defendMod * weatherMod
    ));

    const parts: string[] = [];
    const effText = getEffectivenessText(effectiveness);
    if (effText) parts.push(effText);
    if (isCrit) parts.push('💥 Critical hit!');
    if (defender.defending) parts.push('🛡️ Defended!');

    const message = parts.length > 0 ? ` (${parts.join(' ')})` : '';

    return { damage, effectiveness, isCrit, message };
  }

  /**
   * Attempt to inflict a status effect from a move
   */
  tryInflictStatus(moveType: string, defender: BattlePokemon): StatusEffect | undefined {
    if (defender.statusEffect) return undefined;

    const type = moveType.toLowerCase();
    const defTypes = defender.types.map(t => t.toLowerCase());

    switch (type) {
      case 'fire':
        if (!defTypes.includes('fire') && Math.random() < 0.10) return 'burn';
        break;
      case 'poison':
        if (!defTypes.includes('poison') && !defTypes.includes('steel') && Math.random() < 0.30) return 'poison';
        break;
      case 'electric':
        if (!defTypes.includes('electric') && Math.random() < 0.10) return 'paralysis';
        break;
    }

    return undefined;
  }

  /**
   * Determine turn order based on speed (and priority)
   */
  determineTurnOrder(
    challengerAction: PlayerAction,
    opponentAction: PlayerAction,
    challengerPokemon: BattlePokemon,
    opponentPokemon: BattlePokemon
  ): { first: 'challenger' | 'opponent'; firstAction: PlayerAction; secondAction: PlayerAction } {
    const challengerMove = challengerAction.type === 'attack' && challengerAction.moveIndex !== undefined
      ? challengerPokemon.moveData[challengerAction.moveIndex] ?? getMoveData(challengerPokemon.moves[challengerAction.moveIndex] ?? 'tackle')
      : null;
    const opponentMove = opponentAction.type === 'attack' && opponentAction.moveIndex !== undefined
      ? opponentPokemon.moveData[opponentAction.moveIndex] ?? getMoveData(opponentPokemon.moves[opponentAction.moveIndex] ?? 'tackle')
      : null;

    const challengerPriority = challengerMove?.priority ?? 0;
    const opponentPriority = opponentMove?.priority ?? 0;

    if (challengerPriority > opponentPriority) {
      return { first: 'challenger', firstAction: challengerAction, secondAction: opponentAction };
    }
    if (opponentPriority > challengerPriority) {
      return { first: 'opponent', firstAction: opponentAction, secondAction: challengerAction };
    }

    const chSpeed = this.getEffectiveSpeed(challengerPokemon);
    const opSpeed = this.getEffectiveSpeed(opponentPokemon);

    if (chSpeed >= opSpeed) {
      return { first: 'challenger', firstAction: challengerAction, secondAction: opponentAction };
    }
    return { first: 'opponent', firstAction: opponentAction, secondAction: challengerAction };
  }

  /**
   * Execute a single action (attack)
   */
  executeAttack(
    attacker: BattlePokemon,
    defender: BattlePokemon,
    moveIndex: number,
    battleLog: string[]
  ): { fainted: boolean } {
    const moveName = attacker.moves[moveIndex] ?? 'tackle';
    const moveInfo = attacker.moveData[moveIndex] ?? getMoveData(moveName);

    if (!checkAccuracy(moveInfo.accuracy)) {
      battleLog.push(`${attacker.name} used **${moveName}**... but it missed!`);
      return { fainted: false };
    }

    const { damage, message } = this.calcDamage(attacker, defender, moveInfo);
    defender.currentHp = Math.max(0, defender.currentHp - damage);

    let logEntry = `${attacker.name} used **${moveName}**!`;
    if (damage > 0) {
      logEntry += ` (${damage} damage${message})`;
    } else {
      logEntry += ` (no damage${message})`;
    }
    battleLog.push(logEntry);

    if (moveInfo.power > 0 && damage > 0) {
      const inflicted = this.tryInflictStatus(moveInfo.type, defender);
      if (inflicted) {
        defender.statusEffect = inflicted;
        defender.statusTurns = 0;
        const statusNames: Record<string, string> = {
          burn: 'burned',
          poison: 'poisoned',
          paralysis: 'paralyzed',
          sleep: 'put to sleep',
        };
        battleLog.push(`⚡ ${defender.name} was ${statusNames[inflicted] ?? inflicted}!`);
      }
    }

    attacker.defending = false;

    return { fainted: defender.currentHp <= 0 };
  }

  /**
   * Execute a defend action
   */
  executeDefend(pokemon: BattlePokemon, battleLog: string[]): void {
    pokemon.defending = true;
    battleLog.push(`🛡️ ${pokemon.name} is defending! Damage halved this turn.`);
  }

  /**
   * Check anti-stall damage
   */
  applyAntiStall(state: BattleState): string[] {
    const messages: string[] = [];
    state.stallTurns++;

    if (state.stallTurns >= ANTI_STALL_THRESHOLD) {
      const damagePercent = ANTI_STALL_DAMAGE_PERCENT * (1 + (state.stallTurns - ANTI_STALL_THRESHOLD) * 0.05);

      for (const pokemon of [...state.challengerTeam, ...state.opponentTeam]) {
        if (pokemon.currentHp > 0) {
          const stallDamage = Math.max(1, Math.floor(pokemon.maxHp * damagePercent));
          pokemon.currentHp = Math.max(0, pokemon.currentHp - stallDamage);
          if (pokemon.currentHp > 0) {
            messages.push(`⚠️ Battle fatigue: ${pokemon.name} takes ${stallDamage} damage!`);
          }
        }
      }
    }

    return messages;
  }

  /**
   * Check victory conditions
   */
  checkVictory(state: BattleState): { winner?: string; finished: boolean } {
    const challengerAlive = state.challengerTeam.some(p => p.currentHp > 0);
    const opponentAlive = state.opponentTeam.some(p => p.currentHp > 0);

    if (!challengerAlive) {
      return { winner: state.opponentId, finished: true };
    }
    if (!opponentAlive) {
      return { winner: state.challengerId, finished: true };
    }

    const maxTurns = state.type === 'ranked' ? MAX_TURNS_RANKED : MAX_TURNS_STANDARD;
    if (state.turn >= maxTurns) {
      const chHpPercent = state.challengerTeam
        .filter(p => p.currentHp > 0)
        .reduce((sum, p) => sum + (p.currentHp / p.maxHp), 0);
      const opHpPercent = state.opponentTeam
        .filter(p => p.currentHp > 0)
        .reduce((sum, p) => sum + (p.currentHp / p.maxHp), 0);

      if (chHpPercent > opHpPercent) {
        return { winner: state.challengerId, finished: true };
      } else if (opHpPercent > chHpPercent) {
        return { winner: state.opponentId, finished: true };
      }
      return { winner: state.challengerId, finished: true };
    }

    return { finished: false };
  }

  /**
   * Handle timeout - auto-forfeit the inactive player
   */
  handleTimeout(state: BattleState): { forfeitedUserId: string; winnerId: string } {
    const forfeitedUserId = state.currentTurnUserId;
    const winnerId = forfeitedUserId === state.challengerId ? state.opponentId : state.challengerId;
    state.battleLog.push(`⏰ <@${forfeitedUserId}> timed out! Battle forfeited.`);
    state.status = 'finished';
    return { forfeitedUserId, winnerId };
  }

  /**
   * Find next alive Pokémon in team
   */
  findNextAlive(team: BattlePokemon[], currentIndex: number): number {
    for (let i = currentIndex + 1; i < team.length; i++) {
      if (team[i].currentHp > 0) return i;
    }
    for (let i = 0; i < currentIndex; i++) {
      if (team[i].currentHp > 0) return i;
    }
    return -1;
  }

  /**
   * Generate opponent AI action
   */
  generateOpponentAction(state: BattleState): PlayerAction {
    const opponentTeam = state.opponentTeam;
    const activePokemon = opponentTeam[state.opponentActiveIndex];

    if (!activePokemon || activePokemon.currentHp <= 0) {
      const nextAlive = this.findNextAlive(opponentTeam, state.opponentActiveIndex);
      if (nextAlive >= 0) {
        return { type: 'switch', switchIndex: nextAlive };
      }
      return { type: 'attack', moveIndex: 0 };
    }

    if (activePokemon.currentHp < activePokemon.maxHp * 0.3 && Math.random() < 0.2) {
      return { type: 'defend' };
    }

    const availableMoves = activePokemon.moves
      .map((_, i) => i)
      .filter(i => activePokemon.moveData[i]?.power > 0);

    if (availableMoves.length === 0) {
      return { type: 'attack', moveIndex: 0 };
    }

    const moveIndex = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    return { type: 'attack', moveIndex };
  }

  /**
   * Create a new battle state
   */
  createBattleState(
    battleId: string,
    challengerId: string,
    opponentId: string,
    guildId: string,
    type: BattleType,
    challengerTeam: BattlePokemon[],
    opponentTeam: BattlePokemon[],
    channelId: string
  ): BattleState {
    const chSpeed = this.getEffectiveSpeed(challengerTeam[0]);
    const opSpeed = this.getEffectiveSpeed(opponentTeam[0]);

    return {
      id: battleId,
      challengerId,
      opponentId,
      guildId,
      type,
      status: 'active',
      turn: 1,
      currentTurnUserId: chSpeed >= opSpeed ? challengerId : opponentId,
      challengerTeam,
      opponentTeam,
      challengerActiveIndex: 0,
      opponentActiveIndex: 0,
      battleLog: ['⚔️ **Battle started!**'],
      channelId,
      pendingChallengerAction: null,
      pendingOpponentAction: null,
      turnPhase: 'waiting_actions',
      stallTurns: 0,
      lastActionTimestamp: Date.now(),
      weather: 'clear',
      weatherTurns: 0,
    };
  }

  /**
   * Resolve a full turn
   */
  resolveTurn(state: BattleState): void {
    const challengerPokemon = state.challengerTeam[state.challengerActiveIndex];
    const opponentPokemon = state.opponentTeam[state.opponentActiveIndex];

    if (!challengerPokemon || !opponentPokemon) return;

    const chAction = state.pendingChallengerAction!;
    const opAction = state.pendingOpponentAction!;

    // Handle switches first
    if (chAction.type === 'switch' && chAction.switchIndex !== undefined) {
      state.challengerActiveIndex = chAction.switchIndex;
      state.battleLog.push(`🔄 ${state.challengerTeam[chAction.switchIndex].name} switched in!`);
    }
    if (opAction.type === 'switch' && opAction.switchIndex !== undefined) {
      state.opponentActiveIndex = opAction.switchIndex;
      state.battleLog.push(`🔄 ${state.opponentTeam[opAction.switchIndex].name} switched in!`);
    }

    const order = this.determineTurnOrder(chAction, opAction, challengerPokemon, opponentPokemon);

    // Execute first action
    this.executePlayerAction(order.firstAction, state, order.first);

    const victory = this.checkVictory(state);
    if (victory.finished) {
      state.status = 'finished';
      state.turnPhase = 'finished';
      return;
    }

    // Execute second action
    this.executePlayerAction(order.secondAction, state, order.first === 'challenger' ? 'opponent' : 'challenger');

    const victory2 = this.checkVictory(state);
    if (victory2.finished) {
      state.status = 'finished';
      state.turnPhase = 'finished';
      return;
    }

    // Apply status damage at end of turn
    this.applyEndOfTurnStatus(state);

    if (state.stallTurns >= ANTI_STALL_THRESHOLD) {
      const stallMessages = this.applyAntiStall(state);
      state.battleLog.push(...stallMessages);
    }

    const victory3 = this.checkVictory(state);
    if (victory3.finished) {
      state.status = 'finished';
      state.turnPhase = 'finished';
      return;
    }

    // Advance turn
    state.turn++;
    state.turnPhase = 'waiting_actions';
    state.pendingChallengerAction = null;
    state.pendingOpponentAction = null;
    state.lastActionTimestamp = Date.now();

    const chSpeed = this.getEffectiveSpeed(challengerPokemon);
    const opSpeed = this.getEffectiveSpeed(opponentPokemon);
    state.currentTurnUserId = chSpeed >= opSpeed ? state.challengerId : state.opponentId;
  }

  /**
   * Execute a single player action
   */
  private executePlayerAction(
    action: PlayerAction,
    state: BattleState,
    actingSide: 'challenger' | 'opponent'
  ): void {
    const isChallenger = actingSide === 'challenger';

    const attackerTeam = isChallenger ? state.challengerTeam : state.opponentTeam;
    const defenderTeam = isChallenger ? state.opponentTeam : state.challengerTeam;
    const attackerIdx = isChallenger ? state.challengerActiveIndex : state.opponentActiveIndex;
    const defenderIdx = isChallenger ? state.opponentActiveIndex : state.challengerActiveIndex;

    const attacker = attackerTeam[attackerIdx];
    const defender = defenderTeam[defenderIdx];

    if (!attacker || !defender) return;

    attacker.defending = false;

    switch (action.type) {
      case 'attack': {
        if (attacker.statusEffect === 'sleep') {
          if (this.tryWakeUp(attacker)) {
            state.battleLog.push(`😴 ${attacker.name} woke up!`);
          } else {
            state.battleLog.push(`😴 ${attacker.name} is fast asleep!`);
            return;
          }
        }

        if (this.isFullyParalyzed(attacker)) {
          state.battleLog.push(`⚡ ${attacker.name} is fully paralyzed! It can't move!`);
          return;
        }

        if (action.moveIndex !== undefined) {
          this.executeAttack(attacker, defender, action.moveIndex, state.battleLog);
        }
        break;
      }
      case 'defend':
        this.executeDefend(attacker, state.battleLog);
        break;
      case 'item':
        state.battleLog.push(`📦 ${attacker.name} reached for an item... (future: Item action)`);
        break;
      case 'switch':
        break;
    }
  }

  /**
   * Apply end-of-turn status effects
   */
  private applyEndOfTurnStatus(state: BattleState): void {
    for (const team of [state.challengerTeam, state.opponentTeam]) {
      for (const pokemon of team) {
        if (pokemon.currentHp <= 0) continue;
        if (pokemon.statusEffect === 'poison' || pokemon.statusEffect === 'burn') {
          const result = this.applyStatusDamage(pokemon);
          if (result.damage > 0) {
            state.battleLog.push(result.message);
          }
        }
      }
    }
  }

  /**
   * Serialize battle state for Redis storage
   */
  serialize(state: BattleState): string {
    return JSON.stringify(state);
  }

  /**
   * Deserialize battle state from Redis
   */
  deserialize(data: string): BattleState | null {
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.id) return parsed as BattleState;
      return null;
    } catch {
      return null;
    }
  }
}