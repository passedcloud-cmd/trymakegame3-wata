// =====================================================
// game.js — 게임의 심장! (규칙, 움직임, 화면 그리기)
//
// 게임은 1초에 약 60번 아래 과정을 반복해요:
//   1) update() : 위치·체력 등 "상태"를 계산
//   2) render() : 계산된 상태를 화면에 그리기
//
// 게임 상태(G.state)
//   title → story(프롤로그) → play ⇄ levelup / paused
//         → clear → story(클리어 대화) → 다음 스테이지 …
//   play 중 루나 체력 0 → gameover
// =====================================================

const W = 1280, H = 720;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const DPR = Math.min(2, window.devicePixelRatio || 1);
canvas.width = W * DPR;
canvas.height = H * DPR;

function fitCanvas() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${H * s}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const FONT_TITLE = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const FONT_BODY = '"Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

const PLAYER_R = 18;
const FOLLOWER_R = 14;
const FOLLOW_DIST = 54;     // 루나가 레온 뒤로 얼마나 떨어져서 따라오는지
const FOLLOWER_IFRAME = 0.35; // 루나가 맞은 뒤 잠깐 무적인 시간
const MAX_MONSTERS = 220;

// ---------- 작은 도구 함수들 ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function formatTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
// 좌표로 항상 같은 난수를 만드는 함수 (바닥 장식이 매번 같은 자리에 보이도록)
function seededRandom(a, b, c) {
  let s = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 982451653)) >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 4294967296;
  };
}

// ---------- 전체 게임 데이터 ----------
const G = {
  state: 'title',
  stateTime: 0,
  progress: null,  // 레벨, 경험치, 능력치 (스테이지를 넘어가도 유지)
  snapshot: null,  // 스테이지 시작 시점 저장본 (다시 하기용)
  stageIndex: 0,
};
const S = () => G.progress.stats;
const stage = () => STAGES[G.stageIndex];

function setState(s) {
  G.state = s;
  G.stateTime = 0;
}

// =====================================================
// 게임 흐름
// =====================================================

function newGame() {
  G.progress = { stats: baseStats(), level: 1, xp: 0, xpNext: 5, picks: {}, kills: 0 };
  startStory(PROLOGUE, () => startStage(0), 0);
}

function startStage(i) {
  G.stageIndex = i;
  G.snapshot = JSON.parse(JSON.stringify(G.progress));
  resetWorld();
  setState('play');
  G.banner = { text: stage().name, t: 0 };
}

function retryStage() {
  G.progress = JSON.parse(JSON.stringify(G.snapshot));
  startStage(G.stageIndex);
}

function resetWorld() {
  G.player = { x: 0, y: 0, fx: 1, fy: 0, dirX: 1, back: false, moving: false, t: 0, atkTimer: 0, swing: 0, swingDir: 1, skillTimer: 2 };
  G.follower = { x: -FOLLOW_DIST, y: 0, hp: S().followerMax, dirX: 1, back: false, moving: false, t: 0, flash: 0, iframe: 0 };
  G.trail = [{ x: -FOLLOW_DIST, y: 0 }, { x: 0, y: 0 }];
  G.monsters = [];
  G.gems = [];
  G.hearts = [];
  G.effects = [];
  G.particles = [];
  G.texts = [];
  G.cam = { x: 0, y: 0 };
  G.shake = 0;
  G.time = 0;
  G.spawnTimer = 1.0;
  G.boss = null;
  G.bossSpawned = false;
  G.orbAngle = 0;
  G.banner = null;
}

function stageClear() {
  setState('clear');
  Sound.clear();
  // 남은 몬스터는 빛과 함께 사라져요
  G.monsters.forEach((m) => burst(m.x, m.y - m.r, '#ffffff', 8));
  G.monsters = [];
  G.banner = null;
}

function gameOver() {
  setState('gameover');
  Sound.fail();
}

// =====================================================
// 스토리 (일러스트 + 대화창)
// =====================================================

function startStory(lines, onDone, bgIndex) {
  G.story = { lines, i: 0, shown: 0, onDone, bg: bgIndex, lineTime: 0 };
  setState('story');
}

function updateStory(dt) {
  const st = G.story;
  const line = st.lines[st.i];
  const before = Math.floor(st.shown);
  st.shown += dt * 38; // 글자가 한 글자씩 나오는 속도
  st.lineTime += dt;
  if (Math.floor(st.shown) !== before && st.shown < line.text.length && Math.floor(st.shown) % 2 === 0) Sound.text();

  if (Input.wasPressed('skip')) {
    st.onDone();
    return;
  }
  if (Input.wasPressed('confirm') && G.stateTime > 0.25) {
    if (st.shown < line.text.length) {
      st.shown = line.text.length; // 아직 다 안 나왔으면 한 번에 보여주기
    } else {
      st.i++;
      st.shown = 0;
      st.lineTime = 0;
      Sound.select();
      if (st.i >= st.lines.length) st.onDone();
    }
  }
}

// =====================================================
// 플레이 업데이트
// =====================================================

function updatePlay(dt) {
  G.time += dt;
  if (G.banner) G.banner.t += dt;

  updatePlayer(dt);
  updateFollower(dt);
  updateSpawns(dt);
  updateMonsters(dt);
  updateOrbs(dt);
  updatePickups(dt);
  updateEffects(dt);
  updateCamera(dt);

  const f = G.follower;
  f.hp = Math.min(S().followerMax, f.hp + S().regen * dt);

  if (f.hp <= 0) {
    f.hp = 0;
    gameOver();
    return;
  }

  // 스테이지 클리어 조건
  const st = stage();
  if (st.bossAt != null) {
    if (!G.bossSpawned && G.time >= st.bossAt) spawnBoss();
    if (G.bossSpawned && G.boss && G.boss.dead) { stageClear(); return; }
  } else if (G.time >= st.duration) {
    stageClear();
    return;
  }

  // 레벨업 확인
  const pg = G.progress;
  if (pg.xp >= pg.xpNext) {
    pg.xp -= pg.xpNext;
    pg.level++;
    pg.xpNext = Math.floor(pg.xpNext * 1.28 + 3);
    openLevelUp();
    return;
  }

  if (Input.wasPressed('pause')) setState('paused');
}

