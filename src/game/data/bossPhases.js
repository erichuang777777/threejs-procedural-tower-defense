// Multi-phase boss scripts. See docs/GAME_DESIGN.md §7.1.
// Each phase swaps which RESIST_MATRIX.family layer the boss uses, so its
// weakness genuinely shifts with "stage" the way real gastric cancer
// treatment strategy does. hpPct is the threshold (fraction of max HP)
// at which the phase begins; phases are checked in array order.
export const BOSS_PHASES = {
  gastric_boss: [
    {
      id: 'early',
      hpPct: 1.0,
      familyStage: 'gastric_early',
      flags: [],
      teach: '早期胃癌（局部）：手術是首選根治性治療。',
    },
    {
      id: 'locally_advanced',
      hpPct: 0.7,
      familyStage: 'gastric_late',
      flags: [],
      summon: { enemyId: 'gastric_node', intervalSec: 6 },
      teach: '局部晚期：需先化療縮小腫瘤（FLOT），單靠手術效果下降；召喚淋巴結轉移。',
    },
    {
      id: 'her2_positive',
      hpPct: 0.45,
      familyStage: 'gastric_her2',
      flags: ['shielded'],
      teach: 'HER2+ 轉化：長出護盾，需標靶治療（trastuzumab）才能有效破盾。',
    },
    {
      id: 'metastatic',
      hpPct: 0.2,
      familyStage: 'gastric_metastatic',
      flags: [],
      summon: { enemyId: 'gastric_ctc', intervalSec: 4 },
      teach: '轉移/腹膜擴散：手術已無效，只能倚靠全身化療與免疫治療；持續有循環腫瘤細胞擴散。',
    },
  ],
};
