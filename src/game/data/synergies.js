// Team synergies. See docs/GAME_DESIGN.md §4b.
export const SYNERGIES = [
  {
    id: 'mdt',
    name: '多專科會議',
    nameEn: 'Multidisciplinary Team (MDT)',
    desc: '腫瘤內科、外科、放射腫瘤科同時在場 → 全隊傷害 ×2。',
    require: ['med_onc', 'surgeon', 'rad_onc'],
    effect: { allyDamageMult: 2.0 },
    fx: 'mdt_banner',
  },
];