// ---------- 플레이어(레온) ----------
function updatePlayer(dt) {
  const p = G.player;
  const s = S();
  let ix = (Input.isDown('right') ? 1 : 0) - (Input.isDown('left') ? 1 : 0);
  let iy = (Input.isDown('down') ? 1 : 0) - (Input.isDown('up') ? 1 : 0);
  p.moving = ix !== 0 || iy !== 0;
  p.t += dt;
  if (p.moving) {
    const len = Math.hypot(ix, iy); // 대각선이 더 빠르지 않게 길이를 1로 맞춰요
    ix /= len; iy /= len;
    p.x += ix * s.speed * dt;
    p.y += iy * s.speed * dt;
    p.fx = ix; p.fy = iy;
    if (ix !== 0) p.dirX = Math.sign(ix);
    p.back = iy < 0;
  }

  // 지나간 길을 기록 → 루나가 이 길을 그대로 따라와요
  const last = G.trail[G.trail.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) > 4) {
    G.trail.push({ x: p.x, y: p.y });
    if (G.trail.length > 400) G.trail.shift();
  }

  // 공격 (Z)
  p.atkTimer -= dt;
  p.swing = Math.max(0, p.swing - dt / 0.18);
  if (Input.isDown('attack') && p.atkTimer <= 0) {
    p.atkTimer = s.atkCd;
    p.swing = 1;
    p.swingDir *= -1;
    slashAttack(p);
  }

  // 스킬 (X) : 루나를 중심으로 퍼지는 수호의 빛
  p.skillTimer -= dt;
  if (Input.wasPressed('skill') && p.skillTimer <= 0) {
    p.skillTimer = s.skillCd;
    guardianLight();
  }
}

function slashAttack(p) {
  const s = S();
  const ang = Math.atan2(p.fy, p.fx);
  Sound.swing();
  G.effects.push({ type: 'slash', ang, arc: s.arc, range: s.range, t: 0, life: 0.2, dir: p.swingDir });
  let hitAny = false;
  for (const m of G.monsters) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d > s.range + m.r) continue;
    const a = Math.atan2(m.y - p.y, m.x - p.x);
    if (d > m.r + PLAYER_R && Math.abs(angleDiff(a, ang)) > s.arc / 2) continue;
    const crit = Math.random() < 0.1;
    hurtMonster(m, s.dmg * rand(0.9, 1.1) * (crit ? 2 : 1), p.x, p.y, 380, crit);
    hitAny = true;
  }
  if (hitAny) Sound.hit();
}

function guardianLight() {
  const s = S();
  const f = G.follower;
  Sound.skill();
  G.shake = Math.max(G.shake, 8);
  G.effects.push({ type: 'ring', x: f.x, y: f.y, r: s.skillRadius, t: 0, life: 0.5 });
  for (const m of G.monsters) {
    if (m.dead) continue;
    if (Math.hypot(m.x - f.x, m.y - f.y) < s.skillRadius + m.r) {
      hurtMonster(m, s.skillDmg, f.x, f.y, 900, false);
    }
  }
}

// ---------- 보호 대상(루나) ----------
function updateFollower(dt) {
  const p = G.player, f = G.follower;
  f.t += dt;
  f.flash = Math.max(0, f.flash - dt);
  f.iframe = Math.max(0, f.iframe - dt);

  // 레온이 지나간 길을 거꾸로 FOLLOW_DIST 만큼 거슬러 올라간 지점이 루나의 목표 위치
  let need = FOLLOW_DIST;
  let ax = p.x, ay = p.y;
  let tx = ax, ty = ay;
  for (let i = G.trail.length - 1; i >= 0; i--) {
    const b = G.trail[i];
    const seg = Math.hypot(b.x - ax, b.y - ay);
    if (seg >= need) {
      const k = need / seg;
      tx = ax + (b.x - ax) * k;
      ty = ay + (b.y - ay) * k;
      need = 0;
      break;
    }
    need -= seg;
    ax = b.x; ay = b.y;
    tx = ax; ty = ay;
  }

  const dx = tx - f.x, dy = ty - f.y;
  const d = Math.hypot(dx, dy);
  const spd = Math.max(S().speed * 1.15, d * 6);
  if (d > 1) {
    const step = Math.min(d, spd * dt);
    f.x += (dx / d) * step;
    f.y += (dy / d) * step;
  }
  f.moving = d > 2;
  if (f.moving) {
    if (Math.abs(dx) > 0.5) f.dirX = Math.sign(dx);
    f.back = dy < -0.5 && Math.abs(dy) > Math.abs(dx);
  } else {
    f.dirX = p.x >= f.x ? 1 : -1;
    f.back = false;
  }
}

function hurtFollower(amount, fromX, fromY) {
  const f = G.follower;
  if (f.iframe > 0) return;
  f.hp -= amount;
  f.iframe = FOLLOWER_IFRAME;
  f.flash = 0.15;
  G.shake = Math.max(G.shake, 6);
  Sound.hurt();
  addText(f.x, f.y - 60, `-${Math.round(amount)}`, '#ff5a6e', 26);
  burst(f.x, f.y - 30, '#ff8fa3', 6);
}

// ---------- 몬스터 ----------
function updateSpawns(dt) {
  const st = stage();
  if (G.boss) {
    // 보스전에는 부하 몬스터가 조금만 나와요
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0) {
      G.spawnTimer = 2.2;
      for (let i = 0; i < 2; i++) spawnMonster(pickEnemyType(st));
    }
    return;
  }
  const total = st.bossAt != null ? st.bossAt : st.duration;
  const prog = clamp(G.time / total, 0, 1);
  G.spawnTimer -= dt;
  if (G.spawnTimer <= 0) {
    G.spawnTimer = lerp(st.spawnEvery[0], st.spawnEvery[1], prog);
    const count = Math.round(lerp(st.groupSize[0], st.groupSize[1], prog) + rand(-0.4, 0.4));
    const type = pickEnemyType(st);
    const baseAng = rand(0, Math.PI * 2);
    for (let i = 0; i < count; i++) spawnMonster(type, baseAng + rand(-0.35, 0.35));
  }
}

function pickEnemyType(st) {
  const list = st.enemies.filter((e) => !e.from || G.time >= e.from);
  let sum = list.reduce((a, e) => a + e.w, 0);
  let r = Math.random() * sum;
  for (const e of list) {
    r -= e.w;
    if (r <= 0) return e.type;
  }
  return list[0].type;
}

