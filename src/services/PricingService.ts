import type { BotClient } from '../types/index.js';

export interface PriceData {
  itemId: string;
  name: string;
  gamePrice: number;       // PokéCoins cost for gameplay
  estimatedValueGBP: number;  // Real-world valuation for collection views
  emoji: string;
  description: string;
  category: string;
}

/**
 * Centralised pricing service.
 * All item prices are loaded from Redis and cached globally.
 * No hardcoded prices in UI components.
 *
 * DUAL PRICING MODEL:
 * - gamePrice (PokéCoins): Used for shop purchases, gameplay economy
 * - estimatedValueGBP (£): Collection valuation, Pokédex display, inspection
 */
export class PricingService {
  private client: BotClient;

  // In-memory cache as fallback when Redis is unavailable
  private cache: Map<string, PriceData> = new Map();
  private cacheInitialized = false;

  // Built-in price catalogue
  private static readonly PRICE_CATALOGUE: Record<string, PriceData> = {
    // Poké Balls
    poke_ball:     { itemId: 'poke_ball',     name: 'Poké Ball',     gamePrice: 200, estimatedValueGBP: 2.00, emoji: '🎾', description: 'Basic ball for catching Pokémon.', category: 'balls' },
    great_ball:    { itemId: 'great_ball',    name: 'Great Ball',    gamePrice: 600, estimatedValueGBP: 6.00, emoji: '🔵', description: 'Better catch rate than Poké Ball.', category: 'balls' },
    ultra_ball:    { itemId: 'ultra_ball',    name: 'Ultra Ball',    gamePrice: 1200, estimatedValueGBP: 12.00, emoji: '⚫', description: 'Excellent catch rate.', category: 'balls' },
    master_ball:   { itemId: 'master_ball',   name: 'Master Ball',   gamePrice: 99999, estimatedValueGBP: 999.99, emoji: '🟣', description: 'Catches any Pokémon without fail.', category: 'balls' },
    // Utility
    repel:         { itemId: 'repel',         name: 'Repel',         gamePrice: 350, estimatedValueGBP: 3.50, emoji: '🧴', description: 'Prevents weak wild Pokémon appearing.', category: 'utility' },
    lure:          { itemId: 'lure',          name: 'Lure',          gamePrice: 500, estimatedValueGBP: 5.00, emoji: '🎣', description: 'Increases spawn rate for 30 min.', category: 'utility' },
    shiny_charm:   { itemId: 'shiny_charm',   name: 'Shiny Charm',   gamePrice: 5000, estimatedValueGBP: 49.99, emoji: '✨', description: 'Increases Shiny encounter rate (3×).', category: 'utility' },
    coin_case:     { itemId: 'coin_case',     name: 'Coin Case',     gamePrice: 500, estimatedValueGBP: 4.99, emoji: '💰', description: 'Slightly increases daily reward.', category: 'utility' },
    amulet_coin:   { itemId: 'amulet_coin',   name: 'Amulet Coin',   gamePrice: 2500, estimatedValueGBP: 24.99, emoji: '🪙', description: 'Doubles coins from career shifts.', category: 'utility' },
    // Exp Candy
    exp_candy_s:   { itemId: 'exp_candy_s',   name: 'Exp. Candy S',  gamePrice: 100, estimatedValueGBP: 1.00, emoji: '🍬', description: 'Gives your Pokémon a little experience.', category: 'candy' },
    exp_candy_m:   { itemId: 'exp_candy_m',   name: 'Exp. Candy M',  gamePrice: 300, estimatedValueGBP: 3.00, emoji: '🍭', description: 'Gives a moderate amount of experience.', category: 'candy' },
    exp_candy_xl:  { itemId: 'exp_candy_xl',  name: 'Exp. Candy XL', gamePrice: 1000, estimatedValueGBP: 10.00, emoji: '🍫', description: 'Gives a large amount of experience.', category: 'candy' },
    // Career Tools
    old_rod:       { itemId: 'old_rod',       name: 'Old Rod',       gamePrice: 150, estimatedValueGBP: 1.50, emoji: '🎣', description: 'Basic fishing rod.', category: 'career' },
    good_rod:      { itemId: 'good_rod',      name: 'Good Rod',      gamePrice: 500, estimatedValueGBP: 5.00, emoji: '🎣', description: 'Better rod, rarer catches.', category: 'career' },
    super_rod:     { itemId: 'super_rod',     name: 'Super Rod',     gamePrice: 1500, estimatedValueGBP: 15.00, emoji: '🎣', description: 'Top-tier fishing rod.', category: 'career' },
    research_kit:  { itemId: 'research_kit',  name: 'Research Kit',  gamePrice: 300, estimatedValueGBP: 3.00, emoji: '🔬', description: 'Improves researcher rewards.', category: 'career' },
    field_scanner: { itemId: 'field_scanner', name: 'Field Scanner', gamePrice: 800, estimatedValueGBP: 8.00, emoji: '📡', description: 'Boosts rare encounter rates.', category: 'career' },
    incubator:     { itemId: 'incubator',     name: 'Incubator',     gamePrice: 400, estimatedValueGBP: 4.00, emoji: '🥚', description: 'Legacy career equipment.', category: 'career' },
    pickaxe:       { itemId: 'pickaxe',       name: 'Pickaxe',       gamePrice: 200, estimatedValueGBP: 2.00, emoji: '⛏️', description: 'Required for mining.', category: 'career' },
    drill:         { itemId: 'drill',         name: 'Drill',         gamePrice: 1000, estimatedValueGBP: 10.00, emoji: '🔩', description: 'Advanced drill, unlocks fossils.', category: 'career' },
    // Career shop items
    iron_pickaxe:  { itemId: 'iron_pickaxe',  name: 'Iron Pickaxe',  gamePrice: 2000, estimatedValueGBP: 20.00, emoji: '⛏️', description: '+evolution stone chance', category: 'career' },
    steel_pickaxe: { itemId: 'steel_pickaxe', name: 'Steel Pickaxe', gamePrice: 8000, estimatedValueGBP: 80.00, emoji: '⛏️', description: '+rare gem chance', category: 'career' },
    diamond_drill: { itemId: 'diamond_drill', name: 'Diamond Drill', gamePrice: 25000, estimatedValueGBP: 250.00, emoji: '⛏️', description: '+guaranteed stone per shift', category: 'career' },
    tracking_kit:  { itemId: 'tracking_kit',  name: 'Tracking Kit',  gamePrice: 1500, estimatedValueGBP: 15.00, emoji: '🧭', description: '+25% reward, +rare encounter chance', category: 'career' },
    ranger_gear:   { itemId: 'ranger_gear',   name: 'Ranger Gear',   gamePrice: 20000, estimatedValueGBP: 200.00, emoji: '🌲', description: '+100% reward, guaranteed rare encounter', category: 'career' },
    pokedex_pro:   { itemId: 'pokedex_pro',   name: 'Pokédex Pro',   gamePrice: 25000, estimatedValueGBP: 250.00, emoji: '📱', description: '+100% XP & bonus coins', category: 'career' },
    data_analyzer: { itemId: 'data_analyzer', name: 'Data Analyzer', gamePrice: 8000, estimatedValueGBP: 80.00, emoji: '📊', description: '+50% XP & rare data chance', category: 'career' },
    gadget_kit:    { itemId: 'gadget_kit',    name: 'Gadget Kit',    gamePrice: 5000, estimatedValueGBP: 50.00, emoji: '🔧', description: '+success rate', category: 'career' },
    hacking_tools: { itemId: 'hacking_tools', name: 'Hacking Tools', gamePrice: 15000, estimatedValueGBP: 150.00, emoji: '💻', description: '+big score chance', category: 'career' },
    master_plan:   { itemId: 'master_plan',   name: 'Master Plan',   gamePrice: 40000, estimatedValueGBP: 400.00, emoji: '📜', description: 'Extreme risk/reward ×2', category: 'career' },
    improved_incubator: { itemId: 'improved_incubator', name: 'Improved Incubator', gamePrice: 5000, estimatedValueGBP: 50.00, emoji: '🥚', description: '+rare egg chance', category: 'career' },
    advanced_incubator: { itemId: 'advanced_incubator', name: 'Advanced Incubator', gamePrice: 15000, estimatedValueGBP: 150.00, emoji: '🥚', description: '+shiny egg chance', category: 'career' },
    perfect_incubator:  { itemId: 'perfect_incubator',  name: 'Perfect Incubator',  gamePrice: 50000, estimatedValueGBP: 500.00, emoji: '🥚', description: '+IV boost on hatched', category: 'career' },
    // Additional items
    oran_berry:    { itemId: 'oran_berry',    name: 'Oran Berry',    gamePrice: 50, estimatedValueGBP: 0.50, emoji: '🍇', description: 'A simple healing berry.', category: 'utility' },
    exp_shard:     { itemId: 'exp_shard',     name: 'EXP Shard',     gamePrice: 500, estimatedValueGBP: 5.00, emoji: '💎', description: 'Experience shard for training.', category: 'utility' },
  };

