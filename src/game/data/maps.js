// Battlefields (one per level). See docs/GAME_DESIGN.md §10.
//
// Each entry is a hand-authored axis-aligned waypoint polyline standing in
// for a vessel/lymphatic route through that organ (§14 MVP note — a future
// pass can swap `waypoints` for a path extracted from the procedural
// dungeon generator's room graph without touching anything downstream,
// since map.js only ever consumes `waypoints`).
//
// `implemented: false` levels intentionally ship with no waypoints/waves/
// boss yet — they exist so the level-select screen can show the full
// roadmap (§14) and prove the registry scales by adding entries, not code.
export const LEVELS = [
  {
    id: 'gastric', name: '胃／上消化道', nameEn: 'Stomach', organ: '胃癌 Gastric Cancer',
    implemented: true, accent: 0xc0392b,
    teach: '早期胃癌開刀根治；局部晚期先化療縮小腫瘤；HER2+ 需標靶；轉移後倚靠全身治療。',
    waypoints: [
      [1, 1], [1, 4], [4, 4], [4, 1], [7, 1], [7, 5],
      [10, 5], [10, 2], [12, 2], [12, 8], [6, 8], [6, 9],
    ],
  },
  {
    id: 'lung', name: '肺／支氣管', nameEn: 'Lung', organ: '肺癌 Lung Cancer',
    implemented: true, accent: 0x7f8c8d,
    teach: '早期可手術切除；局部晚期採同步化放療；帶driver突變用標靶；PD-L1高表現用免疫治療。',
    waypoints: [
      [1, 6], [4, 6], [4, 2], [8, 2], [8, 6], [11, 6],
      [11, 1], [14, 1], [14, 9], [9, 9], [9, 7], [6, 7], [6, 9], [3, 9],
    ],
  },
  { id: 'breast', name: '乳房', nameEn: 'Breast', organ: '乳癌 Breast Cancer', implemented: false, accent: 0xff69b4,
    teach: '依受體亞型（HER2 / ER / 三陰性）決定治療策略。' },
  { id: 'colorectal', name: '大腸／直腸', nameEn: 'Colorectal', organ: '大腸直腸癌 Colorectal Cancer', implemented: false, accent: 0x8e6b4a,
    teach: '直腸癌術前放化療；結腸癌根治手術；肝轉移需合併手術與化療。' },
  { id: 'hcc', name: '肝臟', nameEn: 'Liver', organ: '肝癌 HCC', implemented: false, accent: 0xa0522d,
    teach: '肝功能常不宜大手術，倚靠消融/介入、標靶與免疫治療。' },
];

export const levelById = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