function spawnMonster(type, ang = rand(0, Math.PI * 2), force = false) {
  if (!force && G.monsters.length >= MAX_MONSTERS) return null;
  const def = MONSTER_TYPES[type];
  const p = G.player;
  // 화면 테두리 바로 바깥에서 등장
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const d = Math.min((W / 2 + 60) / Math.max(0.001, Math.abs(cos)), (H / 2 + 60) / Math.max(0.001, Math.abs(sin)));
  const hpMul = 1 + G.stageIndex * 0.45 + G.time / 120;
  const m = {
    type, def,
    x: p.x + cos * d,
    y: p.y + sin * d,
    r: def.r,
    hp: def.hp * hpMul,
    maxHp: def.hp * hpMul,
    kx: 0, ky: 0,           // 넉백(밀려남) 속도
    t: rand(0, 10),
    flash: 0,
    atkCd: 0,
    lookX: 1,
    wobble: rand(0, Math.PI * 2),
    orbCd: 0,
  };
  G.monsters.push(m);
  return m;
}

function spawnBoss() {
  G.bossSpawned = true;
  Sound.warning();
  G.banner = { text: '⚠ 그림자 기사 등장! ⚠', t: 0, warn: true };
  const m = spawnMonster('boss', rand(0, Math.PI * 2), true);
  const p = G.player;
  m.x = p.x + 500; m.y = p.y - 200;
  m.hp = m.maxHp = MONSTER_TYPES.boss.hp;
  m.state = 'walk';
  m.stateT = 0;
  m.moving = true;
  G.boss = m;
}

function updateBoss(m, dt) {
  const f = G.follower;
  m.stateT += dt;
  if (m.state === 'walk') {
    m.moving = true;
    const dx = f.x - m.x, dy = f.y - m.y, d = Math.hypot(dx, dy) || 1;
    m.x += (dx / d) * m.def.speed * dt;
    m.y += (dy / d) * m.def.speed * dt;
    m.lookX = dx >= 0 ? 1 : -1;
    if (m.stateT > 4.5) {
      // 돌진 준비: 루나 쪽을 조준
      m.state = 'aim';
      m.stateT = 0;
      m.aimAng = Math.atan2(dy, dx);
    }
  } else if (m.state === 'aim') {
    m.moving = false;
    if (m.stateT > 0.9) { m.state = 'dash'; m.stateT = 0; G.shake = 10; Sound.hurt(); }
  } else if (m.state === 'dash') {
    m.x += Math.cos(m.aimAng) * 560 * dt;
    m.y += Math.sin(m.aimAng) * 560 * dt;
    if (m.stateT > 0.6) {
      m.state = 'walk';
      m.stateT = 0;
      // 돌진이 끝나면 박쥐 부하를 불러요
      for (let i = 0; i < 3; i++) {
        const b = spawnMonster('bat');
        if (b) { b.x = m.x + rand(-60, 60); b.y = m.y + rand(-60, 60); }
      }
    }
  }
}

function updateMonsters(dt) {
  const f = G.follower, p = G.player;
  const ms = G.monsters;

  for (const m of ms) {
    m.t += dt;
    m.flash = Math.max(0, m.flash - dt);
    m.atkCd = Math.max(0, m.atkCd - dt);
    m.orbCd = Math.max(0, m.orbCd - dt);

    if (m.type === 'boss') {
      updateBoss(m, dt);
    } else {
      // 모든 몬스터는 루나를 노려요!
      let dx = f.x - m.x, dy = f.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      if (m.type === 'bat') {
        // 박쥐는 지그재그로 날아와요
        const w = Math.sin(m.t * 4 + m.wobble) * 0.7;
        const nx = dx - dy * w, ny = dy + dx * w;
        const nl = Math.hypot(nx, ny);
        dx = nx / nl; dy = ny / nl;
      }
      m.x += dx * m.def.speed * dt;
      m.y += dy * m.def.speed * dt;
      m.lookX = dx >= 0 ? 1 : -1;
    }

    // 넉백 적용 후 서서히 줄이기
    m.x += m.kx * dt;
    m.y += m.ky * dt;
    const decay = Math.exp(-9 * dt);
    m.kx *= decay; m.ky *= decay;

    // 레온은 몸으로 몬스터를 막을 수 있어요 (보스는 레온을 밀어내요)
    const pd = Math.hypot(m.x - p.x, m.y - p.y);
    const pmin = m.r + PLAYER_R;
    if (pd < pmin && pd > 0.01) {
      const push = pmin - pd;
      if (m.type === 'boss') {
        p.x -= ((m.x - p.x) / pd) * push;
        p.y -= ((m.y - p.y) / pd) * push;
      } else {
        m.x += ((m.x - p.x) / pd) * push;
        m.y += ((m.y - p.y) / pd) * push;
      }
    }

    // 루나에게 닿으면 피해
    const fd = Math.hypot(m.x - f.x, m.y - f.y);
    const fmin = m.r + FOLLOWER_R;
    if (fd < fmin) {
      if (m.atkCd <= 0) {
        hurtFollower(m.def.dmg, m.x, m.y);
        m.atkCd = 0.8;
      }
      if (fd > 0.01 && m.type !== 'boss') {
        m.x += ((m.x - f.x) / fd) * (fmin - fd);
        m.y += ((m.y - f.y) / fd) * (fmin - fd);
      }
    }
  }

  // 몬스터끼리 겹치지 않게 서로 밀어내기
  for (let i = 0; i < ms.length; i++) {
    const a = ms[i];
    for (let j = i + 1; j < ms.length; j++) {
      const b = ms[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const rr = (a.r + b.r) * 0.85;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const overlap = rr - d;
      const total = a.def.mass + b.def.mass;
      const ka = b.def.mass / total, kb = a.def.mass / total;
      a.x -= (dx / d) * overlap * ka;
      a.y -= (dy / d) * overlap * ka;
      b.x += (dx / d) * overlap * kb;
      b.y += (dy / d) * overlap * kb;
    }
  }

  // 너무 멀리 떨어진 몬스터는 플레이어 근처로 다시 데려와요
  for (const m of ms) {
    if (m.type !== 'boss' && Math.hypot(m.x - p.x, m.y - p.y) > 1400) {
      const a = rand(0, Math.PI * 2);
      m.x = p.x + Math.cos(a) * 800;
      m.y = p.y + Math.sin(a) * 800;
    }
  }

  G.monsters = ms.filter((m) => !m.dead);
}

function hurtMonster(m, dmg, fromX, fromY, knock, crit) {
  if (m.dead) return;
  m.hp -= dmg;
  m.flash = 0.1;
  const dx = m.x - fromX, dy = m.y - fromY, d = Math.hypot(dx, dy) || 1;
  m.kx += (dx / d) * knock / m.def.mass;
  m.ky += (dy / d) * knock / m.def.mass;
  addText(m.x + rand(-8, 8), m.y - m.r * 2 - 10, Math.round(dmg), crit ? '#ffd23f' : '#ffffff', crit ? 28 : 20);
  burst(m.x, m.y - m.r, '#ffffff', 3);
  if (m.hp <= 0) killMonster(m);
}

function killMonster(m) {
  m.dead = true;
  G.progress.kills++;
  Sound.kill();
  burst(m.x, m.y - m.r, m.def.color || '#b48cff', m.type === 'boss' ? 60 : 10);
  if (m.type === 'boss') {
    G.shake = 20;
    return;
  }
  G.gems.push({ x: m.x, y: m.y, v: m.def.xp, t: rand(0, 6), pull: false });
  if (Math.random() < 0.025) G.hearts.push({ x: m.x + 10, y: m.y, t: 0 });
}

// ---------- 수호 정령 (강화로 얻는 회전 구슬) ----------
function orbPositions() {
  const n = S().orbs;
  const f = G.follower;
  const list = [];
  for (let i = 0; i < n; i++) {
    const a = G.orbAngle + (i / n) * Math.PI * 2;
    list.push({ x: f.x + Math.cos(a) * 62, y: f.y - 20 + Math.sin(a) * 50 });
  }
  return list;
}

function updateOrbs(dt) {
  if (S().orbs <= 0) return;
  G.orbAngle += dt * 3.2;
  for (const o of orbPositions()) {
    for (const m of G.monsters) {
      if (m.dead || m.orbCd > 0) continue;
      if (Math.hypot(m.x - o.x, m.y - m.r - o.y) < m.r + 12) {
        hurtMonster(m, S().dmg * 0.6, o.x, o.y, 200, false);
        m.orbCd = 0.5;
      }
    }
  }
}

// ---------- 경험치 보석 & 하트 ----------
function updatePickups(dt) {
  const p = G.player;
  const pg = G.progress;
  for (const g of G.gems) {
    g.t += dt;
    const d = Math.hypot(p.x - g.x, p.y - g.y);
    if (d < S().magnet) g.pull = true;
    if (g.pull) {
      const sp = 500 + g.t * 200;
      g.x += ((p.x - g.x) / d) * Math.min(d, sp * dt);
      g.y += ((p.y - g.y) / d) * Math.min(d, sp * dt);
    }
    if (d < 20) {
      g.got = true;
      pg.xp += g.v;
      Sound.pickup();
    }
  }
  G.gems = G.gems.filter((g) => !g.got);

  const f = G.follower;
  for (const h of G.hearts) {
    h.t += dt;
    if (Math.hypot(p.x - h.x, p.y - h.y) < 30) {
      h.got = true;
      f.hp = Math.min(S().followerMax, f.hp + 20);
      Sound.heal();
      addText(f.x, f.y - 70, '+20', '#6cff8f', 26);
      burst(f.x, f.y - 30, '#8dffb0', 12);
    }
  }
  G.hearts = G.hearts.filter((h) => !h.got && h.t < 20);
}

// ---------- 이펙트 ----------
function addText(x, y, text, color, size) {
  G.texts.push({ x, y, text: String(text), color, size, t: 0, life: 0.7 });
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(60, 260);
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.25, 0.55), color, size: rand(2, 5) });
  }
}

