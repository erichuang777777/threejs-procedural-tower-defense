// Wave script for the gastric (stomach) level. See docs/GAME_DESIGN.md §13.
// `delay` = seconds to wait after the previous wave finished spawning.
// `spawn[].gap` = seconds between individual spawns within that entry.
export const GASTRIC_LEVEL_WAVES = [
  { delay: 3, spawn: [{ enemyId: 'gastric_rapid', count: 5, gap: 1.0 }] },
  { delay: 6, spawn: [{ enemyId: 'gastric_rapid', count: 4, gap: 0.8 }, { enemyId: 'gastric_solid', count: 1, gap: 0 }] },
  { delay: 8, spawn: [{ enemyId: 'gastric_solid', count: 2, gap: 2.0 }] },
  { delay: 8, spawn: [{ enemyId: 'gastric_hypoxic', count: 3, gap: 1.5 }] },
  { delay: 8, spawn: [{ enemyId: 'gastric_resistant', count: 3, gap: 1.5 }, { enemyId: 'gastric_rapid', count: 4, gap: 0.6 }] },
  { delay: 8, spawn: [{ enemyId: 'gastric_stem', count: 2, gap: 2.5 }] },
  { delay: 8, spawn: [{ enemyId: 'gastric_ctc', count: 4, gap: 1.2 }] },
  { delay: 10, spawn: [{ enemyId: 'gastric_solid', count: 3, gap: 1.8 }, { enemyId: 'gastric_hypoxic', count: 2, gap: 1.5 }] },
  { delay: 12, spawn: [{ enemyId: 'gastric_boss', count: 1, gap: 0 }], isBossWave: true },
];

// Wave script for the lung level. Introduces lung_driver/lung_pdl1 mobs
// early so the precision oncologist and immunologist doctors are genuinely
// useful before the boss, not just during it.
export const LUNG_LEVEL_WAVES = [
  { delay: 3, spawn: [{ enemyId: 'lung_rapid', count: 5, gap: 1.0 }] },
  { delay: 6, spawn: [{ enemyId: 'lung_rapid', count: 4, gap: 0.8 }, { enemyId: 'lung_solid', count: 1, gap: 0 }] },
  { delay: 8, spawn: [{ enemyId: 'lung_solid', count: 2, gap: 2.0 }] },
  { delay: 8, spawn: [{ enemyId: 'lung_driver', count: 2, gap: 2.0 }] },
  { delay: 8, spawn: [{ enemyId: 'lung_hypoxic', count: 2, gap: 1.5 }, { enemyId: 'lung_resistant', count: 2, gap: 1.5 }] },
  { delay: 8, spawn: [{ enemyId: 'lung_pdl1', count: 2, gap: 2.5 }] },
  { delay: 8, spawn: [{ enemyId: 'lung_ctc', count: 4, gap: 1.2 }] },
  { delay: 10, spawn: [{ enemyId: 'lung_driver', count: 2, gap: 2.0 }, { enemyId: 'lung_pdl1', count: 2, gap: 2.0 }] },
  { delay: 12, spawn: [{ enemyId: 'lung_boss', count: 1, gap: 0 }], isBossWave: true },
];
