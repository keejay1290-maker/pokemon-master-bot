import type { BotClient } from '../types/index.js';
import { getCreatorProfile, type CreatorProfile, type LiveStatus, type SocialLinks, type Review } from '../config/creator-profile.js';
import type { IDataProvider } from '../providers/creator/IProvider.js';
import { StaticProvider } from '../providers/creator/StaticProvider.js';

let provider: IDataProvider | null = null;

function getProvider(client: BotClient): IDataProvider {
  if (provider) return provider;
  const profile = getCreatorProfile();

  switch (profile.liveSource?.provider) {
    case 'whatnot':
      // WhatnotProvider not yet implemented — fall through to static
    default:
      provider = new StaticProvider(profile);
      break;
  }
  return provider!;
}

export function getProfile(): CreatorProfile {
  return getCreatorProfile();
}

export async function getLiveStatus(client: BotClient): Promise<LiveStatus> {
  try {
    return await getProvider(client).isLive();
  } catch {
    return { live: false, platform: null, title: null, viewers: 0 };
  }
}

export function getSocials(client: BotClient): SocialLinks {
  try {
    return getProvider(client).getSocials();
  } catch {
    return {};
  }
}

export function getShopUrl(client: BotClient): string {
  try {
    return getProvider(client).getShopUrl();
  } catch {
    return '';
  }
}

export async function getReviews(client: BotClient, count: number): Promise<Review[]> {
  try {
    return await getProvider(client).getReviews(count);
  } catch {
    return [];
  }
}

export function getProviderType(client: BotClient): string {
  try {
    return getProvider(client).type;
  } catch {
    return 'static';
  }
}