function updateEffects(dt) {
  for (const e of G.effects) e.t += dt;
  G.effects = G.effects.filter((e) => e.t < e.life);
  for (const pt of G.particles) {
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92; pt.vy *= 0.92;
  }
  G.particles = G.particles.filter((pt) => pt.t < pt.life);
  for (const tx of G.texts) { tx.t += dt; tx.y -= 40 * dt; }
  G.texts = G.texts.filter((tx) => tx.t < tx.life);
  G.shake = Math.max(0, G.shake - dt * 30);
}

function updateCamera(dt) {
  const p = G.player;
  const k = 1 - Math.exp(-8 * dt);
  G.cam.x += (p.x - G.cam.x) * k;
  G.cam.y += (p.y - 20 - G.cam.y) * k;
}

// =====================================================
// 레벨업
// =====================================================

function openLevelUp() {
  const pg = G.progress;
  const pool = UPGRADES.filter((u) => (pg.picks[u.id] || 0) < u.max);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  G.levelUp = { choices: pool.slice(0, 3), sel: 0 };
  Sound.levelUp();
  setState('levelup');
}

function updateLevelUp() {
  const lu = G.levelUp;
  if (lu.choices.length === 0) {
    // 모든 강화를 다 찍었으면 루나 체력 회복으로 대신
    G.follower.hp = S().followerMax;
    setState('play');
    return;
  }
  if (Input.wasPressed('left')) { lu.sel = (lu.sel + lu.choices.length - 1) % lu.choices.length; Sound.select(); }
  if (Input.wasPressed('right')) { lu.sel = (lu.sel + 1) % lu.choices.length; Sound.select(); }
  // 공격 키를 연타하다가 실수로 고르지 않도록 잠깐 기다려요
  if (Input.wasPressed('confirm') && G.stateTime > 0.45) {
    const u = lu.choices[lu.sel];
    u.apply(S(), G);
    G.progress.picks[u.id] = (G.progress.picks[u.id] || 0) + 1;
    Sound.heal();
    setState('play');
  }
}

// =====================================================
// 메인 업데이트
// =====================================================

function update(dt) {
  G.stateTime += dt;
  if (Input.wasPressed('mute')) Sound.muted = !Sound.muted;

  switch (G.state) {
    case 'title':
      if (Input.wasPressed('confirm')) { Sound.select(); newGame(); }
      break;
    case 'story':
      updateStory(dt);
      break;
    case 'play':
      updatePlay(dt);
      break;
    case 'levelup':
      updateLevelUp();
      break;
    case 'paused':
      if (Input.wasPressed('pause') || Input.wasPressed('confirm')) setState('play');
      break;
    case 'clear':
      updateEffects(dt);
      updateFollower(dt);
      G.player.t += dt;
      if (G.stateTime > 2.6) {
        const next = G.stageIndex + 1;
        const after = next < STAGES.length ? () => startStage(next) : () => setState('ending');
        startStory(STAGE_STORIES[G.stageIndex], after, G.stageIndex);
      }
      break;
    case 'gameover':
      updateEffects(dt);
      if (G.stateTime > 1.0) {
        if (Input.wasPressed('confirm')) retryStage();
        else if (Input.wasPressed('back')) setState('title');
      }
      break;
    case 'ending':
      if (G.stateTime > 1.5 && Input.wasPressed('confirm')) setState('title');
      break;
  }
}