  constructor(client: BotClient) {
    this.client = client;
  }

  /**
   * Initialise the cache from Redis (or fall back to built-in pricing)
   */
  async init(): Promise<void> {
    if (this.cacheInitialized) return;

    try {
      // Try loading from Redis first
      const keys = Object.keys(PricingService.PRICE_CATALOGUE);
      let loadedFromRedis = false;

      if (this.client.redis?.isReady) {
        const pipeline = this.client.redis.multi();
        for (const itemId of keys) {
          pipeline.get(`item:price:${itemId}`);
        }
        const results = await pipeline.exec();
        if (results) {
          for (let i = 0; i < keys.length; i++) {
            const result = results[i] as [Error | null, string | null];
            if (result && result[1]) {
              try {
                const parsed = JSON.parse(result[1]) as PriceData;
                this.cache.set(keys[i], parsed);
                loadedFromRedis = true;
              } catch {
                this.cache.set(keys[i], PricingService.PRICE_CATALOGUE[keys[i]]);
              }
            } else {
              this.cache.set(keys[i], PricingService.PRICE_CATALOGUE[keys[i]]);
            }
          }
        }
      }

      if (!loadedFromRedis) {
        // Fall back to built-in catalogue
        for (const [id, data] of Object.entries(PricingService.PRICE_CATALOGUE)) {
          this.cache.set(id, data);
        }
      }

      this.cacheInitialized = true;
    } catch (error) {
      this.client.logger.warn('PricingService init error, using built-in prices:', error);
      for (const [id, data] of Object.entries(PricingService.PRICE_CATALOGUE)) {
        this.cache.set(id, data);
      }
      this.cacheInitialized = true;
    }
  }

