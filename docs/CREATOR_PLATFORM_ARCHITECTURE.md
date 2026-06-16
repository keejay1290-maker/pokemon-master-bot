# Creator Platform Architecture

> Generated: 2026-06-14
> Goal: Make the bot sellable as a creator-specific product

---

## Core Principle

**No creator-specific values hardcoded in core systems.**

A single config file (`creator-profile.ts`) should be the ONLY file that needs changes to rebrand the bot for a different creator.

---

## Architecture

```
src/config/creator-profile.ts     ← THE ONLY FILE TO EDIT FOR REBRANDING
src/services/creatorService.ts      ← Reads from profile, provides data to commands
src/providers/                      ← Data provider abstraction layer
  creator/IProvider.ts              ← Interface all providers implement
  creator/StaticProvider.ts         ← File-based config
  creator/WhatnotProvider.ts        ← Whatnot API integration (future)
  creator/CustomProvider.ts         ← DB-driven per-guild (future)
src/commands/social/
  creator.ts                        ← /creator command (profile, info, socials)
```

---

## Creator Profile Schema (`creator-profile.ts`)

```typescript
interface CreatorProfile {
  // Identity
  name: string;                    // "GrimRipperCards"
  brand: string;                   // "GrimRipper"
  displayName: string;             // "Grim Ripper Cards"
  tagline: string;                 // "The ultimate Pokémon card experience"
  
  // Visual
  avatarUrl: string;               // Creator's logo/avatar
  bannerUrl: string;               // Banner image
  accentColor: string;             // Brand hex color
  
  // Social
  website?: string;                // https://grimrippercards.com
  twitter?: string;                // @GrimRipperCards
  instagram?: string;
  twitch?: string;
  youtube?: string;
  discord?: string;                // Discord invite
  tiktok?: string;
  
  // Commerce
  shopUrl?: string;                // Main store
  whatnotProfile?: string;         // Whatnot username
  whatnotAffiliate?: string;       // Optional affiliate ref
  
  // AI Personality (Professor Oak)
  aiPersonality: {
    greeting: string;              // "Welcome to GrimRipper's Pokémon Arena!"
    tone: 'friendly' | 'witty' | 'professional' | 'custom';
    customInstructions?: string;   // Additional system prompt for Professor Oak
    signature?: string;            // End-of-message signature
  };
  
  // Review Source
  reviewSource: {
    provider: 'static' | 'whatnot' | 'google' | 'custom';
    data: unknown;                 // Static reviews array or API config
  };
  
  // Live Status Source
  liveSource: {
    provider: 'static' | 'whatnot';
    whatnotUsername?: string;
    refreshIntervalMs: number;     // How often to poll (default: 60000)
  };
}
```

---

## Provider Interface

```typescript
interface IDataProvider {
  name: string;
  type: 'static' | 'whatnot' | 'custom';
  
  // Reviews
  getReviews(count: number): Promise<Review[]>;
  
  // Live Status
  isLive(): Promise<boolean>;
  
  // Shop
  getShopUrl(): string;
  
  // Social Links
  getSocials(): SocialLinks;
  
  // Clips/Media
  getRecentClips(count: number): Promise<Clip[]>;
}
```

---

## Provider Implementations

### 1. StaticProvider (Default)
- Reads all data from `creator-profile.ts`
- Reviews are a static array in config
- Live status returns `false` always
- Zero external dependencies
- Perfect for initial deployment

### 2. WhatnotProvider (Future)
- Scrapes/API-calls Whatnot for live status
- Fetches recent reviews from Whatnot profile
- Polls at configurable interval
- Requires Firecrawl or Puppeteer for whatnot.com access
- Falls back to static data if Whatnot unreachable

### 3. CustomProvider (Future)
- Stores creator data in a database table
- Per-guild custom creator profiles
- Admin command to switch/configure
- Optional: web dashboard for non-technical creators

---

## Commands

### `/creator` — Creator Profile & Info
```typescript
data: new SlashCommandBuilder()
  .setName('creator')
  .setDescription('View creator info, socials, and shop')
  .addSubcommand((s) => s.setName('info').setDescription('About the creator'))
  .addSubcommand((s) => s.setName('socials').setDescription('Social media links'))
  .addSubcommand((s) => s.setName('shop').setDescription('Visit the creator store'))
  .addSubcommand((s) => s.setName('live').setDescription('Check if creator is live'))
```

### `/reviews` — Creator Reviews
```typescript
data: new SlashCommandBuilder()
  .setName('reviews')
  .setDescription('View recent customer reviews')
  .addIntegerOption((o) => o.setName('count').setDescription('Number of reviews (1-10)'))
```

### `/clips` — Creator Clips (Future)
```typescript
data: new SlashCommandBuilder()
  .setName('clips')
  .setDescription('View recent creator clips/streams')
```

---

## Integration Points

| System | Integration |
|--------|------------|
| Welcome message | Brand name in guild welcome |
| Professor Oak | Personality matches brand voice |
| Shop/packs | Creator-branded packs, special cards |
| Leaderboard | "Creator's Top Trainers" |
| Pack opening | Branded pack art |
| Dashboard | Live creator status, recent reviews |
| /profile | Show creator affiliation on user profiles |

---

## Rebranding Checklist

When a new creator buys the bot:

1. Edit `src/config/creator-profile.ts` (the ONLY file)
2. Replace avatar/banner images
3. Update AI personality instructions
4. Set shop URL
5. Deploy

That's it. Zero code changes.

---

## Whatnot Provider Design (Research Required)

Before building WhatnotProvider:
1. Investigate if Whatnot has a public API
2. If not: research scraping approach (Firecrawl, Playwright)
3. Determine rate limits and legality
4. Design caching layer to avoid excess requests

See `docs/CREATOR_DATA_PROVIDER_SYSTEM.md` for deeper provider research.