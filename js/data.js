// =====================================================
// data.js — 게임 밸런스 숫자들 (스테이지, 몬스터, 강화)
// 너무 어렵거나 쉬우면 여기 숫자를 바꿔 보세요.
// =====================================================

// ---------- 스테이지 ----------
// duration  : 버텨야 하는 시간(초)
// spawnEvery: [시작할 때, 끝날 때] 몬스터 무리가 나오는 간격(초) — 작을수록 많이 나와요
// groupSize : [시작할 때, 끝날 때] 한 번에 나오는 몬스터 수
// enemies   : 나오는 몬스터 종류. w = 나올 확률 비중, from = 몇 초부터 나오는지
// bossAt    : (있으면) 이 시간에 보스 등장, 보스를 쓰러뜨려야 클리어
const STAGES = [
  {
    name: '1장 · 고요한 숲길',
    duration: 60,
    spawnEvery: [1.4, 0.6],
    groupSize: [1, 3],
    enemies: [
      { type: 'slime', w: 6 },
      { type: 'bat', w: 2, from: 25 },
    ],
    theme: 'forest',
    sky: ['#9fd3ff', '#d9f2c9'],
  },
  {
    name: '2장 · 황혼의 들판',
    duration: 75,
    spawnEvery: [1.1, 0.45],
    groupSize: [2, 4],
    enemies: [
      { type: 'slime', w: 4 },
      { type: 'bat', w: 4 },
      { type: 'golem', w: 1.5, from: 30 },
    ],
    theme: 'dusk',
    sky: ['#ff9a6b', '#ffd9a0'],
  },
  {
    name: '3장 · 폐허의 성',
    duration: 45,
    bossAt: 45,
    spawnEvery: [1.0, 0.5],
    groupSize: [2, 4],
    enemies: [
      { type: 'slime', w: 3 },
      { type: 'bat', w: 4 },
      { type: 'golem', w: 2 },
    ],
    theme: 'ruins',
    sky: ['#3b2a5c', '#8a6fb0'],
  },
];

// ---------- 몬스터 ----------
// hp: 체력, speed: 속도, r: 크기(반지름), dmg: 루나에게 주는 피해, xp: 경험치
const MONSTER_TYPES = {
  slime: { hp: 18, speed: 62, r: 15, dmg: 6, xp: 1, mass: 1, draw: 'slime', color: '#6cc45a', light: '#c8f5a8' },
  bat: { hp: 10, speed: 120, r: 12, dmg: 4, xp: 1, mass: 0.7, draw: 'bat', color: '#7a5aa8', dark: '#4a3570' },
  golem: { hp: 75, speed: 42, r: 22, dmg: 12, xp: 4, mass: 3, draw: 'golem', color: '#8c8a99', light: '#b8b6c4', dark: '#5f5d6e' },
  boss: { hp: 1400, speed: 55, r: 40, dmg: 18, xp: 0, mass: 50, draw: 'boss' },
};

// ---------- 시작 능력치 ----------
function baseStats() {
  return {
    dmg: 10,          // 검 공격력
    range: 80,        // 검이 닿는 거리
    arc: 2.3,         // 검 휘두르는 각도 (라디안, 2.3 ≈ 130도)
    atkCd: 0.36,      // 공격 사이 대기 시간(초)
    speed: 230,       // 이동 속도
    magnet: 90,       // 경험치 보석을 끌어당기는 거리
    followerMax: 100, // 루나 최대 체력
    regen: 0,         // 루나 초당 체력 회복
    skillCd: 9,       // 수호의 빛 대기 시간
    skillRadius: 170, // 수호의 빛 범위
    skillDmg: 25,     // 수호의 빛 피해
    orbs: 0,          // 수호 정령 개수
  };
}

// ---------- 레벨업 강화 ----------
const UPGRADES = [
  { id: 'dmg', icon: '⚔️', name: '검 강화', desc: '공격력 +25%', max: 8, apply: (s) => { s.dmg *= 1.25; } },
  { id: 'range', icon: '🌙', name: '넓은 베기', desc: '공격 범위 +15%', max: 5, apply: (s) => { s.range *= 1.15; s.arc = Math.min(s.arc * 1.08, 3.4); } },
  { id: 'atkspd', icon: '💨', name: '빠른 손놀림', desc: '공격 속도 +15%', max: 6, apply: (s) => { s.atkCd *= 0.87; } },
  { id: 'speed', icon: '👢', name: '신속', desc: '이동 속도 +10%', max: 5, apply: (s) => { s.speed *= 1.1; } },
  { id: 'hp', icon: '💗', name: '루나의 기도', desc: '루나 최대 체력 +25\n체력 모두 회복', max: 6, apply: (s, g) => { s.followerMax += 25; g.follower.hp = s.followerMax; } },
  { id: 'regen', icon: '🌿', name: '치유의 숨결', desc: '루나가 1초마다\n체력 1 회복', max: 5, apply: (s) => { s.regen += 1; } },
  { id: 'skill', icon: '✨', name: '결계 강화', desc: '수호의 빛\n대기시간 -15%, 범위 +15%', max: 5, apply: (s) => { s.skillCd *= 0.85; s.skillRadius *= 1.15; s.skillDmg *= 1.2; } },
  { id: 'orb', icon: '🔮', name: '수호 정령', desc: '루나 주위를 도는\n빛의 정령 +1', max: 4, apply: (s) => { s.orbs += 1; } },
  { id: 'magnet', icon: '🧲', name: '자석', desc: '경험치 흡수 범위 +40%', max: 4, apply: (s) => { s.magnet *= 1.4; } },
];
