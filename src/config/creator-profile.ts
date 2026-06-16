// ── Creator Profile ──────────────────────────────────────────────────────────
// This is the ONLY file that needs to change when rebranding the bot for a
// different creator. Do NOT hardcode creator-specific values anywhere else.

export interface CreatorProfile {
  // Identity
  name: string;
  brand: string;
  displayName: string;
  tagline: string;

  // Visual
  avatarUrl: string;
  bannerUrl: string;
  accentColor: string;

  // Social
  website?: string;
  twitter?: string;
  instagram?: string;
  twitch?: string;
  youtube?: string;
  discord?: string;
  tiktok?: string;

  // Commerce
  shopUrl?: string;
  whatnotProfile?: string;
  whatnotAffiliate?: string;

  // AI Personality (Professor Oak)
  aiPersonality: {
    greeting: string;
    tone: 'friendly' | 'witty' | 'professional' | 'custom';
    customInstructions?: string;
    signature?: string;
  };

  // Review Source
  reviewSource: {
    provider: 'static' | 'whatnot' | 'google' | 'custom';
    data: unknown;
  };

  // Live Status Source
  liveSource: {
    provider: 'static' | 'whatnot';
    whatnotUsername?: string;
    refreshIntervalMs: number;
  };
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: Date;
  source: 'whatnot' | 'google' | 'static';
}

export interface LiveStatus {
  live: boolean;
  platform: 'whatnot' | 'twitch' | 'youtube' | null;
  title: string | null;
  viewers: number;
  startedAt?: Date;
  thumbnailUrl?: string;
}

export interface SocialLinks {
  website?: string;
  twitter?: string;
  instagram?: string;
  twitch?: string;
  youtube?: string;
  discord?: string;
  tiktok?: string;
}

export interface Clip {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  platform: 'tiktok' | 'youtube' | 'twitch';
  duration?: number;
  createdAt: Date;
}

export interface CreatorEvent {
  id: string;
  title: string;
  description?: string;
  type: 'stream' | 'giveaway' | 'break' | 'sale';
  startTime: Date;
  endTime?: Date;
  platform?: string;
  url?: string;
}

// ── Default Profile (GrimRipperCards) ─────────────────────────────────────────

const defaultProfile: CreatorProfile = {
  name: 'GrimRipperCards',
  brand: 'GrimRipper',
  displayName: 'Grim Ripper Cards',
  tagline: 'The ultimate Pokémon card experience — ripped just for you',

  avatarUrl: '',
  bannerUrl: '',
  accentColor: '#8B0000',

  website: 'https://grimrippercards.com',
  twitter: '@GrimRipperCards',
  instagram: '@grimrippercards',
  twitch: 'grimrippercards',
  youtube: '@GrimRipperCards',
  discord: 'https://discord.gg/grimripper',
  tiktok: '@grimrippercards',

  shopUrl: 'https://whatnot.com/user/grimrippercards',
  whatnotProfile: 'grimrippercards',

  aiPersonality: {
    greeting: 'Welcome to Grim Ripper\'s Pokémon Arena!',
    tone: 'witty',
    customInstructions: 'You are Professor Oak working for Grim Ripper Cards. Be enthusiastic about card collecting. Mention Grim Ripper\'s latest stream and inventory.',
    signature: '— Professor Oak, Grim Ripper Cards Ambassador',
  },

  reviewSource: {
    provider: 'static',
    data: [],
  },

  liveSource: {
    provider: 'static',
    whatnotUsername: 'grimrippercards',
    refreshIntervalMs: 60000,
  },
};

export function getCreatorProfile(): CreatorProfile {
  return defaultProfile;
}