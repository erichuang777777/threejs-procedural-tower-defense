// Meta progression: research points, level completion, and permanent
// doctor promotions/talents — persisted in localStorage so it survives a
// reload. See docs/GAME_DESIGN.md §8 (升級、晉升與技能) and §9
// (經濟：關後 研究點數 → 招募/升級).
import { PROMOTION_TIERS, TALENTS, findTalent } from './data/promotions.js';

const STORAGE_KEY = 'onco-defense-save-v1';

function defaultState() {
  return { researchPoints: 100, completedLevels: [], doctorPromotions: {} };
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveRaw(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private browsing etc.) — play on, just don't persist
  }
}

let state = loadRaw() || defaultState();

export function getMeta() {
  return state;
}

export function isLevelCompleted(levelId) {
  return state.completedLevels.includes(levelId);
}

// Award on level win: flat base + a bonus for lives still standing +
// a one-time first-clear bonus. Returns the amount awarded.
export function awardWin(levelId, livesRemaining) {
  const firstClear = !state.completedLevels.includes(levelId);
  const points = 100 + Math.round(livesRemaining * 5) + (firstClear ? 50 : 0);
  state.researchPoints += points;
  if (firstClear) state.completedLevels.push(levelId);
  saveRaw(state);
  return points;
}

export function getDoctorPromotion(doctorId) {
  return state.doctorPromotions[doctorId] || { tier: 0, talents: {} };
}

export function nextPromotionTier(doctorId) {
  const cur = getDoctorPromotion(doctorId).tier;
  return PROMOTION_TIERS[cur + 1] || null;
}

export function promoteDoctor(doctorId, talentId) {
  const promo = getDoctorPromotion(doctorId);
  const tierDef = PROMOTION_TIERS[promo.tier + 1];
  if (!tierDef) return { ok: false, reason: 'max_tier' };
  if (state.researchPoints < tierDef.cost) return { ok: false, reason: 'insufficient_points' };
  // The talent (if any) must belong to precisely the tier being promoted
  // to — not just any tier for this doctor — otherwise a cheaper tier
  // could smuggle in a stronger tier's talent.
  const talentOptions = TALENTS[doctorId]?.[tierDef.tier];
  if (talentOptions && !talentId) return { ok: false, reason: 'talent_required' };
  if (talentId && !talentOptions?.some((t) => t.id === talentId)) return { ok: false, reason: 'invalid_talent' };
  state.researchPoints -= tierDef.cost;
  const talents = { ...promo.talents };
  if (talentId) talents[tierDef.tier] = talentId;
  state.doctorPromotions[doctorId] = { tier: tierDef.tier, talents };
  saveRaw(state);
  return { ok: true, tier: tierDef.tier };
}

// Combined permanent bonus for a doctor: tier stat multiplier + every
// talent chosen so far (talents stack: mult fields multiply, add fields add).
export function getDoctorBonus(doctorId) {
  const promo = getDoctorPromotion(doctorId);
  const tierDef = PROMOTION_TIERS[promo.tier] || PROMOTION_TIERS[0];
  const effects = Object.values(promo.talents)
    .map((id) => findTalent(doctorId, id))
    .filter(Boolean)
    .map((t) => t.effect);
  if (!effects.length) return { tier: promo.tier, statMult: tierDef.statMult, talent: null };
  const combined = effects.reduce(
    (acc, fx) => ({
      atkMult: (acc.atkMult ?? 1) * (fx.atkMult ?? 1),
      hpMult: (acc.hpMult ?? 1) * (fx.hpMult ?? 1),
      rangeAdd: (acc.rangeAdd ?? 0) + (fx.rangeAdd ?? 0),
      critChanceAdd: (acc.critChanceAdd ?? 0) + (fx.critChanceAdd ?? 0),
      blockAdd: (acc.blockAdd ?? 0) + (fx.blockAdd ?? 0),
    }),
    {}
  );
  return { tier: promo.tier, statMult: tierDef.statMult, talent: { effect: combined } };
}

export function resetMeta() {
  state = defaultState();
  saveRaw(state);
  return state;
}
