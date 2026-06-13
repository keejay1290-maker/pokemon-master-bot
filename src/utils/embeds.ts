import { EmbedBuilder, ColorResolvable } from 'discord.js';

export const Colors = {
  PRIMARY: 0xff0000 as ColorResolvable,
  SUCCESS: 0x00ff00 as ColorResolvable,
  ERROR: 0xff4444 as ColorResolvable,
  WARNING: 0xffaa00 as ColorResolvable,
  INFO: 0x3498db as ColorResolvable,
  SHINY: 0xffd700 as ColorResolvable,
  LEGENDARY: 0xff8c00 as ColorResolvable,
  MYTHICAL: 0xff69b4 as ColorResolvable,
  POKEMON: 0xffcb05 as ColorResolvable,
};

export const TypeColors: Record<string, ColorResolvable> = {
  normal: 0xa8a878,
  fire: 0xf08030,
  water: 0x6890f0,
  electric: 0xf8d030,
  grass: 0x78c850,
  ice: 0x98d8d8,
  fighting: 0xc03028,
  poison: 0xa040a0,
  ground: 0xe0c068,
  flying: 0xa890f0,
  psychic: 0xf85888,
  bug: 0xa8b820,
  rock: 0xb8a038,
  ghost: 0x705898,
  dragon: 0x7038f8,
  dark: 0x705848,
  steel: 0xb8b8d0,
  fairy: 0xee99ac,
};

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.SUCCESS).setTitle(`✅ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.ERROR).setTitle(`❌ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.INFO).setTitle(`ℹ️ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function warningEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.WARNING).setTitle(`⚠️ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function pokemonEmbed(name: string, isShiny = false): EmbedBuilder {
  const color = isShiny ? Colors.SHINY : Colors.POKEMON;
  const title = isShiny ? `✨ Shiny ${name}!` : name;
  return new EmbedBuilder().setColor(color).setTitle(title);
}

export function typeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    normal: '⬜', fire: '🔥', water: '💧', electric: '⚡', grass: '🌿',
    ice: '❄️', fighting: '🥊', poison: '☠️', ground: '🌍', flying: '🌬️',
    psychic: '🔮', bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉',
    dark: '🌑', steel: '⚙️', fairy: '🧚',
  };
  return emojis[type.toLowerCase()] || '❓';
}

export function rarityEmoji(rarity: string): string {
  const emojis: Record<string, string> = {
    Common: '⚪', Uncommon: '🟢', Rare: '🔵', Epic: '🟣',
    Legendary: '🟠', Mythical: '🔴', 'Ultra Beast': '🟡', Paradox: '⭐',
  };
  return emojis[rarity] || '⚪';
}

export function progressBar(current: number, max: number, length = 10): string {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
