import type { BotClient, BattleState, BattlePokemon, MoveData } from '../types/index.js';
import { calcPokemonStats, getTypeEffectiveness } from '../utils/pokemon.js';
import { PrismaClient, type Prisma } from '@prisma/client';
import { addXp, creditBalanceInTransaction } from './userService.js';
import { checkAndAwardAchievements } from './achievementService.js';
import { incrementQuestProgress } from './questService.js';
import { transferRankedBattleStakes } from './rankedBattleService.js';

// Lookup table for common moves. Battle uses this to get real power + category.
// Unknown moves default to Normal/Physical/50.
export const MOVE_TABLE: Record<string, Omit<MoveData, 'name'>> = {
  tackle:       { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 35 },
  scratch:      { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 35 },
  pound:        { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 35 },
  growl:        { type: 'normal',   category: 'Status',   power: 0,   accuracy: 100, pp: 40, effect: 'attack_down', effectChance: 100 },
  leer:         { type: 'normal',   category: 'Status',   power: 0,   accuracy: 100, pp: 30, effect: 'defense_down', effectChance: 100 },
  tail_whip:    { type: 'normal',   category: 'Status',   power: 0,   accuracy: 100, pp: 30 },
  'tail whip':  { type: 'normal',   category: 'Status',   power: 0,   accuracy: 100, pp: 30, effect: 'defense_down', effectChance: 100 },
  quick_attack: { type: 'normal',   category: 'Physical', power: 40,  accuracy: 100, pp: 30, priority: 1 },
  'quick attack': { type: 'normal', category: 'Physical', power: 40,  accuracy: 100, pp: 30, priority: 1 },
  headbutt:     { type: 'normal',   category: 'Physical', power: 70,  accuracy: 100, pp: 15 },
  'body slam':  { type: 'normal',   category: 'Physical', power: 85,  accuracy: 100, pp: 15 },
  body_slam:    { type: 'normal',   category: 'Physical', power: 85,  accuracy: 100, pp: 15 },
  swift:        { type: 'normal',   category: 'Special',  power: 60,  accuracy: 100, pp: 20 },
  'hyper beam': { type: 'normal',   category: 'Special',  power: 150, accuracy: 90,  pp: 5  },
  hyper_beam:   { type: 'normal',   category: 'Special',  power: 150, accuracy: 90,  pp: 5  },
  // Fire
  ember:        { type: 'fire',     category: 'Special',  power: 40,  accuracy: 100, pp: 25, effect: 'burn', effectChance: 10 },
  flamethrower: { type: 'fire',     category: 'Special',  power: 90,  accuracy: 100, pp: 15, effect: 'burn', effectChance: 10 },
  'fire blast': { type: 'fire',     category: 'Special',  power: 110, accuracy: 85,  pp: 5  },
  fire_blast:   { type: 'fire',     category: 'Special',  power: 110, accuracy: 85,  pp: 5  },
  'fire spin':  { type: 'fire',     category: 'Special',  power: 35,  accuracy: 85,  pp: 15 },
  // Water
  'water gun':  { type: 'water',    category: 'Special',  power: 40,  accuracy: 100, pp: 25 },
  water_gun:    { type: 'water',    category: 'Special',  power: 40,  accuracy: 100, pp: 25 },
  surf:         { type: 'water',    category: 'Special',  power: 90,  accuracy: 100, pp: 15 },
  'water pulse':{ type: 'water',    category: 'Special',  power: 60,  accuracy: 100, pp: 20 },
  // Grass
  'vine whip':  { type: 'grass',    category: 'Physical', power: 45,  accuracy: 100, pp: 25 },
  vine_whip:    { type: 'grass',    category: 'Physical', power: 45,  accuracy: 100, pp: 25 },
  'razor leaf': { type: 'grass',    category: 'Physical', power: 55,  accuracy: 95,  pp: 25 },
  razor_leaf:   { type: 'grass',    category: 'Physical', power: 55,  accuracy: 95,  pp: 25 },
  'solar beam': { type: 'grass',    category: 'Special',  power: 120, accuracy: 100, pp: 10 },
  solar_beam:   { type: 'grass',    category: 'Special',  power: 120, accuracy: 100, pp: 10 },
  // Electric
  'thunder shock': { type: 'electric', category: 'Special', power: 40, accuracy: 100, pp: 30 },
  thundershock: { type: 'electric', category: 'Special',  power: 40,  accuracy: 100, pp: 30 },
  thunderbolt:  { type: 'electric', category: 'Special',  power: 90,  accuracy: 100, pp: 15, effect: 'paralysis', effectChance: 10 },
  thunder:      { type: 'electric', category: 'Special',  power: 110, accuracy: 70,  pp: 10, effect: 'paralysis', effectChance: 30 },
  // Psychic
  psychic:      { type: 'psychic',  category: 'Special',  power: 90,  accuracy: 100, pp: 10 },
  confusion:    { type: 'psychic',  category: 'Special',  power: 50,  accuracy: 100, pp: 25 },
  // Ice
  'ice beam':   { type: 'ice',      category: 'Special',  power: 90,  accuracy: 100, pp: 10, effect: 'freeze', effectChance: 10 },
  ice_beam:     { type: 'ice',      category: 'Special',  power: 90,  accuracy: 100, pp: 10 },
  blizzard:     { type: 'ice',      category: 'Special',  power: 110, accuracy: 70,  pp: 5  },
  // Rock / Ground
  earthquake:   { type: 'ground',   category: 'Physical', power: 100, accuracy: 100, pp: 10 },
  'rock slide': { type: 'rock',     category: 'Physical', power: 75,  accuracy: 90,  pp: 10 },
  rock_slide:   { type: 'rock',     category: 'Physical', power: 75,  accuracy: 90,  pp: 10 },
  // Ghost / Dark
  'shadow ball':{ type: 'ghost',    category: 'Special',  power: 80,  accuracy: 100, pp: 15 },
  shadow_ball:  { type: 'ghost',    category: 'Special',  power: 80,  accuracy: 100, pp: 15 },
  bite:         { type: 'dark',     category: 'Physical', power: 60,  accuracy: 100, pp: 25 },
  crunch:       { type: 'dark',     category: 'Physical', power: 80,  accuracy: 100, pp: 15 },
  // Dragon / Steel
  'dragon claw':{ type: 'dragon',   category: 'Physical', power: 80,  accuracy: 100, pp: 15 },
  dragon_claw:  { type: 'dragon',   category: 'Physical', power: 80,  accuracy: 100, pp: 15 },
  'iron tail':  { type: 'steel',    category: 'Physical', power: 100, accuracy: 75,  pp: 15 },
  iron_tail:    { type: 'steel',    category: 'Physical', power: 100, accuracy: 75,  pp: 15 },
  // Fighting / Poison / Flying / Bug / Fairy
  'karate chop':{ type: 'fighting', category: 'Physical', power: 50,  accuracy: 100, pp: 25 },
  'cross chop': { type: 'fighting', category: 'Physical', power: 100, accuracy: 80,  pp: 5  },
  'poison sting':{ type: 'poison',  category: 'Physical', power: 15,  accuracy: 100, pp: 35, effect: 'poison', effectChance: 30 },
  toxic:        { type: 'poison',   category: 'Status',   power: 0,   accuracy: 90,  pp: 10, effect: 'poison', effectChance: 100 },
  'sleep powder': { type: 'grass',  category: 'Status',   power: 0,   accuracy: 75,  pp: 15, effect: 'sleep', effectChance: 100 },
  'gust':       { type: 'flying',   category: 'Special',  power: 40,  accuracy: 100, pp: 35 },
  'wing attack':{ type: 'flying',   category: 'Physical', power: 60,  accuracy: 100, pp: 35 },
  'bug bite':   { type: 'bug',      category: 'Physical', power: 60,  accuracy: 100, pp: 20 },
  'moon blast': { type: 'fairy',    category: 'Special',  power: 95,  accuracy: 100, pp: 15 },
};