// =====================================================
// 그리기
// =====================================================

function drawGround() {
  const st = stage();
  const cam = G.cam;
  const left = cam.x - W / 2, top = cam.y - H / 2;
  const base = { forest: '#7cb85c', dusk: '#b7a25e', ruins: '#77718a' }[st.theme];
  ctx.fillStyle = base;
  ctx.fillRect(left - 50, top - 50, W + 100, H + 100);

  const CH = 256;
  const cx0 = Math.floor(left / CH) - 1, cx1 = Math.floor((left + W) / CH) + 1;
  const cy0 = Math.floor(top / CH) - 1, cy1 = Math.floor((top + H) / CH) + 1;

  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const rnd = seededRandom(cx, cy, G.stageIndex + 7);
      const ox = cx * CH, oy = cy * CH;
      if (st.theme === 'ruins') drawRuinTiles(ox, oy, CH, rnd);
      // 큰 얼룩
      for (let i = 0; i < 2; i++) {
        pathEllipse(ctx, ox + rnd() * CH, oy + rnd() * CH, 40 + rnd() * 50, 20 + rnd() * 25);
        ctx.fillStyle = st.theme === 'forest' ? '#71ab51' : st.theme === 'dusk' ? '#a8935a' : 'rgba(80,110,70,0.35)';
        ctx.fill();
      }
      // 풀
      ctx.strokeStyle = st.theme === 'forest' ? '#4e8a39' : st.theme === 'dusk' ? '#8a7a40' : '#5d7a52';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const gx = ox + rnd() * CH, gy = oy + rnd() * CH;
        ctx.beginPath();
        ctx.moveTo(gx - 4, gy); ctx.lineTo(gx - 6, gy - 7);
        ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - 10);
        ctx.moveTo(gx + 4, gy); ctx.lineTo(gx + 6, gy - 7);
        ctx.stroke();
      }
      // 꽃 / 돌
      for (let i = 0; i < 4; i++) {
        const fx = ox + rnd() * CH, fy = oy + rnd() * CH, kind = rnd();
        if (kind < 0.6 && st.theme !== 'ruins') {
          const col = ['#ffffff', '#ffe066', '#ff9ec7', '#ff7b5c'][Math.floor(rnd() * 4)];
          ctx.fillStyle = col;
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2;
            pathEllipse(ctx, fx + Math.cos(a) * 3.5, fy + Math.sin(a) * 3.5, 2.8, 2.8); ctx.fill();
          }
          pathEllipse(ctx, fx, fy, 2, 2); ctx.fillStyle = '#ffcf3a'; ctx.fill();
        } else {
          pathEllipse(ctx, fx, fy, 7 + rnd() * 7, 5 + rnd() * 3);
          fillStroke(ctx, st.theme === 'ruins' ? '#5d5870' : '#9a9aa6', 1.5, 'rgba(40,30,50,0.5)');
        }
      }
    }
  }
}

function drawRuinTiles(ox, oy, CH, rnd) {
  const T = 64;
  for (let x = 0; x < CH; x += T) {
    for (let y = 0; y < CH; y += T) {
      const v = rnd();
      ctx.fillStyle = v < 0.2 ? '#6c667e' : v < 0.35 ? '#827c95' : '#77718a';
      ctx.fillRect(ox + x + 1, oy + y + 1, T - 2, T - 2);
      if (v > 0.9) {
        ctx.strokeStyle = '#4d475f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox + x + 10, oy + y + 12);
        ctx.lineTo(ox + x + 30, oy + y + 28);
        ctx.lineTo(ox + x + 26, oy + y + 50);
        ctx.stroke();
      }
    }
  }
}

