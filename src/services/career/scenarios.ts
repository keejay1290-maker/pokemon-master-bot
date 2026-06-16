/**
 * Career Scenario Engine — Season 18
 *
 * Defines immersive, button-driven career scenarios for the /work command.
 * Each career has 3 unique scenarios with 2–3 meaningful choices each.
 * Outcomes are resolved via weighted RNG modified by equipment tier and career level.
 */

import { ButtonStyle } from 'discord.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScenarioChoice {
  label: string;
  emoji: string;
  riskLevel: 'safe' | 'moderate' | 'risky' | 'dangerous';
  /** Base success probability (0–1). Modified by equipment tier and career level. */
  successRate: number;
  rewardMin: number;
  rewardMax: number;
  xp: number;
  failXp: number;
  successMessage: string;
  failMessage: string;
  /** Coins lost on failure (0 = no penalty, negative = lose coins). */
  failPenalty: number;
  itemDrop?: { itemId: string; itemName: string; chance: number };
}

export interface CareerScenario {
  id: string;
  title: string;
  description: string;
  emoji: string;
  choices: ScenarioChoice[];
}

export interface CareerConfig {
  name: string;
  emoji: string;
  color: number;
  description: string;
  /** Inventory itemId of the base (tier 1) equipment required to work. */
  baseEquipmentId: string;
  /** Display name for the base equipment. */
  baseEquipmentName: string;
  /** Item IDs for tiers 2, 3, 4 (highest tier last). */
  tierItems: string[];
  /** Equipment tier multipliers for coin rewards. Index = tier (0 = none). */
  tierMultipliers: number[];
  scenarios: CareerScenario[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BUTTON_STYLES: Record<string, ButtonStyle> = {
  safe: ButtonStyle.Success,
  moderate: ButtonStyle.Primary,
  risky: ButtonStyle.Secondary,
  dangerous: ButtonStyle.Danger,
};

export function getButtonStyle(riskLevel: string): ButtonStyle {
  return BUTTON_STYLES[riskLevel] ?? ButtonStyle.Secondary;
}

/** Bonus success rate per equipment tier (tier 1 = index 1). */
const TIER_SUCCESS_BONUS = [0, 0, 0.05, 0.10, 0.15];

/** Coin reward multipliers per equipment tier. */
const TIER_REWARD_MULT = [1.0, 1.0, 1.25, 1.5, 2.0];

/**
 * Resolve a scenario choice outcome.
 * Returns { success, reward, xp, message, itemDrop? }
 */
export function resolveOutcome(
  choice: ScenarioChoice,
  equipTier: number,
  careerLevel: number,
): {
  success: boolean;
  reward: number;
  xp: number;
  message: string;
  itemDrop?: { itemId: string; itemName: string };
} {
  const tierBonus = TIER_SUCCESS_BONUS[Math.min(equipTier, 4)] ?? 0;
  const levelBonus = Math.min(careerLevel * 0.005, 0.10);
  const finalRate = Math.min(0.95, choice.successRate + tierBonus + levelBonus);
  const success = Math.random() < finalRate;

  const tierMult = TIER_REWARD_MULT[Math.min(equipTier, 4)] ?? 1.0;
  const levelMult = 1.0 + (careerLevel - 1) * 0.05;

  if (success) {
    const base = Math.floor(Math.random() * (choice.rewardMax - choice.rewardMin + 1)) + choice.rewardMin;
    const reward = Math.floor(base * tierMult * levelMult);
    // Roll for item drop
    let itemDrop: { itemId: string; itemName: string } | undefined;
    if (choice.itemDrop && Math.random() < choice.itemDrop.chance) {
      itemDrop = { itemId: choice.itemDrop.itemId, itemName: choice.itemDrop.itemName };
    }
    return {
      success: true,
      reward,
      xp: choice.xp,
      message: choice.successMessage,
      itemDrop,
    };
  }

  const penalty = Math.abs(choice.failPenalty);
  return {
    success: false,
    reward: -penalty,
    xp: choice.failXp,
    message: choice.failMessage,
  };
}

/**
 * Determine a player's equipment tier (0–4) from their inventory.
 * Tier 0 = no equipment at all (blocked).
 */
export async function getEquipmentTier(
  prisma: { userInventory: { findUnique: (args: any) => Promise<any> } },
  userId: string,
  career: CareerConfig,
): Promise<number> {
  // Check from highest tier down
  for (let i = career.tierItems.length; i >= 0; i--) {
    const itemId = i === 0 ? career.baseEquipmentId : career.tierItems[i - 1];
    if (!itemId) continue;
    const inv = await prisma.userInventory.findUnique({
      where: { userId_itemId: { userId, itemId } },
    });
    if (inv && inv.quantity > 0) return i === 0 ? 1 : i + 1;
  }
  return 0;
}

// ── Career Definitions ────────────────────────────────────────────────────────

export const CAREERS: Record<string, CareerConfig> = {
  Miner: {
    name: 'Miner',
    emoji: '⛏️',
    color: 0x795548,
    description: 'Mine for evolution stones, fossils, and gems!',
    baseEquipmentId: 'pickaxe',
    baseEquipmentName: 'Pickaxe',
    tierItems: ['iron_pickaxe', 'steel_pickaxe', 'diamond_drill'],
    tierMultipliers: TIER_REWARD_MULT,
    scenarios: [
      {
        id: 'crystal_cave',
        title: 'Crystal Cave',
        description:
          'You discover a shimmering crystal cave deep underground. Glinting veins of ore line the walls, but the ground rumbles beneath your feet.',
        emoji: '💎',
        choices: [
          {
            label: 'Explore the deep tunnel',
            emoji: '🕳️',
            riskLevel: 'risky',
            successRate: 0.50,
            rewardMin: 800,
            rewardMax: 2000,
            xp: 60,
            failXp: 15,
            failPenalty: 200,
            successMessage:
              'You navigate the treacherous tunnel and find a massive crystal formation! The rare minerals are worth a fortune.',
            failMessage:
              'The tunnel collapses behind you! You barely escape with your life, empty-handed.',
          },
          {
            label: 'Mine the rich ore vein',
            emoji: '⛏️',
            riskLevel: 'moderate',
            successRate: 0.70,
            rewardMin: 400,
            rewardMax: 1000,
            xp: 40,
            failXp: 10,
            failPenalty: 100,
            successMessage:
              'You chip away at the ore vein and extract a beautiful haul of rare minerals!',
            failMessage:
              'Your pickaxe strikes a gas pocket! You cough and stumble back, losing some collected ore.',
          },
          {
            label: 'Collect surface minerals',
            emoji: '🪨',
            riskLevel: 'safe',
            successRate: 0.95,
            rewardMin: 150,
            rewardMax: 350,
            xp: 20,
            failXp: 5,
            failPenalty: 0,
            successMessage:
              'You carefully gather minerals from the surface. Nothing fancy, but it\'s honest work.',
            failMessage:
              'A loose rock bonks you on the head! You collect what you can and head back.',
          },
        ],
      },
      {
        id: 'abandoned_mine',
        title: 'Abandoned Mine',
        description:
          'An old mine sits deserted, its wooden supports creaking in the wind. Strange markings on the walls suggest something valuable — or dangerous — lies within.',
        emoji: '🏚️',
        choices: [
          {
            label: 'Investigate the strange artifact',
            emoji: ' artifact',
            riskLevel: 'risky',
            successRate: 0.45,
            rewardMin: 1000,
            rewardMax: 3000,
            xp: 70,
            failXp: 15,
            failPenalty: 300,
            successMessage:
              'You carefully extract the artifact — it\'s an ancient Mega Stone! Scientists will pay handsomely for this.',
            failMessage:
              'The artifact was booby-trapped! A mechanism triggers and you barely dodge the falling debris.',
            itemDrop: { itemId: 'thunder_stone', itemName: 'Thunder Stone', chance: 0.08 },
          },
          {
            label: 'Salvage old equipment',
            emoji: '🔧',
            riskLevel: 'safe',
            successRate: 0.90,
            rewardMin: 200,
            rewardMax: 500,
            xp: 20,
            failXp: 5,
            failPenalty: 0,
            successMessage:
              'You find usable mining equipment and sell it for a decent profit!',
            failMessage:
              'The equipment crumbles in your hands. At least you found some spare parts.',
          },
          {
            label: 'Descend into the deep shaft',
            emoji: '⬇️',
            riskLevel: 'dangerous',
            successRate: 0.35,
            rewardMin: 2000,
            rewardMax: 5000,
            xp: 100,
            failXp: 20,
            failPenalty: 500,
            successMessage:
              'At the bottom, you discover a hidden Moon Stone vein! This is the find of a lifetime!',
            failMessage:
              'The shaft ladder gives way! You fall and lose your collected gear.',
            itemDrop: { itemId: 'moon_stone', itemName: 'Moon Stone', chance: 0.05 },
          },
        ],
      },
      {
        id: 'fossil_dig',
        title: 'Fossil Dig Site',
        description:
          'A paleontologist\'s dream — a dig site rich with ancient fossils. The ground is full of potential discoveries.',
        emoji: '🦕',
        choices: [
          {
            label: 'Excavate carefully',
            emoji: '🦴',
            riskLevel: 'moderate',
            successRate: 0.75,
            rewardMin: 300,
            rewardMax: 800,
            xp: 35,
            failXp: 10,
            failPenalty: 50,
            successMessage:
              'Your careful work pays off! You unearth a well-preserved Old Amber fossil.',
            failMessage:
              'You accidentally crack the fossil you were excavating. Better luck next time.',
            itemDrop: { itemId: 'old_amber', itemName: 'Old Amber', chance: 0.10 },
          },
          {
            label: 'Use heavy machinery',
            emoji: '🚜',
            riskLevel: 'risky',
            successRate: 0.55,
            rewardMin: 600,
            rewardMax: 1500,
            xp: 50,
            failXp: 12,
            failPenalty: 200,
            successMessage:
              'The drill breaks through rock quickly, revealing a cache of rare fossils!',
            failMessage:
              'The machinery malfunctions and damages several fossils. The site supervisor is not happy.',
          },
          {
            label: 'Search for rare specimens',
            emoji: '🔍',
            riskLevel: 'dangerous',
            successRate: 0.40,
            rewardMin: 1200,
            rewardMax: 3500,
            xp: 80,
            failXp: 18,
            failPenalty: 400,
            successMessage:
              'You discover a perfectly preserved legendary Pokémon fossil! This belongs in a museum!',
            failMessage:
              'You dig too deep and hit an underground river! Your equipment is swept away.',
          },
        ],
      },
    ],
  },

  Researcher: {
    name: 'Researcher',
    emoji: '🔬',
    color: 0x9b59b6,
    description: 'Conduct research and earn academic grants!',
    baseEquipmentId: 'research_kit',
    baseEquipmentName: 'Research Kit',
    tierItems: ['data_analyzer', 'pokedex_pro'],
    tierMultipliers: TIER_REWARD_MULT,
    scenarios: [
      {
        id: 'ancient_fossil',
        title: 'Ancient Fossil',
        description:
          'A rare fossil has been unearthed in the lab. Your analysis could lead to a groundbreaking discovery.',
        emoji: '🦴',
        choices: [
          {
            label: 'Run extensive analysis',
            emoji: '📊',
            riskLevel: 'safe',
            successRate: 0.90,
            rewardMin: 250,
            rewardMax: 600,
            xp: 25,
            failXp: 8,
            failPenalty: 0,
            successMessage:
              'Your thorough analysis yields solid data. The academic community takes notice.',
            failMessage:
              'The equipment malfunctions mid-analysis. You\'ll need to start over.',
          },
          {
            label: 'Publish preliminary findings',
            emoji: '📄',
            riskLevel: 'moderate',
            successRate: 0.70,
            rewardMin: 500,
            rewardMax: 1200,
            xp: 40,
            failXp: 12,
            failPenalty: 100,
            successMessage:
              'Your paper gets published in a top journal! The grant money rolls in.',
            failMessage:
              'Peers criticize your premature publication. Your reputation takes a small hit.',
          },
          {
            label: 'Attempt gene sequencing',
            emoji: '🧬',
            riskLevel: 'risky',
            successRate: 0.45,
            rewardMin: 1000,
            rewardMax: 3000,
            xp: 70,
            failXp: 15,
            failPenalty: 300,
            successMessage:
              'Breakthrough! You successfully extract ancient DNA! This changes everything!',
            failMessage:
              'The sequencing fails and the sample is contaminated. A costly mistake.',
          },
        ],
      },
      {
        id: 'lab_discovery',
        title: 'Lab Discovery',
        description:
          'An unusual energy signature has been detected in the lab. It could be a new Pokémon phenomenon.',
        emoji: '⚡',
        choices: [
          {
            label: 'Write a detailed report',
            emoji: '📝',
            riskLevel: 'safe',
            successRate: 0.95,
            rewardMin: 200,
            rewardMax: 450,
            xp: 20,
            failXp: 5,
            failPenalty: 0,
            successMessage:
              'Your report is thorough and earns you a small research grant.',
            failMessage:
              'The energy source dissipates before you finish writing. Partial credit at best.',
          },
          {
            label: 'Replicate the experiment',
            emoji: '🧪',
            riskLevel: 'moderate',
            successRate: 0.65,
            rewardMin: 500,
            rewardMax: 1400,
            xp: 45,
            failXp: 12,
            failPenalty: 150,
            successMessage:
              'You successfully replicate the phenomenon! This confirms a new scientific principle!',
            failMessage:
              'The replication fails spectacularly. A small explosion mars the lab.',
          },
          {
            label: 'Seek corporate funding',
            emoji: '💰',
            riskLevel: 'risky',
            successRate: 0.50,
            rewardMin: 800,
            rewardMax: 2500,
            xp: 55,
            failXp: 12,
            failPenalty: 200,
            successMessage:
              'Silph Co. offers a massive research grant! You\'re set for years!',
            failMessage:
              'The corporation steals your research and leaves you with nothing.',
          },
        ],
      },
      {
        id: 'mysterious_signal',
        title: 'Mysterious Signal',
        description:
          'Your instruments detect an anomalous signal from deep space. It pulses with an otherworldly rhythm.',
        emoji: '📡',
        choices: [
          {
            label: 'Analyze the data carefully',
            emoji: '💻',
            riskLevel: 'safe',
            successRate: 0.85,
            rewardMin: 300,
            rewardMax: 700,
            xp: 30,
            failXp: 8,
            failPenalty: 0,
            successMessage:
              'You decode part of the signal — it contains mathematical patterns never seen before!',
            failMessage:
              'The signal fades before you can complete your analysis.',
          },
          {
            label: 'Cross-reference with Pokédex',
            emoji: '📖',
            riskLevel: 'moderate',
            successRate: 0.70,
            rewardMin: 400,
            rewardMax: 1000,
            xp: 35,
            failXp: 10,
            failPenalty: 50,
            successMessage:
              'The signal matches patterns from Mythical Pokémon! Your research earns a grant!',
            failMessage:
              'The data doesn\'t match anything in the Pokédex. Dead end.',
          },
          {
            label: 'Broadcast a response',
            emoji: '📻',
            riskLevel: 'dangerous',
            successRate: 0.30,
            rewardMin: 1500,
            rewardMax: 4000,
            xp: 90,
            failXp: 20,
            failPenalty: 500,
            successMessage:
              'Something responds! You\'ve made first contact with an extraterrestrial intelligence!',
            failMessage:
              'Your broadcast causes electromagnetic interference across the lab. Everything shorts out.',
          },
        ],
      },
    ],
  },

  Ranger: {
    name: 'Ranger',
    emoji: '🌲',
    color: 0x27ae60,
    description: 'Patrol the wild and protect Pokémon!',
    baseEquipmentId: 'tracking_kit',
    baseEquipmentName: 'Tracking Kit',
    tierItems: ['field_scanner', 'ranger_gear'],
    tierMultipliers: TIER_REWARD_MULT,
    scenarios: [
      {
        id: 'rare_tracks',
        title: 'Rare Pokémon Tracks',
        description:
          'You spot unusual tracks in the wild — large, with strange claw marks. Whatever made these is rare.',
        emoji: '🦶',
        choices: [
          {
            label: 'Follow the tracks cautiously',
            emoji: '🚶',
            riskLevel: 'safe',
            successRate: 0.90,
            rewardMin: 200,
            rewardMax: 500,
            xp: 25,
            failXp: 8,
            failPenalty: 0,
            successMessage:
              'You track the Pokémon to its nesting area and document it for Ranger HQ.',
            failMessage:
              'The tracks lead to a dead end. The Pokémon must have flown away.',
          },
          {
            label: 'Set up a hidden camera trap',
            emoji: '📷',
            riskLevel: 'moderate',
            successRate: 0.70,
            rewardMin: 400,
            rewardMax: 1000,
            xp: 40,
            failXp: 10,
            failPenalty: 100,
            successMessage:
              'The camera captures incredible footage of a rare Pokémon! Your report makes headlines!',
            failMessage:
              'A wild Rattata steals the camera. Sometimes the wild wins.',
          },
          {
            label: 'Track through dangerous terrain',
            emoji: '⛰️',
            riskLevel: 'risky',
            successRate: 0.50,
            rewardMin: 700,
            rewardMax: 1800,
            xp: 55,
            failXp: 12,
            failPenalty: 200,
            successMessage:
              'You push through thorns and cliffs to find the Pokémon — it\'s a legendary sighting!',
            failMessage:
              'The terrain is too dangerous. You twist your ankle and have to be rescued.',
          },
        ],
      },
      {
        id: 'lost_trainer',
        title: 'Lost Trainer',
        description:
          'A young trainer has gone missing in the forest. Their worried parents contacted Ranger HQ.',
        emoji: '🧭',
        choices: [
          {
            label: 'Guide them to safety',
            emoji: '🆘',
            riskLevel: 'safe',
            successRate: 0.95,
            rewardMin: 250,
            rewardMax: 500,
            xp: 20,
            failXp: 5,
            failPenalty: 0,
            successMessage:
              'You find the trainer and safely guide them back. They\'re grateful and offer a reward!',
            failMessage:
              'You find them, but they\'ve already wandered further in. At least you left markers.',
          },
          {
            label: 'Search the surrounding area',
            emoji: '🔍',
            riskLevel: 'moderate',
            successRate: 0.65,
            rewardMin: 400,
            rewardMax: 1200,
            xp: 45,
            failXp: 12,
            failPenalty: 100,
            successMessage:
              'You find the trainer AND discover an illegal poacher camp! Double reward!',
            failMessage:
              'You search extensively but can\'t find them. You call for backup.',
          },
          {
            label: 'Rush into the storm',
            emoji: '🌧️',
            riskLevel: 'dangerous',
            successRate: 0.35,
            rewardMin: 1000,
            rewardMax: 3000,
            xp: 80,
            failXp: 18,
            failPenalty: 400,
            successMessage:
              'Braving the storm, you find the trainer sheltering in a cave! Heroic rescue!',
            failMessage:
              'The storm overwhelms you. Search and Rescue has to rescue both of you.',
          },
        ],
      },
      {
        id: 'wild_encounter',
        title: 'Wild Encounter',
        description:
          'A distressed Pokémon blocks the trail, acting aggressively. It seems injured and scared.',
        emoji: '⚔️',
        choices: [
          {
            label: 'Observe from a distance',
            emoji: '🔭',
            riskLevel: 'safe',
            successRate: 0.90,
            rewardMin: 150,
            rewardMax: 400,
            xp: 20,
            failXp: 5,
            failPenalty: 0,
            successMessage:
              'You document the encounter and report it. Your observation data is valuable.',
            failMessage:
              'The Pokémon runs away before you can get good data.',
          },
          {
            label: 'Attempt to calm the Pokémon',
            emoji: '🤝',
            riskLevel: 'moderate',
            successRate: 0.60,
            rewardMin: 500,
            rewardMax: 1300,
            xp: 50,
            failXp: 12,
            failPenalty: 150,
            successMessage:
              'The Pokémon trusts you! You calm it down and safely relocate it. The forest is grateful.',
            failMessage:
              'The Pokémon attacks! You manage to retreat, but it was close.',
          },
          {
            label: 'Engage directly',
            emoji: '⚔️',
            riskLevel: 'risky',
            successRate: 0.45,
            rewardMin: 800,
            rewardMax: 2000,
            xp: 60,
            failXp: 15,
            failPenalty: 300,
            successMessage:
              'You skillfully contain the Pokémon without harm. Your ranger skills shine!',
            failMessage:
              'The Pokémon is too strong! You take a beating before retreating.',
            itemDrop: { itemId: 'pokeball', itemName: 'Poke Ball', chance: 0.10 },
          },
        ],
      },
    ],
  },

  Fisher: {
    name: 'Fisher',
    emoji: '🎣',
    color: 0x3498db,
    description: 'Cast your line and see what bites!',
    baseEquipmentId: 'old_rod',
    baseEquipmentName: 'Fishing Rod',
    tierItems: ['good_rod', 'super_rod', 'master_rod'],
    tierMultipliers: TIER_REWARD_MULT,
    scenarios: [
      {
        id: 'deep_sea',
        title: 'Deep Sea Fishing',
        description:
          'You charter a boat to deep waters. The ocean stretches endlessly, hiding untold treasures below.',
        emoji: '🌊',
        choices: [
          {
            label: 'Cast in calm waters',
            emoji: '🎣',
            riskLevel: 'safe',
            successRate: 0.90,
            rewardMin: 150,
            rewardMax: 400,
            xp: 20,
            failXp: 5,
            failPenalty: 0,
            successMessage:
              'You reel in a nice catch! Nothing record-breaking, but a good day\'s work.',
            failMessage:
              'The fish aren\'t biting today. At least the ocean air was nice.',
          },
          {
            label: 'Troll the deep channel',
            emoji: '⛵',
            riskLevel: 'moderate',
            successRate: 0.65,
            rewardMin: 400,
            rewardMax: 1200,
            xp: 45,
            failXp: 10,
            failPenalty: 100,
            successMessage:
              'Something massive hits your line! You pull up a stunning Gyarados!',
            failMessage:
              'Your line snaps on something huge. Whatever it was, it\'s gone now.',
          },
          {
            label: 'Chase the legendary shadow',
            emoji: '🐉',
            riskLevel: 'risky',
            successRate: 0.40,
            rewardMin: 1000,
            rewardMax: 3000,
            xp: 70,
            failXp: 15,
            failPenalty: 250,
            successMessage:
              'You hook a Lapras! These gentle giants are incredibly rare and valuable!',
            failMessage:
              'The shadow was a submarine. Your gear gets tangled in its wake.',
          },
        ],
      },
      {
        id: 'storm_catch',
        title: 'Storm Catch',
        description:
          'A storm rolls in over the lake. Most fishers pack up, but experienced ones know — rare fish bite in storms.',
        emoji: '⛈️',
        choices: [
          {
            label: 'Wait for the storm to pass',
            emoji: '⏳',
            riskLevel: 'safe',
            successRate: 0.95,
            rewardMin: 100,
            rewardMax: 300,
            xp: 15,
            failXp: 5,
            failPenalty: 0,
            successMessage:
              'After the storm, you catch some fish in the calm aftermath.',
            failMessage:
              'The storm takes forever. By the time it passes, the fish have moved on.',
          },
          {
            label: 'Fish in the rough waters',
            emoji: '🌊',
            riskLevel: 'moderate',
            successRate: 0.60,
            rewardMin: 500,
            rewardMax: 1400,
            xp: 50,
            failXp: 12,
            failPenalty: 150,
            successMessage:
              'A rare Tentacool surfaces in the churning water! Storm fishing pays off!',
            failMessage:
              'A wave knocks you off balance and your rod goes flying into the lake.',
          },
          {
            label: 'Dive into the whirlpool',
            emoji: '🌀',
            riskLevel: 'dangerous',
            successRate: 0.30,
            rewardMin: 1500,
            rewardMax: 4000,
            xp: 90,
            failXp: 20,
            failPenalty: 500,
            successMessage:
              'Inside the whirlpool, you discover an underwater cavern full of rare Pokémon!',
            failMessage:
              'The whirlpool is too strong! You barely make it back to shore, gearless.',
          },
        ],
      },
      {
        id: 'night_fishing',
        title: 'Night Fishing',
        description:
          'The moon hangs low over the water. Night fishing brings out the rarest catches — and the strangest dangers.',
        emoji: '🌙',
        choices: [
          {
            label: 'Fish by moonlight',
            emoji: '🌕',
            riskLevel: 'safe',
            successRate: 0.85,
            rewardMin: 200,
            rewardMax: 500,
            xp: 25,
            failXp: 8,
            failPenalty: 0,
            successMessage:
              'The moonlight attracts a school of rare Goldeen. Easy catch!',
            failMessage:
              'Clouds cover the moon. The fish disappear into the dark water.',
          },
          {
            label: 'Use bioluminescent bait',
            emoji: '✨',
            riskLevel: 'moderate',
            successRate: 0.65,
            rewardMin: 450,
            rewardMax: 1100,
            xp: 40,
            failXp: 10,
            failPenalty: 100,
            successMessage:
              'The glowing bait attracts a beautiful Dratini! What a catch!',
            failMessage:
              'The bait attracts something bigger than expected. Your line is shredded.',
            itemDrop: { itemId: 'pokeball', itemName: 'Poke Ball', chance: 0.08 },
          },
          {
            label: 'Explore the sunken ship',
            emoji: '🚢',
            riskLevel: 'risky',
            successRate: 0.45,
            rewardMin: 800,
            rewardMax: 2200,
            xp: 60,
            failXp: 12,
            failPenalty: 250,
            successMessage:
              'Inside the ship, you find ancient fishing equipment and a treasure chest!',
            failMessage:
              'The ship is unstable! It starts collapsing and you barely escape.',
          },
        ],
      },
    ],
  },

  Rocket: {
    name: 'Rocket',
    emoji: '🚀',
    color: 0xe74c3c,
    description: 'High-risk, high-reward criminal operations!',
    baseEquipmentId: 'gadget_kit',
    baseEquipmentName: 'Rocket Gear',
    tierItems: ['hacking_tools', 'master_plan'],
    tierMultipliers: TIER_REWARD_MULT,
    scenarios: [
      {
        id: 'pokestop_raid',
        title: 'PokéStop Raid',
        description:
          'A poorly guarded PokéStop is loaded with valuable items. Time to strike.',
        emoji: '🎯',
        choices: [
          {
            label: 'Snatch the easy loot',
            emoji: '💰',
            riskLevel: 'safe',
            successRate: 0.90,
            rewardMin: 200,
            rewardMax: 500,
            xp: 20,
            failXp: 5,
            failPenalty: 0,
            successMessage:
              'Quick grab! You pocket some Poké Balls and potions. Easy money.',
            failMessage:
              'A kid catches you rummaging. You run away embarrassed. No reward.',
          },
          {
            label: 'Ambush the delivery truck',
            emoji: '🚛',
            riskLevel: 'moderate',
            successRate: 0.65,
            rewardMin: 500,
            rewardMax: 1500,
            xp: 45,
            failXp: 12,
            failPenalty: 200,
            successMessage:
              'The truck is loaded! You score PokéCoins and rare items from the delivery.',
            failMessage:
              'The driver was an off-duty officer! You barely escape.',
          },
          {
            label: 'Rob the Silph Vault',
            emoji: '🏦',
            riskLevel: 'dangerous',
            successRate: 0.30,
            rewardMin: 2000,
            rewardMax: 5000,
            xp: 100,
            failXp: 20,
            failPenalty: 600,
            successMessage:
              'You infiltrate the vault and steal a prototype Master Ball! The ultimate heist!',
            failMessage:
              'Security was ready for you. You\'re chased through three city blocks.',
          },
        ],
      },
      {
        id: 'cargo_theft',
        title: 'Cargo Theft',
        description:
          'A shipment of rare Pokémon merchandise is being transported through your territory.',
        emoji: '📦',
        choices: [
          {
            label: 'Intercept a small shipment',
            emoji: '🎒',
            riskLevel: 'safe',
            successRate: 0.85,
            rewardMin: 250,
            rewardMax: 600,
            xp: 25,
            failXp: 8,
            failPenalty: 0,
            successMessage:
              'You grab a few boxes off the back. Some rare candies and evolution stones!',
            failMessage:
              'The boxes are empty. It was a decoy shipment.',
          },
          {
            label: 'Hijack the cargo train',
            emoji: '🚂',
            riskLevel: 'moderate',
            successRate: 0.55,
            rewardMin: 600,
            rewardMax: 1800,
            xp: 50,
            failXp: 12,
            failPenalty: 250,
            successMessage:
              'You redirect the cargo to your hideout. The haul is incredible!',
            failMessage:
              'Police were tipped off. You have to abandon the plan mid-heist.',
          },
          {
            label: 'Steal from Team Galactic',
            emoji: '🌟',
            riskLevel: 'risky',
            successRate: 0.40,
            rewardMin: 1000,
            rewardMax: 3500,
            xp: 75,
            failXp: 15,
            failPenalty: 500,
            successMessage:
              'You steal from Team Galactic\'s own shipment! The irony is delicious.',
            failMessage:
              'Team Galactic doesn\'t take theft lightly. Their enforcers find you.',
            itemDrop: { itemId: 'ultra_ball', itemName: 'Ultra Ball', chance: 0.05 },
          },
        ],
      },
      {
        id: 'secret_mission',
        title: 'Secret Mission',
        description:
          'You\'ve been given a secret assignment by the boss. High risk, but the rewards could be legendary.',
        emoji: '🕵️',
        choices: [
          {
            label: 'Gather intel quietly',
            emoji: '📋',
            riskLevel: 'safe',
            successRate: 0.90,
            rewardMin: 200,
            rewardMax: 500,
            xp: 20,
            failXp: 5,
            failPenalty: 0,
            successMessage:
              'Your intelligence report impresses the boss. Here\'s your cut.',
            failMessage:
              'The intel turns out to be useless. At least you weren\'t caught.',
          },
          {
            label: 'Hack the security system',
            emoji: '💻',
            riskLevel: 'moderate',
            successRate: 0.60,
            rewardMin: 600,
            rewardMax: 1600,
            xp: 50,
            failXp: 12,
            failPenalty: 200,
            successMessage:
              'You bypass the security and access restricted data worth a fortune!',
            failMessage:
              'The system traces your hack. You have to abort and wipe your tracks.',
          },
          {
            label: 'Double-cross the boss',
            emoji: '🗡️',
            riskLevel: 'dangerous',
            successRate: 0.25,
            rewardMin: 2500,
            rewardMax: 6000,
            xp: 100,
            failXp: 20,
            failPenalty: 800,
            successMessage:
              'You take everything — the loot, the intel, and disappear into the night!',
            failMessage:
              'The boss was one step ahead. You lose everything and make a powerful enemy.',
          },
        ],
      },
    ],
  },
};

/** Get career choices for slash command options. */
export function getCareerChoices(): { name: string; value: string }[] {
  return Object.values(CAREERS).map((c) => ({
    name: `${c.emoji} ${c.name}`,
    value: c.name,
  }));
}

/** Get all career names as metadata for /career view/leaderboard. */
export const CAREERS_META = Object.values(CAREERS).map((c) => ({
  name: c.name,
  emoji: c.emoji,
  description: c.description,
  cooldownKey: 'career:work',
}));