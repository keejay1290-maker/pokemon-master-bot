/**
 * Battle damage simulation — before vs after fix.
 * Run: node scripts/battle-sim.js
 */

// ── old formula (what was in battle.ts before the fix) ──────────────────────
function oldDamage(attack, defense) {
  const basePower = 40 + Math.floor(Math.random() * 60); // random 40-100
  return Math.max(1, Math.floor(attack * basePower / (50 * (defense || 1))));
}

// ── new formula (calcDamage from battleService) ──────────────────────────────
function newDamage(level, atk, def, power, stab, effectiveness) {
  const levelFactor = (2 * level) / 5 + 2;
  const baseDmg = Math.floor((levelFactor * power * atk) / def / 50) + 2;
  const random = (Math.floor(Math.random() * 16) + 85) / 100;
  const crit = Math.random() < 0.0625 ? 1.5 : 1;
  return Math.max(1, Math.floor(baseDmg * random * stab * effectiveness * crit));
}

// ── test Pokémon ─────────────────────────────────────────────────────────────
// Charmeleon Lv20 (Fire / Physical attacker)
const charmeleon = {
  name: 'Charmeleon', level: 20,
  attack: 52, defense: 43, spAttack: 60, spDefense: 50, speed: 65,
  hp: 63, types: ['fire'],
};
// Wartortle Lv20 (Water)
const wartortle = {
  name: 'Wartortle', level: 20,
  attack: 63, defense: 80, spAttack: 65, spDefense: 80, speed: 58,
  hp: 78, types: ['water'],
};

// Move: Ember (Fire Special 40) — attacker Charmeleon vs defender Wartortle
const EMBER = { name: 'ember', type: 'fire', category: 'Special', power: 40 };
// Water is not weak/resist to fire from attacker's perspective, Wartortle (Water) takes 0.5x from Fire
const emberEffectiveness = 0.5; // fire → water
const emberStab = 1.5; // Charmeleon is Fire type

// Move: Bite (Dark Physical 60) — attacker Wartortle vs defender Charmeleon
const BITE = { name: 'bite', type: 'dark', category: 'Physical', power: 60 };
const biteEffectiveness = 1.0; // dark → fire = neutral
const biteStab = 1.0; // Wartortle is Water, not Dark

function avgOver(n, fn) {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += fn();
  return (sum / n).toFixed(1);
}

console.log('='.repeat(65));
console.log('BATTLE DAMAGE SIMULATION — BEFORE vs AFTER');
console.log('='.repeat(65));

// ── BEFORE ───────────────────────────────────────────────────────────────────
console.log('\n[BEFORE FIX] — broken formula: attack * basePower / (50 * defense)');
console.log(`  (No level scaling, no STAB, no type effectiveness)`);
const oldEmber = avgOver(1000, () => oldDamage(charmeleon.attack, wartortle.defense));
const oldBite  = avgOver(1000, () => oldDamage(wartortle.attack,  charmeleon.defense));
console.log(`  Charmeleon Ember  → Wartortle : avg ${oldEmber} dmg  (atk=${charmeleon.attack}, def=${wartortle.defense})`);
console.log(`  Wartortle  Bite   → Charmeleon: avg ${oldBite}  dmg  (atk=${wartortle.attack},  def=${charmeleon.defense})`);
console.log(`  Turns to KO (approx): Charmeleon HP=${charmeleon.hp}, Wartortle HP=${wartortle.hp}`);
console.log(`    Charmeleon KO'd in: ~${(charmeleon.hp / parseFloat(oldBite)).toFixed(0)} turns`);
console.log(`    Wartortle  KO'd in: ~${(wartortle.hp  / parseFloat(oldEmber)).toFixed(0)} turns`);

// ── AFTER ────────────────────────────────────────────────────────────────────
console.log('\n[AFTER FIX] — proper formula: levelFactor * power * atk / def / 50 + 2');
console.log(`  (Level scaling + STAB + type effectiveness)`);
const newEmber = avgOver(1000, () => newDamage(charmeleon.level, charmeleon.spAttack, wartortle.spDefense, EMBER.power, emberStab, emberEffectiveness));
const newBite  = avgOver(1000, () => newDamage(wartortle.level,  wartortle.attack,    charmeleon.defense,  BITE.power,  biteStab,  biteEffectiveness));
console.log(`  Charmeleon (Lv${charmeleon.level}) Ember → Wartortle`);
console.log(`    Power=${EMBER.power}, SpAtk=${charmeleon.spAttack}, SpDef=${wartortle.spDefense}, STAB=${emberStab}x, TypeEff=${emberEffectiveness}x`);
console.log(`    → avg ${newEmber} dmg`);
console.log(`  Wartortle (Lv${wartortle.level}) Bite → Charmeleon`);
console.log(`    Power=${BITE.power}, Atk=${wartortle.attack}, Def=${charmeleon.defense}, STAB=${biteStab}x, TypeEff=${biteEffectiveness}x`);
console.log(`    → avg ${newBite} dmg`);
console.log(`  Turns to KO (approx):`);
console.log(`    Charmeleon KO'd (HP=${charmeleon.hp}) in: ~${(charmeleon.hp / parseFloat(newBite)).toFixed(0)} turns`);
console.log(`    Wartortle  KO'd (HP=${wartortle.hp}) in:  ~${(wartortle.hp  / parseFloat(newEmber)).toFixed(0)} turns`);

// ── High-level vs low-level comparison ───────────────────────────────────────
console.log('\n[SCALING CHECK] — Lv10 vs Lv50 should feel meaningfully different');
function compareLevel(label, level, baseAtk, baseDef) {
  // Approximate stat at level: base * level / 50 + 5 (simplified)
  const atk = Math.floor(baseAtk * level / 50 + 5);
  const def = Math.floor(baseDef * level / 50 + 5);
  const old_ = avgOver(500, () => oldDamage(atk, def));
  const new_ = avgOver(500, () => newDamage(level, atk, def, 40, 1, 1));
  return { label, level, atk, def, old: old_, new: new_ };
}
const rows = [10, 20, 35, 50, 75, 100].map((lv) => compareLevel(`Lv${lv}`, lv, 65, 65));
console.log('  Level | Atk | Def | OLD avg dmg | NEW avg dmg | HP(approx)');
rows.forEach(({ label, level, atk, def, old: o, new: n }) => {
  const hp = Math.floor(65 * level / 50 + level + 10);
  const oldTurns = (hp / parseFloat(o)).toFixed(1);
  const newTurns = (hp / parseFloat(n)).toFixed(1);
  console.log(`  ${label.padEnd(6)} | ${String(atk).padStart(3)} | ${String(def).padStart(3)} | ${String(o).padStart(11)} | ${String(n).padStart(11)} | ${hp} HP → KO in ${newTurns} turns (old: ${oldTurns})`);
});

console.log('\n='.repeat(65));
console.log('RESULT: New formula produces level-scaled, meaningful damage.');
console.log('        Old formula: virtually identical 1-5 dmg at all levels.');