export function getMoveData(moveName: string): MoveData {
  const key = moveName.toLowerCase().replace(/_/g, ' ');
  const entry = MOVE_TABLE[key] ?? MOVE_TABLE[moveName.toLowerCase()];
  if (entry) return { name: moveName, ...entry };
  // Unknown move: treat as Normal Physical 50
  return { name: moveName, type: 'normal', category: 'Physical', power: 50, accuracy: 100, pp: 20 };
}

export async function loadBattleTeam(
  prisma: PrismaClient,
  userId: string,
  selectedOwnershipIds?: string[],
): Promise<BattlePokemon[]> {
  const teamPokemon = await prisma.userPokemon.findMany({
    where: selectedOwnershipIds
      ? { userId, id: { in: selectedOwnershipIds } }
      : { userId, isInTeam: true },
    include: { pokemon: true },
    orderBy: { teamSlot: 'asc' },
    take: 6,
  });

  if (selectedOwnershipIds) {
    const byId = new Map(teamPokemon.map((pokemon) => [pokemon.id, pokemon]));
    const ordered = selectedOwnershipIds
      .map((id) => byId.get(id))
      .filter((pokemon): pokemon is typeof teamPokemon[number] => Boolean(pokemon));
    teamPokemon.splice(0, teamPokemon.length, ...ordered);
  } else if (teamPokemon.length === 0) {
    const firstPokemon = await prisma.userPokemon.findFirst({
      where: { userId },
      include: { pokemon: true },
    });
    if (!firstPokemon) return [];
    teamPokemon.push(firstPokemon);
  }

  // Batch-fetch move data from DB for all Pokémon in the team
  const allPokemonIds = teamPokemon.map((up) => up.pokemon.id);
  const dbMoves = await prisma.pokemonMove.findMany({
    where: { pokemonId: { in: allPokemonIds } },
  });
  // Index by pokemonId → moveName for O(1) lookups
  const dbMoveIndex: Record<string, Record<string, typeof dbMoves[0]>> = {};
  for (const m of dbMoves) {
    if (!dbMoveIndex[m.pokemonId]) dbMoveIndex[m.pokemonId] = {};
    dbMoveIndex[m.pokemonId][m.moveName.toLowerCase()] = m;
  }

  return teamPokemon.map((up) => {
    const stats = calcPokemonStats(up.pokemon, up);
    const types = [up.pokemon.type1, up.pokemon.type2].filter(Boolean) as string[];
    const moveNames = up.moves.length > 0 ? up.moves : ['tackle', 'growl', 'scratch', 'ember'];
    const pokemonMoves = dbMoveIndex[up.pokemon.id] ?? {};

    const moveData: MoveData[] = moveNames.map((name) => {
      const dbEntry = pokemonMoves[name.toLowerCase()];
      if (dbEntry) {
        return {
          name: dbEntry.moveName,
          type: dbEntry.moveType,
          category: dbEntry.category as MoveData['category'],
          power: dbEntry.power ?? 0,
          accuracy: dbEntry.accuracy ?? 100,
          pp: dbEntry.pp,
        };
      }
      // Fall back to static table for default / unknown moves
      return getMoveData(name);
    });

    return {
      userPokemonId: up.id,
      pokemonId: up.pokemon.id,
      name: up.nickname ?? up.pokemon.nameDisplay,
      level: up.level,
      isShiny: up.isShiny,
      nature: up.nature,
      types,
      moves: moveNames,
      moveData,
      heldItem: up.heldItem ?? undefined,
      maxHp: stats.hp,
      currentHp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      spAttack: stats.spAttack,
      spDefense: stats.spDefense,
      speed: stats.speed,
      statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
      volatileStatus: [],
      ability: up.pokemon.ability1,
    };
  });
}