function drawSlash(e) {
  const p = G.player;
  const prog = e.t / e.life;
  const ease = 1 - Math.pow(1 - Math.min(1, prog * 1.6), 3);
  const a0 = e.ang - (e.arc / 2) * e.dir;
  const a1 = a0 + e.arc * e.dir * ease;
  ctx.save();
  ctx.translate(p.x, p.y - 16);
  ctx.beginPath();
  ctx.arc(0, 0, e.range, a0, a1, e.dir < 0);
  ctx.arc(0, 0, e.range * 0.45, a1, a0, e.dir > 0);
  ctx.closePath();
  const g = ctx.createRadialGradient(0, 0, e.range * 0.4, 0, 0, e.range);
  g.addColorStop(0, 'rgba(180,230,255,0)');
  g.addColorStop(0.7, `rgba(200,240,255,${0.55 * (1 - prog)})`);
  g.addColorStop(1, `rgba(255,255,255,${0.95 * (1 - prog)})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function drawWorld() {
  const shx = rand(-G.shake, G.shake), shy = rand(-G.shake, G.shake);
  ctx.save();
  ctx.translate(Math.round(W / 2 - G.cam.x + shx), Math.round(H / 2 - G.cam.y + shy));

  drawGround();

  // 수호의 빛 범위 미리보기 (스킬 준비되면 루나 발밑에 희미하게)
  const f = G.follower;
  if (G.player.skillTimer <= 0 && G.state === 'play') {
    pathEllipse(ctx, f.x, f.y, S().skillRadius, S().skillRadius * 0.5);
    ctx.strokeStyle = `rgba(255,240,180,${0.25 + Math.sin(G.time * 5) * 0.1})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 보석, 하트
  for (const g of G.gems) {
    const bob = Math.sin(g.t * 4) * 2;
    ctx.save();
    ctx.translate(g.x, g.y - 6 + bob);
    ctx.beginPath();
    const s = g.v > 1 ? 8 : 6;
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0); ctx.closePath();
    fillStroke(ctx, g.v > 1 ? '#5dffb0' : '#6ad7ff', 1.5, '#1f4a6b');
    ctx.restore();
  }
  for (const h of G.hearts) {
    if (h.t > 16 && Math.floor(h.t * 8) % 2 === 0) continue; // 사라지기 전 깜빡임
    ctx.save();
    ctx.translate(h.x, h.y - 10 + Math.sin(h.t * 4) * 3);
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-14, -4, -6, -14, 0, -6);
    ctx.bezierCurveTo(6, -14, 14, -4, 0, 6);
    fillStroke(ctx, '#ff5a7a', 2);
    ctx.restore();
  }

  // 보스 돌진 경고선
  if (G.boss && !G.boss.dead && G.boss.state === 'aim') {
    const b = G.boss;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.aimAng);
    ctx.fillStyle = `rgba(255,40,70,${0.18 + Math.sin(G.time * 30) * 0.08})`;
    ctx.fillRect(0, -b.r, 560 * 0.6, b.r * 2);
    ctx.restore();
  }

  // 수호의 빛 이펙트 (바닥)
  for (const e of G.effects) {
    if (e.type !== 'ring') continue;
    const k = e.t / e.life;
    pathEllipse(ctx, e.x, e.y, e.r * (0.3 + k * 0.7), e.r * 0.5 * (0.3 + k * 0.7));
    ctx.fillStyle = `rgba(255,240,170,${0.35 * (1 - k)})`;
    ctx.fill();
    ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.strokeStyle = `rgba(255,255,220,${1 - k})`;
    ctx.stroke();
  }

  // 캐릭터와 몬스터를 y좌표 순서로 그려요 (아래쪽에 있는 게 앞에 보이도록)
  const p = G.player;
  const list = [
    { y: p.y, draw: () => Art.hero(ctx, { ...p, flash: false }) },
    { y: f.y, draw: () => Art.luna(ctx, { ...f, flash: f.flash > 0 }) },
  ];
  for (const m of G.monsters) list.push({ y: m.y, draw: () => drawMonster(m) });
  list.sort((a, b) => a.y - b.y);
  list.forEach((o) => o.draw());

  // 루나 머리 위 체력바
  const hpw = 44;
  const ratio = clamp(f.hp / S().followerMax, 0, 1);
  pathRRect(ctx, f.x - hpw / 2, f.y - 78, hpw, 7, 3);
  fillStroke(ctx, '#2b2233', 0);
  pathRRect(ctx, f.x - hpw / 2 + 1, f.y - 77, (hpw - 2) * ratio, 5, 2);
  ctx.fillStyle = ratio > 0.5 ? '#6cff8f' : ratio > 0.25 ? '#ffd23f' : '#ff5a6e';
  ctx.fill();

  // 수호 정령
  if (S().orbs > 0) {
    for (const o of orbPositions()) {
      const g = ctx.createRadialGradient(o.x, o.y, 1, o.x, o.y, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(200,170,255,0.9)');
      g.addColorStop(1, 'rgba(160,120,255,0)');
      ctx.fillStyle = g;
      pathEllipse(ctx, o.x, o.y, 16, 16);
      ctx.fill();
    }
  }

  for (const e of G.effects) if (e.type === 'slash') drawSlash(e);

  for (const pt of G.particles) {
    ctx.globalAlpha = 1 - pt.t / pt.life;
    ctx.fillStyle = pt.color;
    pathEllipse(ctx, pt.x, pt.y, pt.size, pt.size);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  for (const tx of G.texts) {
    ctx.globalAlpha = 1 - Math.pow(tx.t / tx.life, 2);
    ctx.font = `${tx.size}px ${FONT_TITLE}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2b2233';
    ctx.strokeText(tx.text, tx.x, tx.y);
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.text, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // 스테이지 분위기 색 덧칠
  const tint = { forest: null, dusk: 'rgba(255,110,60,0.12)', ruins: 'rgba(50,20,90,0.22)' }[stage().theme];
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
}

function drawMonster(m) {
  Art[m.def.draw](ctx, { ...m, flash: m.flash > 0 });
  // 단단한 몬스터는 맞으면 체력바 표시
  if ((m.type === 'golem') && m.hp < m.maxHp) {
    const w = 36, y = m.y - m.r * 2.3;
    ctx.fillStyle = '#2b2233';
    ctx.fillRect(m.x - w / 2, y, w, 5);
    ctx.fillStyle = '#ff7b5c';
    ctx.fillRect(m.x - w / 2 + 1, y + 1, (w - 2) * clamp(m.hp / m.maxHp, 0, 1), 3);
  }
}

// ---------- HUD (화면 위 정보) ----------
function drawBar(x, y, w, h, ratio, color, back = 'rgba(20,14,30,0.75)') {
  pathRRect(ctx, x, y, w, h, h / 2);
  fillStroke(ctx, back, 2.5, '#ffffff');
  if (ratio > 0) {
    pathRRect(ctx, x + 3, y + 3, Math.max(h - 6, (w - 6) * clamp(ratio, 0, 1)), h - 6, (h - 6) / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function drawText(text, x, y, size, color = '#fff', align = 'left', font = FONT_TITLE, outline = 5) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = '#2b2233';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawHUD() {
  const f = G.follower, pg = G.progress, st = stage(), p = G.player;
  const t = G.time;

  // 루나 얼굴 + 체력
  ctx.save();
  pathEllipse(ctx, 62, 62, 44, 44);
  ctx.fillStyle = '#3a2d52';
  ctx.fill();
  ctx.clip();
  Art.portrait(ctx, 'luna', 62, 170, 0.36, f.hp / S().followerMax < 0.3 ? 'worry' : 'normal', t);
  ctx.restore();
  pathEllipse(ctx, 62, 62, 44, 44);
  ctx.lineWidth = 4; ctx.strokeStyle = f.flash > 0 ? '#ff5a6e' : '#ffffff'; ctx.stroke();

  const ratio = f.hp / S().followerMax;
  drawText(CHARACTERS.luna.name, 116, 46, 24, '#ffd6ec');
  drawBar(116, 56, 300, 26, ratio, ratio > 0.5 ? '#6cff8f' : ratio > 0.25 ? '#ffd23f' : '#ff5a6e');
  drawText(`${Math.ceil(f.hp)} / ${S().followerMax}`, 266, 76, 18, '#fff', 'center', FONT_TITLE, 4);

  // 가운데: 스테이지 이름 + 남은 시간 or 보스 체력
  drawText(st.name, W / 2, 38, 24, '#ffffff', 'center');
  if (G.boss && !G.boss.dead) {
    drawText('그림자 기사', W / 2, 66, 20, '#ff9bb0', 'center');
    drawBar(W / 2 - 250, 74, 500, 20, G.boss.hp / G.boss.maxHp, '#ff4d6d');
  } else if (st.bossAt != null && !G.bossSpawned) {
    drawText(`보스 출현까지 ${formatTime(st.bossAt - G.time)}`, W / 2, 72, 26, '#ffd23f', 'center');
  } else {
    drawText(formatTime(st.duration - G.time), W / 2, 76, 38, '#ffffff', 'center');
  }

  // 오른쪽: 레벨, 처치 수
  drawText(`Lv. ${pg.level}`, W - 24, 46, 32, '#ffe27a', 'right');
  drawText(`처치 ${pg.kills}`, W - 24, 78, 20, '#ffffff', 'right');

  // 아래쪽: 경험치 바
  drawBar(20, H - 30, W - 40, 16, pg.xp / pg.xpNext, '#6ad7ff');

  // 왼쪽 아래: 스킬 아이콘
  const sx = 60, sy = H - 90, r = 34;
  const cd = clamp(p.skillTimer / S().skillCd, 0, 1);
  pathEllipse(ctx, sx, sy, r, r);
  ctx.fillStyle = cd <= 0 ? '#ffe79a' : '#5b4d70';
  ctx.fill();
  if (cd > 0) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,231,154,0.6)';
    ctx.fill();
  }
  pathEllipse(ctx, sx, sy, r, r);
  ctx.lineWidth = 3.5; ctx.strokeStyle = cd <= 0 ? '#ffffff' : '#a99cc0'; ctx.stroke();
  drawText('✨', sx, sy + 10, 28, '#fff', 'center', FONT_TITLE, 0);
  drawText('X', sx + 26, sy + 30, 20, '#ffffff', 'center');
  drawText(cd <= 0 ? '수호의 빛 준비!' : `${Math.ceil(p.skillTimer)}초`, sx + 48, sy + 8, 18, cd <= 0 ? '#ffe79a' : '#cfc4e0', 'left', FONT_TITLE, 4);

  // 루나 체력이 낮으면 화면 가장자리가 빨갛게
  if (ratio < 0.3) {
    const a = 0.25 + Math.sin(G.time * 8) * 0.12;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
    g.addColorStop(0, 'rgba(255,0,40,0)');
    g.addColorStop(1, `rgba(255,0,40,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 스테이지 시작 / 보스 경고 배너
  if (G.banner && G.banner.t < 2.6) {
    const b = G.banner;
    const a = b.t < 0.3 ? b.t / 0.3 : b.t > 2.1 ? (2.6 - b.t) / 0.5 : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = b.warn ? 'rgba(120,0,30,0.6)' : 'rgba(20,14,30,0.55)';
    ctx.fillRect(0, H / 2 - 60, W, 100);
    drawText(b.text, W / 2, H / 2 + 8, 52, b.warn ? '#ff9bb0' : '#ffffff', 'center');
    ctx.globalAlpha = 1;
  }
}

function wrapText(text, maxWidth) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        lines.push(line);
        line = ch === ' ' ? '' : ch;
      } else {
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawLevelUp() {
  ctx.fillStyle = 'rgba(15,10,25,0.7)';
  ctx.fillRect(0, 0, W, H);
  const pop = Math.min(1, G.stateTime * 4);
  drawText('LEVEL UP!', W / 2, 150, 72 * (0.7 + 0.3 * pop), '#ffe27a', 'center', FONT_TITLE, 8);
  drawText('←  →  로 고르고  Z 로 결정', W / 2, 200, 24, '#ffffff', 'center');

  const lu = G.levelUp;
  const cw = 300, ch = 320, gap = 40;
  const total = lu.choices.length * cw + (lu.choices.length - 1) * gap;
  lu.choices.forEach((u, i) => {
    const x = W / 2 - total / 2 + i * (cw + gap);
    const sel = i === lu.sel;
    const y = 250 + (sel ? -14 + Math.sin(G.stateTime * 6) * 3 : 0);
    pathRRect(ctx, x, y, cw, ch, 24);
    fillStroke(ctx, sel ? '#fff6dc' : '#e9e2f5', sel ? 6 : 3, sel ? '#ffb83f' : '#2b2233');
    drawText(u.icon, x + cw / 2, y + 100, 64, '#fff', 'center', FONT_TITLE, 0);
    drawText(u.name, x + cw / 2, y + 160, 32, '#3a2d52', 'center', FONT_TITLE, 0);
    const lv = G.progress.picks[u.id] || 0;
    drawText(`Lv.${lv} → ${lv + 1}`, x + cw / 2, y + 195, 20, '#a07a2a', 'center', FONT_TITLE, 0);
    ctx.font = `22px ${FONT_BODY}`;
    u.desc.split('\n').forEach((line, k) => {
      drawText(line, x + cw / 2, y + 240 + k * 30, 22, '#3a2d52', 'center', FONT_BODY, 0);
    });
  });
}

// ---------- 스토리 화면 ----------
function drawStory() {
  const st = G.story;
  const line = st.lines[Math.min(st.i, st.lines.length - 1)];
  const t = G.stateTime;
  const sky = STAGES[st.bg].sky;

  // 배경
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, H, sky[0], sky[1]);
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 24; i++) {
    const x = (i * 173 + t * 12 * ((i % 3) + 1)) % (W + 40) - 20;
    const y = (i * 97) % H + Math.sin(t + i) * 10;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + (i % 4) * 0.05})`;
    pathEllipse(ctx, x, y, 3 + (i % 3) * 2, 3 + (i % 3) * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 0, W, H);

  // 일러스트: 말하는 사람은 밝고 조금 크게, 아닌 사람은 어둡게
  const speaker = line.who;
  const pop = Math.min(1, st.lineTime * 6);
  [['leon', 300], ['luna', W - 300]].forEach(([who, x]) => {
    const isSpeaker = speaker === who;
    const face = isSpeaker ? line.face : 'normal';
    const lift = isSpeaker ? -10 * pop : 0;
    const scale = isSpeaker ? 1.08 : 1.0;
    Art.portrait(ctx, who, x, H - 100 + lift, scale, face, t, !isSpeaker);
  });

  // 대화창
  const bx = 80, by = H - 210, bw = W - 160, bh = 180;
  pathRRect(ctx, bx, by, bw, bh, 22);
  fillStroke(ctx, 'rgba(25,18,40,0.88)', 4, '#ffffff');

  if (speaker) {
    const c = CHARACTERS[speaker];
    const nx = speaker === 'leon' ? bx + 30 : bx + bw - 210;
    pathRRect(ctx, nx, by - 26, 180, 48, 16);
    fillStroke(ctx, c.color, 4, '#ffffff');
    drawText(c.name, nx + 90, by + 9, 30, '#ffffff', 'center', FONT_TITLE, 0);
  }

  ctx.font = `30px ${FONT_BODY}`;
  const shownText = line.text.slice(0, Math.floor(st.shown));
  const lines = wrapText(shownText, bw - 100);
  lines.forEach((l, i) => {
    drawText(l, bx + 50, by + 70 + i * 44, 30, speaker ? '#ffffff' : '#e8dcff', 'left', FONT_BODY, 0);
  });

  if (st.shown >= line.text.length && Math.floor(t * 2.5) % 2 === 0) {
    drawText('▼', bx + bw - 40, by + bh - 22, 24, '#ffe27a', 'center', FONT_TITLE, 0);
  }
  drawText('Z: 다음   ESC: 건너뛰기', W - 30, 34, 18, 'rgba(255,255,255,0.8)', 'right', FONT_TITLE, 4);
}

// ---------- 타이틀 / 엔딩 / 게임오버 ----------
function drawTitle() {
  const t = G.stateTime;
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, H, '#2a1f45', '#6e4c8f');
  ctx.fillRect(0, 0, W, H);
  // 별
  for (let i = 0; i < 60; i++) {
    const x = (i * 211) % W, y = (i * 137) % (H * 0.6);
    ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(t * 2 + i)})`;
    pathEllipse(ctx, x, y, 1.5, 1.5); ctx.fill();
  }
  // 달
  pathEllipse(ctx, W - 200, 140, 70, 70);
  ctx.fillStyle = '#fff3c4'; ctx.fill();
  pathEllipse(ctx, W - 175, 125, 64, 64);
  ctx.fillStyle = '#3a2a5a'; ctx.fill();

  // 언덕
  ctx.fillStyle = '#3e6b4a';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 220);
  ctx.quadraticCurveTo(W * 0.3, H - 300, W * 0.6, H - 230);
  ctx.quadraticCurveTo(W * 0.85, H - 180, W, H - 240);
  ctx.lineTo(W, H);
  ctx.fill();

  // 걸어가는 두 사람
  ctx.save();
  ctx.translate(W / 2 + 40, H - 120);
  ctx.scale(2.6, 2.6);
  Art.luna(ctx, { x: -40, y: 0, t, moving: true, dirX: 1, back: false, flash: false });
  Art.hero(ctx, { x: 10, y: 0, t: t + 0.2, moving: true, dirX: 1, back: false, flash: false, swing: 0 });
  ctx.restore();

  const bob = Math.sin(t * 2) * 6;
  drawText('수호자의 길', W / 2, 200 + bob, 104, '#fff3c4', 'center', FONT_TITLE, 10);
  drawText('~ 달의 무녀를 지켜라 ~', W / 2, 255 + bob, 30, '#e8dcff', 'center', FONT_TITLE, 6);

  if (Math.floor(t * 2) % 2 === 0) drawText('Z 키를 눌러 시작', W / 2, 340, 34, '#ffffff', 'center');
  drawText('방향키: 이동   Z: 공격   X: 수호의 빛   ESC: 일시정지   M: 소리 끄기', W / 2, H - 24, 20, 'rgba(255,255,255,0.85)', 'center', FONT_TITLE, 4);
}