  /**
   * Get price data for an item
   */
  getPrice(itemId: string): PriceData | undefined {
    return this.cache.get(itemId);
  }

  /**
   * Get formatted game price (PokéCoins) string
   */
  getFormattedGamePrice(itemId: string): string {
    const data = this.cache.get(itemId);
    if (!data) return '0 PokéCoins';
    return `${data.gamePrice.toLocaleString()} PokéCoins`;
  }

  /**
   * Get formatted GBP valuation string (for collection views only)
   */
  getFormattedGBP(itemId: string): string {
    const data = this.cache.get(itemId);
    if (!data) return '£0.00';
    return `£${data.estimatedValueGBP.toFixed(2)}`;
  }

  /**
   * Get all items in a category
   */
  getItemsByCategory(category: string): PriceData[] {
    return Array.from(this.cache.values()).filter((item) => item.category === category);
  }

  /**
   * Get all items
   */
  getAllItems(): PriceData[] {
    return Array.from(this.cache.values());
  }

  /**
   * Refresh a single item's price from Redis
   */
  async refreshPrice(itemId: string): Promise<void> {
    try {
      if (this.client.redis?.isReady) {
        const raw = await this.client.redis.get(`item:price:${itemId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as PriceData;
          this.cache.set(itemId, parsed);
          return;
        }
      }
      // Fall back
      const builtIn = PricingService.PRICE_CATALOGUE[itemId];
      if (builtIn) this.cache.set(itemId, builtIn);
    } catch {
      // Keep existing cache
    }
  }

  /**
   * Seed Redis with all prices
   */
  async seedRedis(): Promise<void> {
    if (!this.client.redis?.isReady) return;

    const pipeline = this.client.redis.multi();
    for (const [itemId, data] of Object.entries(PricingService.PRICE_CATALOGUE)) {
      pipeline.set(`item:price:${itemId}`, JSON.stringify(data));
    }
    await pipeline.exec();
    this.client.logger.info('Pricing seeded to Redis');
  }

  /**
   * Format a PokéCoin amount for display
   */
  static formatGamePrice(amount: number): string {
    return `${amount.toLocaleString()} PokéCoins`;
  }

  /**
   * Convert GBP to display string (collection views only)
   */
  static formatGBP(amount: number): string {
    return `£${amount.toFixed(2)}`;
  }

  /**
   * Format PokéCoins for concise display
   */
  static formatCoins(amount: number): string {
    return `💰 ${amount.toLocaleString()} PokéCoins`;
  }
}