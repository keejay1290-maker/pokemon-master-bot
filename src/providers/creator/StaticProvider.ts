import type { IDataProvider } from './IProvider.js';
import type { CreatorProfile, Review, LiveStatus, SocialLinks, Clip, CreatorEvent } from '../../config/creator-profile.js';

export class StaticProvider implements IDataProvider {
  type = 'static' as const;
  name = 'Static';

  constructor(private profile: CreatorProfile) {}

  async getReviews(count: number): Promise<Review[]> {
    const data = this.profile.reviewSource?.data;
    return (Array.isArray(data) ? data : []) as Review[];
  }

  async isLive(): Promise<LiveStatus> {
    return { live: false, platform: null, title: null, viewers: 0 };
  }

  getShopUrl(): string {
    return this.profile.shopUrl ?? '';
  }

  getSocials(): SocialLinks {
    return {
      website: this.profile.website,
      twitter: this.profile.twitter,
      instagram: this.profile.instagram,
      twitch: this.profile.twitch,
      youtube: this.profile.youtube,
      discord: this.profile.discord,
      tiktok: this.profile.tiktok,
    };
  }

  async getRecentClips(_count: number): Promise<Clip[]> {
    return [];
  }

  async getUpcomingEvents(): Promise<CreatorEvent[]> {
    return [];
  }
}