export function calcDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: MoveData,
  weather: string
): { damage: number; effectiveness: number; isCrit: boolean } {
  if (move.category === 'Status' || !move.power) {
    return { damage: 0, effectiveness: 1, isCrit: false };
  }

  const attackStage = move.category === 'Physical'
    ? attacker.statStages.attack
    : attacker.statStages.spAttack;
  const defenseStage = move.category === 'Physical'
    ? defender.statStages.defense
    : defender.statStages.spDefense;
  let atk = applyStatStage(
    move.category === 'Physical' ? attacker.attack : attacker.spAttack,
    attackStage,
  );
  const def = applyStatStage(
    move.category === 'Physical' ? defender.defense : defender.spDefense,
    defenseStage,
  );
  if (move.category === 'Physical' && attacker.statusEffect === 'burn') {
    atk = Math.max(1, Math.floor(atk * 0.5));
  }

  const levelFactor = (2 * attacker.level) / 5 + 2;
  const baseDmg = Math.floor((levelFactor * move.power * atk) / def / 50) + 2;

  // Random factor (85–100%)
  const random = (Math.floor(Math.random() * 16) + 85) / 100;

  // STAB: 1.5x if move type matches one of the attacker's types
  const stab = attacker.types.includes(move.type.toLowerCase()) ? 1.5 : 1.0;

  // Type effectiveness against both of defender's types
  const effectiveness = getTypeEffectiveness(move.type, defender.types[0] ?? 'normal', defender.types[1]);

  // Crit (6.25% chance — Gen 3+ base rate)
  const isCrit = Math.random() < 0.0625;
  const critMod = isCrit ? 1.5 : 1;

  // Weather
  let weatherMod = 1;
  if (weather === 'sunny' && move.type === 'fire') weatherMod = 1.5;
  if (weather === 'sunny' && move.type === 'water') weatherMod = 0.5;
  if (weather === 'rainy' && move.type === 'water') weatherMod = 1.5;
  if (weather === 'rainy' && move.type === 'fire') weatherMod = 0.5;
  if (weather === 'sandstorm' && move.type === 'rock') weatherMod = 1.5;

  const damage = effectiveness === 0
    ? 0
    : Math.max(1, Math.floor(baseDmg * random * stab * effectiveness * critMod * weatherMod));
  return { damage, effectiveness, isCrit };
}

