import type { BotClient, BattleState, BattlePokemon, StatStages, MoveData } from '../types/index.js';
import { calcPokemonStats, getTypeEffectiveness, getEffectivenessText, TYPE_CHART } from '../utils/pokemon.js';
import { PrismaClient } from '@prisma/client';
import { addXp } from './userService.js';

export async function loadBattleTeam(
  prisma: PrismaClient,
  userId: string
): Promise<BattlePokemon[]> {
  const teamPokemon = await prisma.userPokemon.findMany({
    where: { userId, isInTeam: true },
    include: { pokemon: true },
    orderBy: { teamSlot: 'asc' },
    take: 6,
  });

  if (teamPokemon.length === 0) {
    const firstPokemon = await prisma.userPokemon.findFirst({
      where: { userId },
      include: { pokemon: true },
    });
    if (!firstPokemon) return [];
    teamPokemon.push(firstPokemon);
  }

  return teamPokemon.map((up) => {
    const stats = calcPokemonStats(up.pokemon, up);
    return {
      userPokemonId: up.id,
      pokemonId: up.pokemon.id,
      name: up.nickname ?? up.pokemon.nameDisplay,
      level: up.level,
      isShiny: up.isShiny,
      nature: up.nature,
      moves: up.moves.length > 0 ? up.moves : ['tackle', 'growl', 'scratch', 'ember'],
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

  const atk = move.category === 'Physical' ? attacker.attack : attacker.spAttack;
  const def = move.category === 'Physical' ? defender.defense : defender.spDefense;

  const levelFactor = (2 * attacker.level) / 5 + 2;
  const baseDmg = Math.floor((levelFactor * move.power * atk) / def / 50) + 2;

  // Random factor
  const random = (Math.floor(Math.random() * 16) + 85) / 100;

  // STAB (placeholder — attacker type check would need pokemon data)
  const stab = 1.0;

  // Type effectiveness — simplified (single type check)
  const effectiveness = 1.0; // Would need defender's actual type

  // Crit
  const isCrit = Math.random() < 0.0625;
  const critMod = isCrit ? 1.5 : 1;

  // Weather
  let weatherMod = 1;
  if (weather === 'sunny' && move.type === 'fire') weatherMod = 1.5;
  if (weather === 'sunny' && move.type === 'water') weatherMod = 0.5;
  if (weather === 'rainy' && move.type === 'water') weatherMod = 1.5;
  if (weather === 'rainy' && move.type === 'fire') weatherMod = 0.5;
  if (weather === 'sandstorm' && move.type === 'rock') weatherMod = 1.5;

  const damage = Math.max(1, Math.floor(baseDmg * random * stab * effectiveness * critMod * weatherMod));
  return { damage, effectiveness, isCrit };
}

export function applyStatStage(base: number, stage: number): number {
  const multipliers = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 3 / 2, 2, 3, 4];
  const idx = Math.max(0, Math.min(8, stage + 4));
  return Math.floor(base * multipliers[idx]);
}

export function applyStatusDamage(pokemon: BattlePokemon): { damage: number; message: string } {
  if (pokemon.statusEffect === 'poison') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    return { damage, message: `${pokemon.name} is hurt by poison! (-${damage} HP)` };
  }
  if (pokemon.statusEffect === 'burn') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 16));
    return { damage, message: `${pokemon.name} is hurt by its burn! (-${damage} HP)` };
  }
  return { damage: 0, message: '' };
}

export function checkFainted(pokemon: BattlePokemon): boolean {
  return pokemon.currentHp <= 0;
}

export function getBattleResultText(winner: string, loser: string, turns: number): string {
  return `**${winner}** defeated **${loser}** in ${turns} turn${turns !== 1 ? 's' : ''}!`;
}

export async function saveBattleResult(
  client: BotClient,
  state: BattleState,
  winnerId: string
) {
  const loserId = winnerId === state.challengerId ? state.opponentId : state.challengerId;
  const isRanked = state.type === 'ranked';

  await client.prisma.battle.update({
    where: { id: state.id },
    data: {
      status: 'finished',
      winnerId,
      turns: state.turn,
      battleLog: state.battleLog,
      endedAt: new Date(),
    },
  });

  await client.prisma.user.update({
    where: { id: winnerId },
    data: {
      battlesWon: { increment: 1 },
      rankedPoints: isRanked ? { increment: 25 } : undefined,
    },
  });

  await client.prisma.user.update({
    where: { id: loserId },
    data: {
      battlesLost: { increment: 1 },
      rankedPoints: isRanked ? { decrement: 15 } : undefined,
    },
  });

  // Grant trainer XP via addXp so level-up logic fires
  const xpGain = 100 + state.turn * 2;
  await addXp(client.prisma, winnerId, xpGain);
}