function drawGameOver() {
  const a = Math.min(1, G.stateTime / 0.8);
  ctx.fillStyle = `rgba(20,5,15,${0.75 * a})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = a;
  Art.portrait(ctx, 'luna', W / 2, H + 60, 0.9, 'worry', G.stateTime);
  drawText('루나를 지키지 못했다…', W / 2, 200, 64, '#ff9bb0', 'center', FONT_TITLE, 8);
  if (G.stateTime > 1.0) {
    drawText('Z : 이 스테이지 다시 하기     X : 타이틀로', W / 2, 270, 28, '#ffffff', 'center');
  }
  ctx.globalAlpha = 1;
}

function drawEnding() {
  const t = G.stateTime;
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, H, '#ffcf9e', '#ffeccf');
  ctx.fillRect(0, 0, W, H);
  // 떠오르는 해
  pathEllipse(ctx, W / 2, H - 120 - Math.min(80, t * 20), 160, 160);
  ctx.fillStyle = 'rgba(255,240,170,0.9)'; ctx.fill();
  Art.portrait(ctx, 'leon', W / 2 - 230, H + 40, 0.95, 'smile', t);
  Art.portrait(ctx, 'luna', W / 2 + 230, H + 40, 0.95, 'smile', t);
  drawText('THE END', W / 2, 150, 96, '#ffffff', 'center', FONT_TITLE, 10);
  drawText(`최종 레벨 ${G.progress.level}   ·   쓰러뜨린 몬스터 ${G.progress.kills}마리`, W / 2, 210, 28, '#ffffff', 'center');
  drawText('플레이해 줘서 고마워요!', W / 2, 255, 26, '#fff3c4', 'center');
  if (t > 1.5 && Math.floor(t * 2) % 2 === 0) drawText('Z : 타이틀로', W / 2, 300, 26, '#ffffff', 'center');
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);

  switch (G.state) {
    case 'title':
      drawTitle();
      break;
    case 'story':
      drawStory();
      break;
    case 'play':
    case 'levelup':
    case 'paused':
    case 'clear':
    case 'gameover':
      drawWorld();
      if (G.state !== 'gameover') drawHUD();
      if (G.state === 'levelup') drawLevelUp();
      if (G.state === 'paused') {
        ctx.fillStyle = 'rgba(15,10,25,0.6)';
        ctx.fillRect(0, 0, W, H);
        drawText('일시정지', W / 2, H / 2, 72, '#ffffff', 'center', FONT_TITLE, 8);
        drawText('ESC 또는 Z 를 눌러 계속하기', W / 2, H / 2 + 50, 26, '#ffffff', 'center');
      }
      if (G.state === 'clear') {
        const k = Math.min(1, G.stateTime * 3);
        ctx.fillStyle = `rgba(255,250,220,${0.25 * k})`;
        ctx.fillRect(0, 0, W, H);
        drawText('STAGE CLEAR!', W / 2, H / 2 - 20, 60 + 30 * k, '#ffe27a', 'center', FONT_TITLE, 10);
      }
      if (G.state === 'gameover') drawGameOver();
      break;
    case 'ending':
      drawEnding();
      break;
  }

  if (Sound.muted) drawText('🔇', W - 30, H - 50, 24, '#fff', 'right', FONT_TITLE, 0);
}

// =====================================================
// 게임 루프 시작!
// =====================================================
let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000); // 렉이 걸려도 한 번에 너무 많이 움직이지 않게
  lastTime = now;
  update(dt);
  render();
  Input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 개발용: 브라우저 콘솔에서 G 를 입력하면 게임 상태를 볼 수 있어요
window.G = G;