export function applyStatStage(base: number, stage: number): number {
  const bounded = Math.max(-6, Math.min(6, stage));
  const multiplier = bounded >= 0
    ? (2 + bounded) / 2
    : 2 / (2 - bounded);
  return Math.max(1, Math.floor(base * multiplier));
}

export function getEffectiveSpeed(pokemon: BattlePokemon): number {
  const staged = applyStatStage(pokemon.speed, pokemon.statStages.speed);
  return pokemon.statusEffect === 'paralysis'
    ? Math.max(1, Math.floor(staged * 0.5))
    : staged;
}

export function applyStatusDamage(pokemon: BattlePokemon): { damage: number; message: string } {
  if (pokemon.statusEffect === 'poison') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    return { damage, message: `🟣 ${pokemon.name} is hurt by poison! (-${damage} HP)` };
  }
  if (pokemon.statusEffect === 'burn') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 16));
    return { damage, message: `🔥 ${pokemon.name} is hurt by its burn! (-${damage} HP)` };
  }
  return { damage: 0, message: '' };
}

/** Returns whether the move hits, based on its accuracy field. */
export function checkAccuracy(accuracy: number): boolean {
  if (accuracy >= 100) return true;
  return Math.random() * 100 < accuracy;
}

/**
 * Returns { blocked, message, cured } for sleep/freeze/paralysis.
 * Mutates pokemon.statusEffect / statusTurns if status is cured.
 */
