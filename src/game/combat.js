// Damage resolution: resistance lookup + MDT synergy. See
// docs/GAME_DESIGN.md §4, §4b.
import { RESIST_MATRIX } from './data/enemies.js';
import { SYNERGIES } from './data/synergies.js';
import { DEPLOYMENT } from './data/deployment.js';

const RESIST_FLOOR = 0.5;
const RESIST_WEAKNESS = 3.0;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Layered sparse override: family stage → archetype → active markers, each
// only overriding the damage types it names. Never fully replaces the
// enemy's whole resist profile — just the entries it mentions — and the
// final read is always clamped to [0.5, 3.0], so no combination of layers
// can ever produce a 0 (unsolvable) or unbounded multiplier.
export function resolveResistance(enemy, damageTypeId) {
  let mult = 1.0;
  const familyLayer = RESIST_MATRIX.family[enemy.familyStage];
  if (familyLayer && damageTypeId in familyLayer) mult = familyLayer[damageTypeId];
  const archLayer = RESIST_MATRIX.archetype[enemy.archetypeId];
  if (archLayer && damageTypeId in archLayer) mult = archLayer[damageTypeId];
  for (const marker of enemy.markers || []) {
    const markerLayer = RESIST_MATRIX.marker[marker];
    if (markerLayer && damageTypeId in markerLayer) mult = markerLayer[damageTypeId];
  }
  return clamp(mult, RESIST_FLOOR, RESIST_WEAKNESS);
}

export function isWeakness(enemy, damageTypeId) {
  return resolveResistance(enemy, damageTypeId) >= RESIST_WEAKNESS;
}
export function isResisted(enemy, damageTypeId) {
  return resolveResistance(enemy, damageTypeId) <= RESIST_FLOOR;
}

// Which synergies are currently active given the set of deployed (alive)
// doctor definition ids.
export function activeSynergies(deployedDoctorIds) {
  const idSet = new Set(deployedDoctorIds);
  return SYNERGIES.filter((s) => s.require.every((id) => idSet.has(id)));
}

export function synergyDamageMult(activeSyns) {
  return activeSyns.reduce((m, s) => m * (s.effect.allyDamageMult ?? 1), 1);
}

// Full damage roll from a doctor instance onto an enemy instance.
// `synergyMult` = product of active team synergy multipliers (e.g. MDT x2).
export function computeDamage(doctorInst, enemy, { synergyMult = 1, skillMult = 1, rng = Math.random } = {}) {
  const resist = resolveResistance(enemy, doctorInst.damageType);
  const prescriptionMult = clamp(resist * synergyMult, RESIST_FLOOR, DEPLOYMENT.damageMultCap);
  const isCrit = rng() < (doctorInst.critChance ?? 0);
  const critMult = isCrit ? (doctorInst.critMult ?? 1) : 1;
  const raw = doctorInst.atk * prescriptionMult * skillMult * critMult;
  return { amount: Math.max(1, Math.round(raw)), isCrit, resist, prescriptionMult };
}
