// Treatment modalities = damage types. See docs/GAME_DESIGN.md §3.
// Each entry is fully self-contained — adding a new treatment means adding
// one object here (plus, if needed, a few sparse RESIST_MATRIX overrides).
export const DAMAGE_TYPES = [
  {
    id: 'surgery',
    name: '手術',
    nameEn: 'Surgery',
    color: 0x4a90d9,
    behavior: ['single'],
    desc: '近戰單體高爆發。對局部實體瘤傷害極高，對已擴散/血液型鈍化。',
  },
  {
    id: 'chemo',
    name: '化療',
    nameEn: 'Chemotherapy',
    color: 0x9b59b6,
    behavior: ['aoe', 'dot'],
    sideEffect: true,
    desc: '範圍持續傷害，打所有分裂中的細胞；對缺氧/休眠細胞較弱。',
  },
  {
    id: 'radiation',
    name: '放射線',
    nameEn: 'Radiation',
    color: 0xf1c40f,
    behavior: ['line'],
    desc: '直線穿透中距離光束，對局部病灶強。',
  },
  {
    id: 'targeted',
    name: '標靶',
    nameEn: 'Targeted Therapy',
    color: 0xe91e8c,
    behavior: ['gated'],
    gateFlag: 'markGated',
    desc: '只對帶對應突變標記(HER2/EGFR)的細胞高傷，無標記僅基礎傷害。',
  },
  {
    id: 'immuno',
    name: '免疫',
    nameEn: 'Immunotherapy',
    color: 0x1abc9c,
    behavior: ['summon', 'debuff'],
    desc: '標記敵人增傷、召喚 T 細胞/NK 小兵，慢熱滾雪球。',
  },
  {
    id: 'hormone',
    name: '荷爾蒙',
    nameEn: 'Hormone Therapy',
    color: 0xff9ec4,
    behavior: ['dot', 'debuff'],
    desc: '只對荷爾蒙驅動癌（ER+）有效，抑制生長。',
  },
  {
    id: 'ablation',
    name: '消融',
    nameEn: 'Ablation',
    color: 0xe67e22,
    behavior: ['single'],
    desc: 'RFA/冷凍/TACE，對不宜手術者的弱點解。',
  },
];

export const damageTypeById = Object.fromEntries(DAMAGE_TYPES.map((d) => [d.id, d]));