export function checkStatusBlock(pokemon: BattlePokemon): { blocked: boolean; message: string; cured: boolean } {
  if (pokemon.statusEffect === 'sleep') {
    // 33% chance to wake each turn
    if (Math.random() < 0.33) {
      pokemon.statusEffect = undefined;
      return { blocked: false, message: `😴 ${pokemon.name} woke up!`, cured: true };
    }
    return { blocked: true, message: `😴 ${pokemon.name} is fast asleep!`, cured: false };
  }
  if (pokemon.statusEffect === 'freeze') {
    // 20% chance to thaw each turn
    if (Math.random() < 0.20) {
      pokemon.statusEffect = undefined;
      return { blocked: false, message: `🧊 ${pokemon.name} thawed out!`, cured: true };
    }
    return { blocked: true, message: `🧊 ${pokemon.name} is frozen solid!`, cured: false };
  }
  if (pokemon.statusEffect === 'paralysis') {
    // 25% fully paralyzed
    if (Math.random() < 0.25) {
      return { blocked: true, message: `⚡ ${pokemon.name} is fully paralyzed! It can't move!`, cured: false };
    }
  }
  return { blocked: false, message: '', cured: false };
}

/** Applies deterministic stat moves and curated secondary effects from MOVE_TABLE. */
export function applyMoveEffect(move: MoveData, defender: BattlePokemon): string | undefined {
  if (!move.effect) return undefined;
  if (Math.random() * 100 >= (move.effectChance ?? 100)) return undefined;

  if (move.effect === 'attack_down') {
    const before = defender.statStages.attack;
    defender.statStages.attack = Math.max(-6, before - 1);
    return before === -6
      ? `${defender.name}'s Attack cannot fall any lower!`
      : `📉 ${defender.name}'s Attack fell!`;
  }
  if (move.effect === 'defense_down') {
    const before = defender.statStages.defense;
    defender.statStages.defense = Math.max(-6, before - 1);
    return before === -6
      ? `${defender.name}'s Defense cannot fall any lower!`
      : `📉 ${defender.name}'s Defense fell!`;
  }
  if (defender.statusEffect) return undefined;

  const defenderTypes = defender.types.map((type) => type.toLowerCase());
  if (move.effect === 'burn' && defenderTypes.includes('fire')) return undefined;
  if (move.effect === 'poison' &&
    (defenderTypes.includes('poison') || defenderTypes.includes('steel'))) return undefined;
  if (move.effect === 'paralysis' && move.type === 'electric' && defenderTypes.includes('ground')) return undefined;
  if (move.effect === 'freeze' && defenderTypes.includes('ice')) return undefined;

  defender.statusEffect = move.effect;
  defender.statusTurns = 0;
  const statusNames: Record<string, string> = {
    burn: 'burned 🔥',
    poison: 'poisoned ☠️',
    paralysis: 'paralyzed ⚡',
    sleep: 'put to sleep 😴',
    freeze: 'frozen 🧊',
  };
  return `⚡ ${defender.name} was ${statusNames[move.effect] ?? move.effect}!`;
}

export function statusLabel(status?: string): string {
  const labels: Record<string, string> = {
    burn: '🔥 BRN',
    poison: '🟣 PSN',
    paralysis: '⚡ PAR',
    sleep: '😴 SLP',
    freeze: '🧊 FRZ',
  };
  return status ? (labels[status] ?? status.toUpperCase()) : '';
}

export function checkFainted(pokemon: BattlePokemon): boolean {
  return pokemon.currentHp <= 0;
}

export function getBattleResultText(winner: string, loser: string, turns: number): string {
  return `**${winner}** defeated **${loser}** in ${turns} turn${turns !== 1 ? 's' : ''}!`;
}

export interface BattleRewards {
  coinReward: number;
  winnerXp: number;
  loserXp: number;
  rankedGain: number;
  rankedLoss: number;
  transferredPokemon: number;
}

