import {
  Client,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Collection,
  AutocompleteInteraction,
  PermissionResolvable,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'redis';
import type { Logger } from 'winston';

export interface BotClient extends Client {
  commands: Collection<string, Command>;
  cooldowns: Collection<string, Collection<string, number>>;
  prisma: PrismaClient;
  redis: ReturnType<typeof import('redis').createClient>;
  logger: Logger;
  spawnTimers: Map<string, NodeJS.Timeout>;
  activeSpawns: Map<string, ActiveSpawn>;
  activeBattles: Map<string, BattleState>;
  activeTrades: Map<string, TradeState>;
}

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction, client: BotClient) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction, client: BotClient) => Promise<void>;
  cooldown?: number;
  permissions?: PermissionResolvable[];
  guildOnly?: boolean;
  ownerOnly?: boolean;
}

export interface ActiveSpawn {
  pokemonId: number;
  isShiny: boolean;
  spawnId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  expiresAt: Date;
}

export interface BattleState {
  id: string;
  challengerId: string;
  opponentId: string;
  guildId: string;
  type: 'ranked' | 'unranked' | 'gym';
  status: 'pending' | 'active' | 'finished';
  turn: number;
  currentTurnUserId: string;
  challengerTeam: BattlePokemon[];
  opponentTeam: BattlePokemon[];
  challengerActivePokemonIndex: number;
  opponentActivePokemonIndex: number;
  weather: string;
  weatherTurns: number;
  battleLog: string[];
  messageId?: string;
  channelId: string;
  timeout?: NodeJS.Timeout;
}

export interface BattlePokemon {
  userPokemonId: string;
  pokemonId: number;
  name: string;
  level: number;
  isShiny: boolean;
  nature: string;
  moves: string[];
  heldItem?: string;
  // Calculated stats
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  // In-battle modifiers
  statStages: StatStages;
  statusEffect?: string;
  statusTurns?: number;
  volatileStatus: string[];
  ability: string;
}

export interface StatStages {
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  accuracy: number;
  evasion: number;
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

export interface TradeState {
  id: string;
  initiatorId: string;
  receiverId: string;
  guildId: string;
  initiatorPokemon: string[];
  receiverPokemon: string[];
  initiatorCoins: number;
  receiverCoins: number;
  initiatorConfirmed: boolean;
  receiverConfirmed: boolean;
  messageId?: string;
  channelId: string;
  expiresAt: Date;
}

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

export interface SpawnConfig {
  commonWeight: number;
  rareWeight: number;
  epicWeight: number;
  legendaryWeight: number;
  mythicalWeight: number;
  shinyRate: number;
}

export type PokemonRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythical' | 'Ultra Beast' | 'Paradox';

export type CardRarity =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Rare Holo'
  | 'Rare Ultra'
  | 'Rare Secret'
  | 'Rare Rainbow Alt'
  | 'Amazing Rare'
  | 'LEGEND'
  | 'Illustration Rare'
  | 'Special Illustration Rare'
  | 'Hyper Rare';

export interface JobData {
  name: string;
  description: string;
  minReward: number;
  maxReward: number;
  failureChance: number;
  injuryChance: number;
  rareEncounterChance: number;
  cooldown: number;
  events: JobEvent[];
}

export interface JobEvent {
  chance: number;
  message: string;
  rewardMultiplier: number;
  type: 'bonus' | 'penalty' | 'encounter';
}

export interface WeatherData {
  type: string;
  boostTypes: string[];
  weakenTypes: string[];
  description: string;
}
