// =====================================================
// data.js — 게임 밸런스 숫자들 (스테이지, 요괴, 강화)
// 너무 어렵거나 쉬우면 여기 숫자를 바꿔 보세요.
// =====================================================

// ---------- 스테이지 ----------
// duration  : 버텨야 하는 시간(초)
// spawnEvery: [시작할 때, 끝날 때] 요괴 무리가 나오는 간격(초) — 작을수록 많이 나와요
// groupSize : [시작할 때, 끝날 때] 한 번에 나오는 요괴 수
// enemies   : 나오는 요괴 종류. w = 나올 확률 비중, from = 몇 초부터 나오는지
// bossAt    : (있으면) 이 시간에 보스 등장, 보스를 쓰러뜨려야 클리어
// theme     : 바닥 모양 ('street' 하굣길 / 'beach' 바닷가 / 'shrine' 신사)
// sky       : 대화 장면 배경 색 [위, 아래]
const STAGES = [
  {
    name: '1장 · 하굣길',
    duration: 60,
    spawnEvery: [1.4, 0.6],
    groupSize: [1, 3],
    enemies: [
      { type: 'blob', w: 6 },
      { type: 'wisp', w: 2, from: 25 },
    ],
    theme: 'street',
    sky: ['#9fd3ff', '#f4efe2'],
  },
  {
    name: '2장 · 해 질 녘 바닷가',
    duration: 75,
    spawnEvery: [1.1, 0.45],
    groupSize: [2, 4],
    enemies: [
      { type: 'blob', w: 4 },
      { type: 'wisp', w: 4 },
      { type: 'oni', w: 1.5, from: 30 },
    ],
    theme: 'beach',
    sky: ['#ff9a6b', '#ffd9a0'],
  },
  {
    name: '3장 · 한밤의 신사',
    duration: 45,
    bossAt: 45,
    spawnEvery: [1.0, 0.5],
    groupSize: [2, 4],
    enemies: [
      { type: 'blob', w: 3 },
      { type: 'wisp', w: 4 },
      { type: 'oni', w: 2 },
    ],
    theme: 'shrine',
    sky: ['#1e2347', '#4b3f78'],
  },
];

// ---------- 식인 요괴 ----------
// hp: 체력, speed: 속도, r: 크기(반지름), dmg: 히나코에게 주는 피해, xp: 경험치
const MONSTER_TYPES = {
  blob: { name: '그림자 요괴', hp: 18, speed: 62, r: 15, dmg: 6, xp: 1, mass: 1, draw: 'blob', color: '#3b2a4d', light: '#6e5a8a' },
  wisp: { name: '귀신불', hp: 10, speed: 120, r: 12, dmg: 4, xp: 1, mass: 0.7, draw: 'wisp', color: '#5cc4f2', light: '#ffffff' },
  oni: { name: '오니', hp: 75, speed: 42, r: 22, dmg: 12, xp: 4, mass: 3, draw: 'oni', color: '#cf5048', light: '#ea7a6c', dark: '#8f2f2a' },
  boss: { name: '굶주린 대요괴', hp: 1400, speed: 55, r: 40, dmg: 18, xp: 0, mass: 50, draw: 'boss', color: '#4a3358' },
};

// ---------- 시작 능력치 ----------
function baseStats() {
  return {
    dmg: 10,          // 손톱 공격력
    range: 80,        // 손톱이 닿는 거리
    arc: 2.3,         // 손톱 휘두르는 각도 (라디안, 2.3 ≈ 130도)
    atkCd: 0.3,       // 공격 사이 대기 시간(초)
    speed: 250,       // 이동 속도
    magnet: 90,       // 경험치 구슬을 끌어당기는 거리
    followerMax: 100, // 히나코 최대 체력
    regen: 0,         // 히나코 초당 체력 회복
    skillCd: 9,       // 파도 장벽 대기 시간
    skillRadius: 170, // 파도 장벽 범위
    skillDmg: 25,     // 파도 장벽 피해
    orbs: 0,          // 물방울 수호 개수
  };
}

// ---------- 레벨업 강화 ----------
const UPGRADES = [
  { id: 'dmg', icon: '🦈', name: '날카로운 손톱', desc: '공격력 +25%', max: 8, apply: (s) => { s.dmg *= 1.25; } },
  { id: 'range', icon: '🌊', name: '길어지는 손톱', desc: '공격 범위 +15%', max: 5, apply: (s) => { s.range *= 1.15; s.arc = Math.min(s.arc * 1.08, 3.4); } },
  { id: 'atkspd', icon: '💨', name: '빠른 손놀림', desc: '공격 속도 +15%', max: 6, apply: (s) => { s.atkCd *= 0.87; } },
  { id: 'speed', icon: '👟', name: '가벼운 발걸음', desc: '이동 속도 +10%', max: 5, apply: (s) => { s.speed *= 1.1; } },
  { id: 'hp', icon: '🍙', name: '든든한 도시락', desc: '히나코 최대 체력 +25\n체력 모두 회복', max: 6, apply: (s, g) => { s.followerMax += 25; g.follower.hp = s.followerMax; } },
  { id: 'regen', icon: '🐚', name: '바다 내음', desc: '히나코가 1초마다\n체력 1 회복', max: 5, apply: (s) => { s.regen += 1; } },
  { id: 'skill', icon: '💧', name: '큰 파도', desc: '파도 장벽\n대기시간 -15%, 범위 +15%', max: 5, apply: (s) => { s.skillCd *= 0.85; s.skillRadius *= 1.15; s.skillDmg *= 1.2; } },
  { id: 'orb', icon: '🫧', name: '물방울 수호', desc: '히나코 주위를 도는\n물방울 +1', max: 4, apply: (s) => { s.orbs += 1; } },
  { id: 'magnet', icon: '🧲', name: '자석', desc: '경험치 흡수 범위 +40%', max: 4, apply: (s) => { s.magnet *= 1.4; } },
];
