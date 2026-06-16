import type { Review, LiveStatus, SocialLinks, Clip, CreatorEvent } from '../../config/creator-profile.js';

export interface IDataProvider {
  /** Human-readable name (e.g., "Whatnot", "Static", "Custom") */
  name: string;

  /** Provider type — used for factory creation */
  type: 'static' | 'whatnot' | 'custom';

  /** Fetch recent reviews */
  getReviews(count: number): Promise<Review[]>;

  /** Is the creator currently live? */
  isLive(): Promise<LiveStatus>;

  /** Get the creator's primary store URL */
  getShopUrl(): string;

  /** Get all configured social media links */
  getSocials(): SocialLinks;

  /** Fetch recent clips or stream highlights */
  getRecentClips(count: number): Promise<Clip[]>;

  /** Get upcoming events (streams, giveaways, breaks) */
  getUpcomingEvents(): Promise<CreatorEvent[]>;
}