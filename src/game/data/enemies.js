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
    lung_early: { surgery: 3.0 },
    lung_advanced: { surgery: 0.5, chemo: 3.0, radiation: 3.0 },
    lung_driver: { surgery: 0.5, chemo: 0.5, radiation: 0.5, targeted: 3.0 },
    lung_pdl1: { surgery: 0.5, chemo: 0.5, radiation: 0.5, immuno: 3.0 },
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

  // --- Lung level -------------------------------------------------------
  lung_rapid: {
    id: 'lung_rapid', name: '分裂型肺癌細胞', familyId: 'lung', archetypeId: 'rapid',
    familyStage: 'lung_early', hp: 24, speed: 1.8, contactDamage: 6, xpReward: 4,
    spriteId: 'lung_rapid', flags: [],
  },
  lung_solid: {
    id: 'lung_solid', name: '肺部實體瘤塊', familyId: 'lung', archetypeId: 'solid',
    familyStage: 'lung_early', hp: 150, speed: 0.5, contactDamage: 15, xpReward: 8,
    spriteId: 'lung_solid', flags: [],
  },
  lung_hypoxic: {
    id: 'lung_hypoxic', name: '缺氧肺癌細胞', familyId: 'lung', archetypeId: 'hypoxic',
    familyStage: 'lung_early', hp: 100, speed: 0.5, contactDamage: 10, xpReward: 7,
    spriteId: 'lung_hypoxic', flags: [],
  },
  lung_resistant: {
    id: 'lung_resistant', name: '抗藥肺癌細胞', familyId: 'lung', archetypeId: 'resistant',
    familyStage: 'lung_early', hp: 80, speed: 0.8, contactDamage: 9, xpReward: 6,
    spriteId: 'lung_resistant', flags: [],
  },
  lung_ctc: {
    id: 'lung_ctc', name: '循環肺癌細胞', familyId: 'lung', archetypeId: 'ctc',
    familyStage: 'lung_advanced', hp: 34, speed: 2.1, contactDamage: 5, xpReward: 5,
    spriteId: 'lung_ctc', flags: ['flying'],
  },
  lung_driver: {
    id: 'lung_driver', name: 'EGFR/ALK 驅動突變細胞', familyId: 'lung', archetypeId: 'solid',
    familyStage: 'lung_driver', hp: 110, speed: 0.6, contactDamage: 12, xpReward: 10,
    spriteId: 'lung_driver', flags: [],
  },
  lung_pdl1: {
    id: 'lung_pdl1', name: 'PD-L1 高表現細胞', familyId: 'lung', archetypeId: 'stem',
    familyStage: 'lung_pdl1', hp: 95, speed: 0.7, contactDamage: 11, xpReward: 10,
    spriteId: 'lung_pdl1', flags: ['selfHeal'], healPerSec: 5,
  },
  lung_node: {
    id: 'lung_node', name: '縱膈腔淋巴結轉移灶', familyId: 'lung', archetypeId: 'mets',
    familyStage: 'lung_advanced', hp: 46, speed: 1.0, contactDamage: 8, xpReward: 5,
    spriteId: 'lung_node', flags: ['splitOnDeath'], splitInto: { enemyId: 'lung_shard', count: 2 },
  },
  lung_shard: {
    id: 'lung_shard', name: '轉移灶碎片', familyId: 'lung', archetypeId: 'rapid',
    familyStage: 'lung_advanced', hp: 18, speed: 1.4, contactDamage: 4, xpReward: 2,
    spriteId: 'lung_shard', flags: [],
  },
  lung_boss: {
    id: 'lung_boss', name: '肺癌原發腫瘤', familyId: 'lung', archetypeId: 'solid',
    familyStage: 'lung_early', hp: 3800, speed: 0.3, contactDamage: 36, xpReward: 140,
    spriteId: 'lung_boss', flags: ['boss'], isBoss: true,
  },
};
