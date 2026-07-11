// Elite promotion tiers (E0/E1/E2) and branching passive talents. See
// docs/GAME_DESIGN.md §8. Spent with meta-progression research points
// (meta.js) between runs — permanent, not reset per level.
export const PROMOTION_TIERS = [
  { tier: 0, name: 'E0', cost: 0, statMult: 1.0 },
  { tier: 1, name: 'E1', cost: 60, statMult: 1.25 },
  { tier: 2, name: 'E2', cost: 150, statMult: 1.6 },
];

// One talent is picked (permanently) at each tier a doctor is promoted to.
export const TALENTS = {
  surgeon: {
    1: [
      { id: 'surgeon_precision', name: '精準下刀', desc: '暴擊率 +15%', effect: { critChanceAdd: 0.15 } },
      { id: 'surgeon_reach', name: '延伸器械', desc: '射程 +0.4', effect: { rangeAdd: 0.4 } },
    ],
    2: [
      { id: 'surgeon_team', name: '住院醫師團隊', desc: '阻擋數 +1', effect: { blockAdd: 1 } },
      { id: 'surgeon_brute', name: '大範圍切除', desc: '攻擊力 +20%', effect: { atkMult: 1.2 } },
    ],
  },
  med_onc: {
    1: [
      { id: 'med_onc_dose', name: '劑量強化', desc: '攻擊力 +20%', effect: { atkMult: 1.2 } },
      { id: 'med_onc_catheter', name: '滴注導管延長', desc: '射程 +0.5', effect: { rangeAdd: 0.5 } },
    ],
    2: [
      { id: 'med_onc_combo', name: '複方化療', desc: '暴擊率 +12%', effect: { critChanceAdd: 0.12 } },
      { id: 'med_onc_mtd', name: '最大耐受劑量', desc: '攻擊力 +25%，HP -10%', effect: { atkMult: 1.25, hpMult: 0.9 } },
    ],
  },
  rad_onc: {
    1: [
      { id: 'rad_onc_beam', name: '窄束準直', desc: '暴擊率 +15%', effect: { critChanceAdd: 0.15 } },
      { id: 'rad_onc_range', name: '加大照野', desc: '射程 +0.6', effect: { rangeAdd: 0.6 } },
    ],
    2: [
      { id: 'rad_onc_sbrt', name: '立體定位強化', desc: '攻擊力 +25%', effect: { atkMult: 1.25 } },
      { id: 'rad_onc_tough', name: '鉛衣防護', desc: 'HP +25%', effect: { hpMult: 1.25 } },
    ],
  },
  immunologist: {
    1: [
      { id: 'immuno_prime', name: 'T 細胞活化', desc: '攻擊力 +20%', effect: { atkMult: 1.2 } },
      { id: 'immuno_range', name: '廣泛監測', desc: '射程 +0.5', effect: { rangeAdd: 0.5 } },
    ],
    2: [
      { id: 'immuno_memory', name: '免疫記憶', desc: 'HP +25%', effect: { hpMult: 1.25 } },
      { id: 'immuno_crit', name: '細胞毒殺強化', desc: '暴擊率 +12%', effect: { critChanceAdd: 0.12 } },
    ],
  },
  precision_onc: {
    1: [
      { id: 'precision_dose', name: '劑量滴定', desc: '攻擊力 +20%', effect: { atkMult: 1.2 } },
      { id: 'precision_range', name: '生物標記擴大篩檢', desc: '射程 +0.4', effect: { rangeAdd: 0.4 } },
    ],
    2: [
      { id: 'precision_crit', name: '次世代定序', desc: '暴擊率 +15%', effect: { critChanceAdd: 0.15 } },
      { id: 'precision_glass', name: '高選擇性抑制劑', desc: '攻擊力 +30%，HP -10%', effect: { atkMult: 1.3, hpMult: 0.9 } },
    ],
  },
};

export function findTalent(doctorId, talentId) {
  const tiers = TALENTS[doctorId];
  if (!tiers) return null;
  for (const list of Object.values(tiers)) {
    const found = list.find((t) => t.id === talentId);
    if (found) return found;
  }
  return null;
}
