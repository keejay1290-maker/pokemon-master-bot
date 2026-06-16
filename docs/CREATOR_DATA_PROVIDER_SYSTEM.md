# Creator Data Provider System

> Generated: 2026-06-14
> Goal: Swappable data sources for creator profile, reviews, live status, and shop

---

## Core Concept

The `IDataProvider` interface abstracts all creator-related data sources. The bot only knows about `IDataProvider` — never about Whatnot, Google, or static config directly.

---

## Provider Interface (Recap)

```typescript
interface IDataProvider {
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
```

---

## Provider Implementations

### 1. StaticProvider

```typescript
class StaticProvider implements IDataProvider {
  type = 'static' as const;
  name = 'Static';
  
  constructor(private profile: CreatorProfile) {}
  
  async getReviews(count: number): Promise<Review[]> {
    return (this.profile.reviewSource?.data as Review[] ?? []).slice(0, count);
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
  
  async getRecentClips(count: number): Promise<Clip[]> {
    return []; // No dynamic clips from static provider
  }
  
  async getUpcomingEvents(): Promise<CreatorEvent[]> {
    return []; // No events from static provider
  }
}
```

### 2. WhatnotProvider (Needs Research)

```typescript
class WhatnotProvider implements IDataProvider {
  type = 'whatnot' as const;
  name = 'Whatnot';
  
  constructor(private config: { username: string; affiliate?: string }) {}
  
  async isLive(): Promise<LiveStatus> {
    // Research needed:
    // 1. Does Whatnot have a public API? → probably not
    // 2. Can we scrape whatnot.com/{username}?
    // 3. Does Whatnot have an embed/oembed endpoint?
    // 4. Is there a partner API for affiliates?
    
    // Option A: Firecrawl scrape
    // const page = await firecrawl.scrape(`https://www.whatnot.com/user/${this.config.username}`);
    // return { live: page.includes('LIVE'), platform: 'whatnot', ... };
    
    // Option B: Playwright/Puppeteer browser session
    // Option C: Iframe embed check
    
    // For now, return static fallback
    return { live: false, platform: 'whatnot', title: null, viewers: 0 };
  }
  
  // ... other methods follow same pattern
}
```

**Whatnot Research Notes:**
- Whatnot does NOT have a public REST API for user profiles/live status
- Whatnot does NOT provide an oEmbed endpoint for live status
- The only reliable way to check live status is:
  - **Option 1**: Scrape `whatnot.com/user/{username}` (fragile, ToS concerns)
  - **Option 2**: Use Firecrawl with JS rendering to detect live badge
  - **Option 3**: Manually set live status via an admin command `/creator setlive`
- Reviews can be scraped from the Whatnot profile page if public
- Shop URL is known (whatnot.com/user/{username})
- Clips are typically on TikTok/YouTube, not Whatnot
- **Recommendation**: Use StaticProvider as default, WhatnotProvider as an optional enhancement with fallback

### 3. CustomProvider (Future)

```typescript
class CustomProvider implements IDataProvider {
  type = 'custom' as const;
  name = 'Custom';
  
  constructor(private guildId: string, private db: PrismaClient) {}
  
  // Reads from a future CreatorConfig table
  // Per-guild custom profiles
  // Admin web dashboard
  // Fallback to static profile if no guild config
}
```

---

## Provider Selection

```typescript
function getProvider(profile: CreatorProfile, client?: BotClient): IDataProvider {
  switch (profile.liveSource?.provider) {
    case 'whatnot':
      if (profile.whatnotProfile) {
        return new WhatnotProvider({ username: profile.whatnotProfile });
      }
      // Fall through to static
    default:
      return new StaticProvider(profile);
  }
}
```

---

## Data Types

```typescript
interface Review {
  id: string;
  author: string;
  rating: number; // 1-5
  text: string;
  date: Date;
  source: 'whatnot' | 'google' | 'static';
}

interface LiveStatus {
  live: boolean;
  platform: 'whatnot' | 'twitch' | 'youtube' | null;
  title: string | null;
  viewers: number;
  startedAt?: Date;
  thumbnailUrl?: string;
}

interface SocialLinks {
  website?: string;
  twitter?: string;
  instagram?: string;
  twitch?: string;
  youtube?: string;
  discord?: string;
  tiktok?: string;
}

interface Clip {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  platform: 'tiktok' | 'youtube' | 'twitch';
  duration?: number;
  createdAt: Date;
}

interface CreatorEvent {
  id: string;
  title: string;
  description?: string;
  type: 'stream' | 'giveaway' | 'break' | 'sale';
  startTime: Date;
  endTime?: Date;
  platform?: string;
  url?: string;
}
```

---

## Caching Strategy

| Data | TTL | Why |
|------|-----|-----|
| Reviews | 1 hour | Don't change often |
| Live Status | 30 seconds | Must be fresh |
| Social Links | 24 hours | Static |
| Clips | 1 hour | Moderate change rate |
| Shop URL | 24 hours | Static |
| Events | 5 minutes | Time-sensitive |

Cache key prefix: `creator:{field}:{profileName}`

---

## Error Handling

```
Provider Error → Fallback to Static Provider → Return null/empty for that field → Log warning
```

All provider methods must NEVER throw — they catch errors internally and return sensible defaults:
- `getReviews()` → empty array
- `isLive()` → `{ live: false }`
- `getSocials()` → config values (static fallback)
- `getShopUrl()` → from config

---

## GrimRipperCards Profile Example

```typescript
const profile: CreatorProfile = {
  name: 'GrimRipperCards',
  brand: 'GrimRipper',
  displayName: 'Grim Ripper Cards',
  tagline: 'The ultimate Pokémon card experience — ripped just for you',
  avatarUrl: 'https://example.com/grimripper-avatar.png',
  bannerUrl: 'https://example.com/grimripper-banner.png',
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
    greeting: 'Welcome to Grim Ripper's Pokémon Arena!',
    tone: 'witty',
    customInstructions: 'You are Professor Oak working for Grim Ripper Cards. Be enthusiastic about card collecting. Mention Grim Ripper's latest stream and inventory.',
    signature: '— Professor Oak, Grim Ripper Cards Ambassador',
  },
  
  reviewSource: {
    provider: 'whatnot',
    data: [],
  },
  
  liveSource: {
    provider: 'static', // Start static, upgrade to whatnot later
    whatnotUsername: 'grimrippercards',
    refreshIntervalMs: 60000,
  },
};
```

---

## Next Steps

1. Create `src/config/creator-profile.ts` with the profile interface + default export
2. Create `src/providers/creator/IProvider.ts` with interface
3. Create `src/providers/creator/StaticProvider.ts` 
4. Create `src/services/creatorService.ts` to bridge profile ↔ providers ↔ commands
5. Create `src/commands/social/creator.ts` with `/creator` command
6. Test with StaticProvider
7. Research Whatnot API feasibility
8. Build WhatnotProvider if viable