export function calculateBattleRewards(state: BattleState): BattleRewards {
  const isRanked = state.type === 'ranked';
  const teamSize = Math.max(state.challengerTeam.length, state.opponentTeam.length);
  const speedBonus = Math.max(0, 20 - state.turn) * 3;
  return {
    coinReward: 75 + teamSize * 25 + speedBonus + (isRanked ? 100 : 0),
    winnerXp: 100 + teamSize * 20 + Math.min(state.turn, 30) * 2,
    loserXp: 25 + teamSize * 10 + Math.min(state.turn, 30),
    rankedGain: isRanked ? 25 : 0,
    rankedLoss: isRanked ? 15 : 0,
    transferredPokemon: 0,
  };
}

function battleTeamJson(team: BattlePokemon[]): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(team)) as Prisma.InputJsonValue;
}

export async function persistBattleState(client: BotClient, state: BattleState): Promise<void> {
  await Promise.all([
    client.prisma.battle.updateMany({
      where: { id: state.id, status: 'active' },
      data: {
        state: JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue,
        challengerTeam: battleTeamJson(state.challengerTeam),
        opponentTeam: battleTeamJson(state.opponentTeam),
        battleLog: state.battleLog,
        turns: state.turn,
      },
    }),
    client.redis?.isReady
      ? client.redis.set(`battle:${state.id}`, JSON.stringify(state), { EX: 1800 }).then(() => undefined)
      : Promise.resolve(),
  ]);
}

export async function saveBattleResult(
  client: BotClient,
  state: BattleState,
  winnerId: string
): Promise<BattleRewards | null> {
  const loserId = winnerId === state.challengerId ? state.opponentId : state.challengerId;
  const rewards = calculateBattleRewards(state);

  const recorded = await client.prisma.$transaction(async (tx) => {
    const losingTeam = loserId === state.challengerId
      ? state.challengerTeam
      : state.opponentTeam;
    let transferredPokemon = 0;

    const finished = await tx.battle.updateMany({
      where: {
        id: state.id,
        status: 'active',
        ...(state.type === 'ranked'
          ? { challengerConfirmed: true, opponentConfirmed: true, stakesTransferredAt: null }
          : {}),
      },
      data: {
        status: 'finished',
        winnerId,
        turns: state.turn,
        challengerTeam: battleTeamJson(state.challengerTeam),
        opponentTeam: battleTeamJson(state.opponentTeam),
        state: JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue,
        battleLog: state.battleLog,
        endedAt: new Date(),
        rankedPointsChange: rewards.rankedGain || null,
      },
    });
    if (finished.count !== 1) return false;

    if (state.type === 'ranked') {
      const transferred = await transferRankedBattleStakes(
        tx,
        state.id,
        loserId,
        winnerId,
        losingTeam,
      );
      transferredPokemon = transferred.length;
      await tx.battle.update({
        where: { id: state.id },
        data: { stakesTransferredAt: new Date() },
      });
    }

    await tx.user.update({
      where: { id: winnerId },
      data: {
        battlesWon: { increment: 1 },
        rankedPoints: rewards.rankedGain ? { increment: rewards.rankedGain } : undefined,
      },
    });
    await tx.user.update({
      where: { id: loserId },
      data: {
        battlesLost: { increment: 1 },
        rankedPoints: rewards.rankedLoss ? { decrement: rewards.rankedLoss } : undefined,
      },
    });
    await creditBalanceInTransaction(tx, winnerId, rewards.coinReward, 'BATTLE_REWARD', {
      battleId: state.id,
      loserId,
      type: state.type,
      turns: state.turn,
    });
    await tx.battleParticipantLock.deleteMany({ where: { battleId: state.id } });
    return transferredPokemon;
  });
  if (recorded === false) return null;
  rewards.transferredPokemon = recorded;

  await Promise.all([
    addXp(client.prisma, winnerId, rewards.winnerXp),
    addXp(client.prisma, loserId, rewards.loserXp),
  ]);

  // Check achievement milestones for the winner (fire-and-forget)
  checkAndAwardAchievements(client, winnerId).catch(() => {});
  // Advance 'battle_win' quests (fire-and-forget)
  incrementQuestProgress(client.prisma, winnerId, 'battle_win', 1).catch(() => {});
  return rewards;
}
