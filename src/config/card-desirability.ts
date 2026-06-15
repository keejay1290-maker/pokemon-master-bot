// ── Card Desirability Multipliers ─────────────────────────────────────────────
// Pokémon popularity factor (0.5–3.0) used in market value calculations.
// Common Pokemon have 1.0; fan-favorites, starters, and legendaries are higher.

export const DESIRABILITY_MULTIPLIERS: Record<string, number> = {
  // ── God Tier (3.0) ────────────────────────────────────────────────────────
  'Charizard': 3.0,
  'Pikachu': 3.0,
  'Mewtwo': 3.0,
  'Rayquaza': 3.0,
  'Greninja': 3.0,
  'Lucario': 3.0,
  'Umbreon': 3.0,
  'Eevee': 3.0,

  // ── Fan Favorites (2.5) ────────────────────────────────────────────────────
  'Gengar': 2.5,
  'Mew': 2.5,
  'Arceus': 2.5,
  'Lugia': 2.5,
  'Ho-Oh': 2.5,
  'Deoxys': 2.5,
  'Darkrai': 2.5,
  'Mimikyu': 2.5,
  'Dragapult': 2.5,
  'Garchomp': 2.5,
  'Sylveon': 2.5,
  'Vaporeon': 2.5,
  'Jolteon': 2.5,
  'Flareon': 2.5,
  'Leafeon': 2.5,
  'Glaceon': 2.5,
  'Espeon': 2.5,

  // ── Popular (2.0) ──────────────────────────────────────────────────────────
  'Blastoise': 2.0,
  'Venusaur': 2.0,
  'Dragonite': 2.0,
  'Tyranitar': 2.0,
  'Metagross': 2.0,
  'Salamence': 2.0,
  'Gardevoir': 2.0,
  'Infernape': 2.0,
  'Zoroark': 2.0,
  'Hydreigon': 2.0,
  'Aegislash': 2.0,
  'Decidueye': 2.0,
  'Togepi': 2.0,
  'Jirachi': 2.0,
  'Celebi': 2.0,
  'Shaymin': 2.0,
  'Manaphy': 2.0,
  'Victini': 2.0,
  'Diancie': 2.0,
  'Magearna': 2.0,
  'Zeraora': 2.0,
  'Marshadow': 2.0,
  'Zacian': 2.0,
  'Zamazenta': 2.0,
  'Eternatus': 2.0,
  'Koraidon': 2.0,
  'Miraidon': 2.0,

  // ── Above Average (1.5) ────────────────────────────────────────────────────
  'Snorlax': 1.5,
  'Lapras': 1.5,
  'Aerodactyl': 1.5,
  'Kabutops': 1.5,
  'Alakazam': 1.5,
  'Machamp': 1.5,
  'Golem': 1.5,
  'Arcanine': 1.5,
  'Ninetales': 1.5,
  'Gyrados': 1.5,
  'Scyther': 1.5,
  'Scizor': 1.5,
  'Heracross': 1.5,
  'Milotic': 1.5,
  'Flygon': 1.5,
  'Aggron': 1.5,
  'Absol': 1.5,
  'Luxray': 1.5,
  'Staraptor': 1.5,
  'Volcarona': 1.5,
  'Haxorus': 1.5,
  'Chandelure': 1.5,
  'Goodra': 1.5,
  'Noivern': 1.5,
  'Lycanroc': 1.5,
  'Toxapex': 1.5,
  'Corviknight': 1.5,
  'Grimmsnarl': 1.5,
  'Hatterene': 1.5,
  'Coalossal': 1.5,
  'Toxtricity': 1.5,
  'Tinkaton': 1.5,
  'Ceruledge': 1.5,
  'Armarouge': 1.5,
  'Kingambit': 1.5,
  'Annihilape': 1.5,

  // ── Low Interest (0.5) ────────────────────────────────────────────────────
  'Magikarp': 0.5,
  'Wobbuffet': 0.5,
  'Dunsparce': 0.5,
  'Delibird': 0.5,
  'Luvdisc': 0.5,
  'Bidoof': 0.5,
  'Stunfisk': 0.5,
  'Trubbish': 0.5,
  'Comfey': 0.5,
  'Fezandipiti': 0.5,
};

/**
 * Get desirability multiplier for a Pokémon name.
 * Matches by checking if the card name contains any known Pokémon name.
 * Falls back to 1.0 for unknown/multi-word names.
 */
export function getDesirability(cardName: string): number {
  // Check for exact name match first
  const exact = DESIRABILITY_MULTIPLIERS[cardName];
  if (exact !== undefined) return exact;

  // Check if cardName contains a known Pokémon name
  for (const [name, mult] of Object.entries(DESIRABILITY_MULTIPLIERS)) {
    if (cardName.includes(name) || name.includes(cardName)) {
      return mult;
    }
  }

  return 1.0;
}