// Cancer cells. See docs/GAME_DESIGN.md §6.
//
// A concrete enemy = CANCER_FAMILIES (organ) × CELL_ARCHETYPES (behaviour
// template), optionally tagged with a genetic MARKER. RESIST_MATRIX is a
// sparse, layered override table: family → archetype → marker, each layer
// only overriding the damage types it cares about. The combat resolver
// (see combat.js) always clamps the final multiplier to [0.5, 3.0] — the
// hard design invariant "no damage type is ever fully immune (0), no
// enemy is unsolvable" from §4 holds no matter how layers combine.

export const CANCER_FAMILIES = [
  { id: 'gastric', name: '胃癌', nameEn: 'Gastric Cancer', color: 0xc0392b },
  { id: 'breast', name: '乳癌', nameEn: 'Breast Cancer', color: 0xff69b4 },
  { id: 'colorectal', name: '大腸直腸癌', nameEn: 'Colorectal Cancer', color: 0x8e6b4a },
  { id: 'hcc', name: '肝癌', nameEn: 'Hepatocellular Carcinoma', color: 0xa0522d },
  { id: 'lung', name: '肺癌', nameEn: 'Lung Cancer', color: 0x95a5a6 },
];

export const CELL_ARCHETYPES = [
  { id: 'rapid', name: '分裂型', nameEn: 'Rapid Divider', flags: [] },
  { id: 'solid', name: '實體瘤塊', nameEn: 'Solid Mass', flags: [] },
  { id: 'hypoxic', name: '缺氧細胞', nameEn: 'Hypoxic Cell', flags: [] },
  { id: 'resistant', name: '抗藥細胞', nameEn: 'MDR Cell', flags: [] },
  { id: 'ctc', name: '循環腫瘤細胞', nameEn: 'Circulating Tumor Cell', flags: ['flying'] },
  { id: 'stem', name: '癌幹細胞', nameEn: 'Cancer Stem Cell', flags: ['selfHeal'] },
  { id: 'mets', name: '轉移灶', nameEn: 'Metastasis', flags: ['splitOnDeath'] },
];

// Sparse layered resistance overrides. Anything not listed defaults to 1.0.
export const RESIST_MATRIX = {
  family: {
    gastric_early: { surgery: 3.0 },
    gastric_late: { surgery: 0.5, chemo: 3.0 },
    gastric_her2: { surgery: 0.5, chemo: 0.5, radiation: 0.5, targeted: 3.0 },
    gastric_metastatic: { surgery: 0.5, chemo: 3.0, immuno: 3.0 },
  },
  archetype: {
    rapid: { chemo: 3.0 },
    solid: { surgery: 3.0 },
    hypoxic: { radiation: 0.5, chemo: 0.5, surgery: 3.0 },
    resistant: { chemo: 0.5 },
    ctc: { surgery: 0.5, immuno: 3.0 },
    stem: { chemo: 0.5 },
    mets: { chemo: 3.0 },
  },
  marker: {
    her2_marked: { targeted: 3.0 },
    egfr_marked: { targeted: 3.0 },
    pdl1_marked: { immuno: 3.0 },
  },
};

// Concrete enemy units used by the gastric level's waves + boss summons.
// familyStage selects which `family.*` resist layer applies (early-stage
// mooks use `gastric_early`; boss phases override this at runtime).
export const ENEMY_UNITS = {
  gastric_rapid: {
    id: 'gastric_rapid', name: '分裂型胃癌細胞', familyId: 'gastric', archetypeId: 'rapid',
    familyStage: 'gastric_early', hp: 22, speed: 1.7, contactDamage: 6, xpReward: 4,
    spriteId: 'gastric_rapid', flags: [],
  },
  gastric_solid: {
    id: 'gastric_solid', name: '胃實體瘤塊', familyId: 'gastric', archetypeId: 'solid',
    familyStage: 'gastric_early', hp: 140, speed: 0.55, contactDamage: 14, xpReward: 8,
    spriteId: 'gastric_solid', flags: [],
  },
  gastric_hypoxic: {
    id: 'gastric_hypoxic', name: '缺氧胃癌細胞', familyId: 'gastric', archetypeId: 'hypoxic',
    familyStage: 'gastric_early', hp: 95, speed: 0.5, contactDamage: 10, xpReward: 7,
    spriteId: 'gastric_hypoxic', flags: [],
  },
  gastric_resistant: {
    id: 'gastric_resistant', name: '抗藥胃癌細胞', familyId: 'gastric', archetypeId: 'resistant',
    familyStage: 'gastric_early', hp: 75, speed: 0.8, contactDamage: 9, xpReward: 6,
    spriteId: 'gastric_resistant', flags: [],
  },
  gastric_ctc: {
    id: 'gastric_ctc', name: '循環胃癌細胞', familyId: 'gastric', archetypeId: 'ctc',
    familyStage: 'gastric_metastatic', hp: 32, speed: 2.0, contactDamage: 5, xpReward: 5,
    spriteId: 'gastric_ctc', flags: ['flying'],
  },
  gastric_stem: {
    id: 'gastric_stem', name: '胃癌幹細胞', familyId: 'gastric', archetypeId: 'stem',
    familyStage: 'gastric_early', hp: 90, speed: 0.9, contactDamage: 11, xpReward: 9,
    spriteId: 'gastric_stem', flags: ['selfHeal'], healPerSec: 6,
  },
  gastric_node: {
    id: 'gastric_node', name: '淋巴結轉移灶', familyId: 'gastric', archetypeId: 'mets',
    familyStage: 'gastric_late', hp: 44, speed: 1.0, contactDamage: 8, xpReward: 5,
    spriteId: 'gastric_node', flags: ['splitOnDeath'], splitInto: { enemyId: 'gastric_shard', count: 2 },
  },
  gastric_shard: {
    id: 'gastric_shard', name: '轉移灶碎片', familyId: 'gastric', archetypeId: 'rapid',
    familyStage: 'gastric_late', hp: 16, speed: 1.3, contactDamage: 4, xpReward: 2,
    spriteId: 'gastric_shard', flags: [],
  },
  gastric_boss: {
    id: 'gastric_boss', name: '胃癌原發腫瘤', familyId: 'gastric', archetypeId: 'solid',
    familyStage: 'gastric_early', hp: 3400, speed: 0.32, contactDamage: 34, xpReward: 120,
    spriteId: 'gastric_boss', flags: ['boss'], isBoss: true,
  },
};
