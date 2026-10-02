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
//   play 중 히나코 체력 0 → gameover
//   play / story / levelup 중 ESC → paused(일시정지 메뉴) → 원래 상태로 복귀
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
const FOLLOW_DIST = 54;     // 히나코가 시오리 뒤로 얼마나 떨어져서 따라오는지
const FOLLOWER_IFRAME = 0.35; // 히나코가 맞은 뒤 잠깐 무적인 시간
const MAX_MONSTERS = 220;

// ---------- 손맛(타격감·조작감) 설정 ----------
// 숫자를 바꿔 보면서 마음에 드는 느낌을 찾아보세요!
const FEEL = {
  hitstop: 0.045,       // 때렸을 때 화면이 멈추는 시간(초) — 타격감의 핵심
  hitstopCrit: 0.075,   // 치명타일 때 멈추는 시간
  hitstopHeavy: 0.09,   // 오니처럼 큰 요괴를 쓰러뜨렸을 때
  hitstopBoss: 0.45,    // 보스를 쓰러뜨렸을 때
  knockback: 620,       // 손톱에 맞은 요괴가 밀려나는 힘
  lunge: 260,           // 공격할 때 앞으로 내딛는 힘
  swingTime: 0.13,      // 손톱 휘두르는 동작 시간
  aimRange: 110,        // 자동 조준: 공격 범위 + 이만큼 안의 가장 가까운 요괴를 노려요
  dashSpeed: 950,       // 대시 속도
  dashTime: 0.15,       // 대시 지속 시간
  dashCooldown: 0.7,    // 대시 대기 시간
  inputBuffer: 0.18,    // 공격 키를 미리 눌러도 이 시간 동안 기억해요
  camFollow: 12,        // 카메라가 따라오는 빠르기 (클수록 딱 붙어요)
  camLead: 45,          // 이동 방향으로 카메라가 살짝 앞서가는 거리
};

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
  G.player = {
    x: 0, y: 0, fx: 1, fy: 0, dirX: 1, back: false, moving: false, t: 0,
    atkTimer: 0, swing: 0, swingDir: 1, claw: 0, skillTimer: 2,
    vx: 0, vy: 0,                         // 내딛기 등으로 생기는 추가 속도
    dashT: 0, dashCd: 0, dashVx: 0, dashVy: 0, ghostT: 0,
    atkBuffer: 0,
  };
  G.follower = { x: -FOLLOW_DIST, y: 0, hp: S().followerMax, dirX: 1, back: false, moving: false, t: 0, flash: 0, iframe: 0 };
  G.trail = [{ x: -FOLLOW_DIST, y: 0 }, { x: 0, y: 0 }];
  G.monsters = [];
  G.gems = [];
  G.hearts = [];
  G.effects = [];
  G.particles = [];
  G.texts = [];
  G.cam = { x: 0, y: 0 };
  G.camLead = { x: 0, y: 0 };
  G.shake = 0;
  G.hitstop = 0;
  G.ghosts = [];
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

  if (Input.wasPressed('pause')) {
    openPause();
    return;
  }
  const clicked = Input.mouse.clicked;
  if (Input.wasPressed('skip') || (clicked && isHover(SKIP_BTN))) {
    Sound.select();
    st.onDone();
    return;
  }
  // Z 키 또는 화면 아무 곳이나 클릭하면 다음 대사로
  if ((Input.wasPressed('confirm') || clicked) && G.stateTime > 0.25) {
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

function addHitstop(t) {
  G.hitstop = Math.max(G.hitstop, t);
}

function updatePlay(dt) {
  // 히트스톱: 때린 순간 아주 잠깐 모든 게 멈춰요 (화면 흔들림만 계속)
  if (G.hitstop > 0) {
    G.hitstop -= dt;
    if (Input.wasPressed('attack')) G.player.atkBuffer = FEEL.inputBuffer;
    if (Input.wasPressed('pause')) openPause();
    return;
  }
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

  if (Input.wasPressed('pause')) openPause();
}

// ---------- 플레이어(시오리) ----------
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
    p.fx = ix; p.fy = iy;
    if (p.dashT <= 0) {
      p.x += ix * s.speed * dt;
      p.y += iy * s.speed * dt;
    }
    // 공격 중에는 공격 방향을 바라보게 두고, 아닐 때만 이동 방향을 봐요
    if (ix !== 0 && p.swing <= 0) p.dirX = Math.sign(ix);
    if (p.swing <= 0) p.back = iy < 0;
  }

  // 대시 (C): 짧게 휙! 대시 중엔 요괴 사이를 통과해요
  p.dashCd -= dt;
  if (Input.wasPressed('dash') && p.dashCd <= 0) {
    p.dashT = FEEL.dashTime;
    p.dashCd = FEEL.dashCooldown;
    p.dashVx = p.fx * FEEL.dashSpeed;
    p.dashVy = p.fy * FEEL.dashSpeed;
    p.ghostT = 0;
    Sound.dash();
    burst(p.x, p.y - 10, '#bfefff', 6);
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dashVx * dt;
    p.y += p.dashVy * dt;
    // 잔상 남기기
    p.ghostT -= dt;
    if (p.ghostT <= 0) {
      p.ghostT = 0.025;
      G.ghosts.push({ x: p.x, y: p.y, dirX: p.dirX, back: p.back, t: 0, life: 0.22, pt: p.t, claw: p.claw });
    }
  }

  // 내딛기 등으로 생긴 추가 속도 (빠르게 줄어들어요)
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const decay = Math.exp(-14 * dt);
  p.vx *= decay; p.vy *= decay;

  // 지나간 길을 기록 → 히나코가 이 길을 그대로 따라와요
  const last = G.trail[G.trail.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) > 4) {
    G.trail.push({ x: p.x, y: p.y });
    if (G.trail.length > 400) G.trail.shift();
  }

  // 공격 (Z)
  p.atkTimer -= dt;
  p.atkBuffer -= dt;
  if (Input.wasPressed('attack')) p.atkBuffer = FEEL.inputBuffer; // 조금 일찍 눌러도 기억해 둬요
  p.swing = Math.max(0, p.swing - dt / FEEL.swingTime);
  p.claw = Math.max(0, p.claw - dt); // 공격을 멈추고 조금 지나면 팔이 사람 모습으로 돌아와요
  if ((Input.isDown('attack') || p.atkBuffer > 0) && p.atkTimer <= 0) {
    p.atkBuffer = 0;
    p.atkTimer = s.atkCd;
    p.swing = 1;
    p.claw = 1.5;
    p.swingDir *= -1;
    slashAttack(p);
  }

  // 스킬 (X) : 히나코를 중심으로 퍼지는 파도 장벽
  p.skillTimer -= dt;
  if (Input.wasPressed('skill') && p.skillTimer <= 0) {
    p.skillTimer = s.skillCd;
    guardianLight();
  }
}

// 자동 조준: 가까운 요괴 쪽으로 휘둘러요. 없으면 바라보는 방향으로.
function findAimTarget(p) {
  const maxD = S().range + FEEL.aimRange;
  let best = null, bestD = maxD;
  for (const m of G.monsters) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - p.x, m.y - p.y) - m.r;
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

function slashAttack(p) {
  const s = S();
  const target = findAimTarget(p);
  const ang = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(p.fy, p.fx);
  const ax = Math.cos(ang), ay = Math.sin(ang);
  // 공격 방향을 바라보고, 앞으로 살짝 내딛기
  p.aimAng = ang;
  if (Math.abs(ax) > 0.2) p.dirX = Math.sign(ax);
  p.back = ay < -0.6;
  p.vx += ax * FEEL.lunge;
  p.vy += ay * FEEL.lunge;
  G.cam.x += ax * 4; // 카메라도 살짝 앞으로 툭
  G.cam.y += ay * 4;
  Sound.swing();
  G.effects.push({ type: 'slash', ang, arc: s.arc, range: s.range, t: 0, life: 0.2, dir: p.swingDir });
  let hits = 0, crits = 0;
  for (const m of G.monsters) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d > s.range + m.r) continue;
    const a = Math.atan2(m.y - p.y, m.x - p.x);
    if (d > m.r + PLAYER_R && Math.abs(angleDiff(a, ang)) > s.arc / 2) continue;
    const crit = Math.random() < 0.1;
    hurtMonster(m, s.dmg * rand(0.9, 1.1) * (crit ? 2 : 1), p.x, p.y, FEEL.knockback, crit);
    G.effects.push({ type: 'spark', x: m.x, y: m.y - m.r, ang: a, t: 0, life: 0.12, big: crit });
    hits++;
    if (crit) crits++;
  }
  if (hits > 0) {
    Sound.hit();
    addHitstop(crits > 0 ? FEEL.hitstopCrit : FEEL.hitstop);
    G.shake = Math.max(G.shake, crits > 0 ? 6 : 3 + Math.min(hits, 4) * 0.5);
  }
}

function guardianLight() {
  const s = S();
  const f = G.follower;
  Sound.skill();
  G.shake = Math.max(G.shake, 10);
  addHitstop(0.08);
  G.flashScreen = 0.15;
  G.effects.push({ type: 'ring', x: f.x, y: f.y, r: s.skillRadius, t: 0, life: 0.5 });
  for (const m of G.monsters) {
    if (m.dead) continue;
    if (Math.hypot(m.x - f.x, m.y - f.y) < s.skillRadius + m.r) {
      hurtMonster(m, s.skillDmg, f.x, f.y, 900, false);
    }
  }
}

// ---------- 보호 대상(히나코) ----------
function updateFollower(dt) {
  const p = G.player, f = G.follower;
  f.t += dt;
  f.flash = Math.max(0, f.flash - dt);
  f.iframe = Math.max(0, f.iframe - dt);

  // 시오리가 지나간 길을 거꾸로 FOLLOW_DIST 만큼 거슬러 올라간 지점이 히나코의 목표 위치
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
  G.banner = { text: '⚠ 굶주린 대요괴 등장! ⚠', t: 0, warn: true };
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
      // 돌진 준비: 히나코 쪽을 조준
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
      // 돌진이 끝나면 귀신불 부하를 불러요
      for (let i = 0; i < 3; i++) {
        const b = spawnMonster('wisp');
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
      // 모든 요괴는 히나코를 노려요!
      let dx = f.x - m.x, dy = f.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      if (m.type === 'wisp') {
        // 귀신불은 지그재그로 날아와요
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

    // 시오리는 몸으로 요괴를 막을 수 있어요 (보스는 시오리를 밀어내요)
    const pd = Math.hypot(m.x - p.x, m.y - p.y);
    const pmin = m.r + PLAYER_R;
    if (pd < pmin && pd > 0.01 && G.player.dashT <= 0) {
      const push = pmin - pd;
      if (m.type === 'boss') {
        p.x -= ((m.x - p.x) / pd) * push;
        p.y -= ((m.y - p.y) / pd) * push;
      } else {
        m.x += ((m.x - p.x) / pd) * push;
        m.y += ((m.y - p.y) / pd) * push;
      }
    }

    // 히나코에게 닿으면 피해
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
  m.hitDx = dx / d; m.hitDy = dy / d; // 처치될 때 이 방향으로 터져요
  addText(m.x + rand(-8, 8), m.y - m.r * 2 - 10, Math.round(dmg), crit ? '#ffd23f' : '#ffffff', crit ? 28 : 20);
  burst(m.x, m.y - m.r, '#ffffff', 3);
  if (m.hp <= 0) killMonster(m);
}

function killMonster(m) {
  m.dead = true;
  G.progress.kills++;
  Sound.kill();
  burst(m.x, m.y - m.r, m.def.color || '#b48cff', m.type === 'boss' ? 60 : 8);
  // 맞은 방향으로 파편이 튀어요
  const hx = m.hitDx || 0, hy = m.hitDy || 0;
  for (let i = 0; i < 10; i++) {
    const sp = rand(200, 520);
    const a = Math.atan2(hy, hx) + rand(-0.6, 0.6);
    G.particles.push({ x: m.x, y: m.y - m.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.25, 0.45), color: i % 2 ? '#ffffff' : (m.def.color || '#b48cff'), size: rand(2.5, 5) });
  }
  G.effects.push({ type: 'pop', x: m.x, y: m.y - m.r, r: m.r * 2.2, t: 0, life: 0.22 });
  if (m.type === 'boss') {
    G.shake = 24;
    addHitstop(FEEL.hitstopBoss);
    return;
  }
  if (m.def.mass >= 3) {
    addHitstop(FEEL.hitstopHeavy);
    G.shake = Math.max(G.shake, 8);
  } else {
    G.shake = Math.max(G.shake, 4);
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
  for (const gh of G.ghosts) gh.t += dt;
  G.ghosts = G.ghosts.filter((gh) => gh.t < gh.life);
  G.flashScreen = Math.max(0, (G.flashScreen || 0) - dt);
  G.shake = Math.max(0, G.shake - dt * 30);
}

function updateCamera(dt) {
  const p = G.player;
  // 이동하는 방향을 조금 더 보여주도록 카메라가 살짝 앞서가요
  const lk = 1 - Math.exp(-3 * dt);
  const lx = p.moving ? p.fx * FEEL.camLead : 0, ly = p.moving ? p.fy * FEEL.camLead : 0;
  G.camLead.x += (lx - G.camLead.x) * lk;
  G.camLead.y += (ly - G.camLead.y) * lk;
  const k = 1 - Math.exp(-FEEL.camFollow * dt);
  G.cam.x += (p.x + G.camLead.x - G.cam.x) * k;
  G.cam.y += (p.y - 20 + G.camLead.y - G.cam.y) * k;
}

// =====================================================
// 버튼 & 일시정지 메뉴
// =====================================================

// 스토리 화면 오른쪽 위 "건너뛰기" 버튼 위치
const SKIP_BTN = { x: W - 210, y: 22, w: 180, h: 52 };

const PAUSE_ITEMS = [
  { id: 'resume', label: '계속하기' },
  { id: 'title', label: '메인화면으로' },
  { id: 'quit', label: '게임 종료' },
];
function pauseButtonRect(i) {
  return { x: W / 2 - 180, y: 270 + i * 92, w: 360, h: 72 };
}

// 마우스가 버튼 위에 있는지 확인
function isHover(b) {
  const m = Input.mouse;
  return m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;
}

function openPause() {
  // 지금 상태를 기억해 두고, 메뉴를 닫으면 그대로 돌아가요
  G.pause = { from: G.state, sel: 0, t: 0 };
  G.state = 'paused';
  G.shake = 0;
  Sound.select();
}

function closePause() {
  G.state = G.pause.from;
  Input.pressed.clear(); // 메뉴를 닫은 키가 게임에 바로 전달되지 않게
}

function updatePause(dt) {
  const pm = G.pause;
  pm.t += dt;
  if (Input.wasPressed('pause')) { closePause(); return; }

  const n = PAUSE_ITEMS.length;
  if (Input.wasPressed('up')) { pm.sel = (pm.sel + n - 1) % n; Sound.select(); }
  if (Input.wasPressed('down')) { pm.sel = (pm.sel + 1) % n; Sound.select(); }

  let chosen = -1;
  PAUSE_ITEMS.forEach((item, i) => {
    const r = pauseButtonRect(i);
    if (Input.mouse.moved && isHover(r) && pm.sel !== i) { pm.sel = i; Sound.select(); }
    if (Input.mouse.clicked && isHover(r)) chosen = i;
  });
  if (Input.wasPressed('confirm') && pm.t > 0.15) chosen = pm.sel;
  if (chosen < 0) return;

  const id = PAUSE_ITEMS[chosen].id;
  if (id === 'resume') closePause();
  else if (id === 'title') { Sound.select(); setState('title'); }
  else if (id === 'quit') quitGame();
}

function quitGame() {
  // 브라우저 보안 때문에 탭이 안 닫힐 수도 있어요. 그럴 땐 종료 화면을 보여줘요.
  setState('quit');
  try { window.close(); } catch (e) { /* 닫기 실패해도 괜찮아요 */ }
}

function drawButton(r, label, selected, color = '#3a2d52') {
  const lift = selected ? -3 : 0;
  pathRRect(ctx, r.x, r.y + lift, r.w, r.h, r.h / 2);
  fillStroke(ctx, selected ? '#fff6dc' : '#e9e2f5', selected ? 5 : 3, selected ? '#ffb83f' : '#2b2233');
  drawText(label, r.x + r.w / 2, r.y + lift + r.h / 2 + 11, 32, color, 'center', FONT_TITLE, 0);
  if (selected) drawText('▶', r.x + 36, r.y + lift + r.h / 2 + 10, 26, '#ffb83f', 'center', FONT_TITLE, 0);
}

function drawPauseMenu() {
  ctx.fillStyle = 'rgba(15,10,25,0.7)';
  ctx.fillRect(0, 0, W, H);
  drawText('일시정지', W / 2, 200, 76, '#ffffff', 'center', FONT_TITLE, 8);
  PAUSE_ITEMS.forEach((item, i) => {
    drawButton(pauseButtonRect(i), item.label, i === G.pause.sel, item.id === 'quit' ? '#b8354e' : '#3a2d52');
  });
  drawText('↑ ↓ 고르기   Z 결정   ESC 계속하기   (마우스 클릭도 돼요)', W / 2, H - 60, 22, 'rgba(255,255,255,0.85)', 'center', FONT_TITLE, 4);
}

function drawQuit() {
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(0, 0, W, H);
  drawText('게임을 종료했어요', W / 2, H / 2 - 20, 56, '#ffffff', 'center', FONT_TITLE, 0);
  drawText('이제 브라우저 탭을 닫아도 돼요.', W / 2, H / 2 + 36, 26, '#cfc4e0', 'center', FONT_BODY, 0);
  if (G.stateTime > 1 && Math.floor(G.stateTime * 2) % 2 === 0) {
    drawText('다시 하려면 Z 키', W / 2, H / 2 + 110, 24, '#ffe27a', 'center', FONT_TITLE, 0);
  }
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
  if (Input.wasPressed('pause')) { openPause(); return; }
  const lu = G.levelUp;
  if (lu.choices.length === 0) {
    // 모든 강화를 다 찍었으면 히나코 체력 회복으로 대신
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
  if (G.state !== 'paused') G.stateTime += dt; // 일시정지 중엔 시간이 멈춰요
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
      updatePause(dt);
      break;
    case 'quit':
      if (G.stateTime > 1 && Input.wasPressed('confirm')) setState('title');
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

// 스테이지별 바닥 색
const GROUND = {
  street: { base: '#9a9ca6', patch: 'rgba(70,72,84,0.18)' }, // 하굣길 아스팔트
  beach: { base: '#e8cc98', patch: 'rgba(170,130,80,0.22)' }, // 바닷가 모래사장
  shrine: { base: '#8c8896', patch: 'rgba(60,80,60,0.25)' },  // 신사 자갈 마당
};

function drawGround() {
  const st = stage();
  const cam = G.cam;
  const left = cam.x - W / 2, top = cam.y - H / 2;
  const theme = GROUND[st.theme];
  ctx.fillStyle = theme.base;
  ctx.fillRect(left - 50, top - 50, W + 100, H + 100);

  // 바닥을 256px 크기의 칸(청크)으로 나눠서, 칸마다 같은 장식을 그려요
  const CH = 256;
  const cx0 = Math.floor(left / CH) - 1, cx1 = Math.floor((left + W) / CH) + 1;
  const cy0 = Math.floor(top / CH) - 1, cy1 = Math.floor((top + H) / CH) + 1;

  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const rnd = seededRandom(cx, cy, G.stageIndex + 7);
      const ox = cx * CH, oy = cy * CH;
      for (let i = 0; i < 2; i++) {
        pathEllipse(ctx, ox + rnd() * CH, oy + rnd() * CH, 40 + rnd() * 50, 20 + rnd() * 25);
        ctx.fillStyle = theme.patch;
        ctx.fill();
      }
      if (st.theme === 'street') drawStreetChunk(ox, oy, CH, cx, cy, rnd);
      else if (st.theme === 'beach') drawBeachChunk(ox, oy, CH, rnd);
      else drawShrineChunk(ox, oy, CH, cx, rnd);
    }
  }
}

function drawStreetChunk(ox, oy, CH, cx, cy, rnd) {
  // 차선 (세 칸마다 한 줄씩 이어져요)
  if (((cy % 3) + 3) % 3 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let x = 0; x < CH; x += 96) ctx.fillRect(ox + x + 10, oy + CH / 2 - 3, 52, 6);
  }
  // 횡단보도
  if (rnd() < 0.08) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 6; i++) ctx.fillRect(ox + 30 + i * 32, oy + 40, 18, 90);
  }
  // 맨홀
  if (rnd() < 0.3) {
    const mx = ox + rnd() * CH, my = oy + rnd() * CH;
    pathEllipse(ctx, mx, my, 16, 9);
    fillStroke(ctx, '#7c7e88', 2, '#5a5c66');
    ctx.strokeStyle = '#6a6c76'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mx - 10, my); ctx.lineTo(mx + 10, my); ctx.moveTo(mx, my - 6); ctx.lineTo(mx, my + 6); ctx.stroke();
  }
  // 갈라진 틈
  ctx.strokeStyle = 'rgba(60,60,70,0.35)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const x = ox + rnd() * CH, y = oy + rnd() * CH;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10 + rnd() * 10, y + 6); ctx.lineTo(x + 18 + rnd() * 10, y + 2); ctx.stroke();
  }
  // 떨어진 벚꽃잎
  ctx.fillStyle = '#ffc6d8';
  for (let i = 0; i < 6; i++) {
    pathEllipse(ctx, ox + rnd() * CH, oy + rnd() * CH, 3.5, 2, rnd() * Math.PI);
    ctx.fill();
  }
  // 틈새 풀
  ctx.strokeStyle = '#6f8f55'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const gx = ox + rnd() * CH, gy = oy + rnd() * CH;
    ctx.beginPath();
    ctx.moveTo(gx - 3, gy); ctx.lineTo(gx - 5, gy - 6);
    ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - 8);
    ctx.moveTo(gx + 3, gy); ctx.lineTo(gx + 5, gy - 6);
    ctx.stroke();
  }
}

function drawBeachChunk(ox, oy, CH, rnd) {
  // 조개껍데기
  for (let i = 0; i < 3; i++) {
    const x = ox + rnd() * CH, y = oy + rnd() * CH;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.arc(x, y + 4, 7, Math.PI * 1.1, Math.PI * 1.9);
    ctx.closePath();
    fillStroke(ctx, ['#fff4ea', '#ffd3d3', '#f6e0c0'][i % 3], 1.3, 'rgba(120,80,60,0.6)');
  }
  // 불가사리
  if (rnd() < 0.35) {
    const x = ox + rnd() * CH, y = oy + rnd() * CH;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = k % 2 === 0 ? 9 : 4;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
    }
    ctx.closePath();
    fillStroke(ctx, '#ff8a5c', 1.4, 'rgba(120,50,30,0.6)');
  }
  // 조약돌
  for (let i = 0; i < 4; i++) {
    pathEllipse(ctx, ox + rnd() * CH, oy + rnd() * CH, 4 + rnd() * 4, 3 + rnd() * 2);
    ctx.fillStyle = '#b9ab95'; ctx.fill();
  }
  // 떠밀려 온 해초
  ctx.strokeStyle = '#5f8a4e'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  if (rnd() < 0.5) {
    const x = ox + rnd() * CH, y = oy + rnd() * CH;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 8, y - 6, x + 16, y); ctx.quadraticCurveTo(x + 24, y + 6, x + 30, y);
    ctx.stroke();
  }
}

function drawShrineChunk(ox, oy, CH, cx, rnd) {
  // 자갈
  ctx.fillStyle = 'rgba(70,66,80,0.35)';
  for (let i = 0; i < 40; i++) {
    pathEllipse(ctx, ox + rnd() * CH, oy + rnd() * CH, 1.8, 1.4);
    ctx.fill();
  }
  // 참배길 돌판 (네 칸마다 세로로 이어져요)
  if (((cx % 4) + 4) % 4 === 0) {
    for (let y = 0; y < CH; y += 64) {
      pathRRect(ctx, ox + CH / 2 - 40, oy + y + 6, 80, 52, 6);
      fillStroke(ctx, '#a7a3ad', 2, 'rgba(60,55,70,0.6)');
    }
  }
  // 낙엽
  for (let i = 0; i < 5; i++) {
    pathEllipse(ctx, ox + rnd() * CH, oy + rnd() * CH, 5, 2.6, rnd() * Math.PI);
    ctx.fillStyle = ['#d9653b', '#e8a03a', '#b8442e'][i % 3];
    ctx.fill();
  }
  // 이끼 낀 돌
  if (rnd() < 0.5) {
    const x = ox + rnd() * CH, y = oy + rnd() * CH;
    pathEllipse(ctx, x, y, 12, 8);
    fillStroke(ctx, '#77737f', 1.5, 'rgba(40,30,50,0.5)');
    pathEllipse(ctx, x - 3, y - 4, 6, 3);
    ctx.fillStyle = '#6f8f55'; ctx.fill();
  }
}

// 손톱 공격 이펙트: 세 줄 할퀸 자국
function drawSlash(e) {
  const p = G.player;
  const prog = e.t / e.life;
  const ease = 1 - Math.pow(1 - Math.min(1, prog * 1.6), 3);
  const a0 = e.ang - (e.arc / 2) * e.dir;
  const a1 = a0 + e.arc * e.dir * ease;
  ctx.save();
  ctx.translate(p.x, p.y - 16);
  ctx.lineCap = 'round';
  [0.6, 0.78, 0.96].forEach((k) => {
    ctx.beginPath();
    ctx.arc(0, 0, e.range * k, a0, a1, e.dir < 0);
    ctx.strokeStyle = `rgba(110,215,255,${0.5 * (1 - prog)})`;
    ctx.lineWidth = 9 * (1 - prog) + 2;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * (1 - prog)})`;
    ctx.lineWidth = 3.5 * (1 - prog) + 1;
    ctx.stroke();
  });
  ctx.restore();
}

function drawWorld() {
  const shx = rand(-G.shake, G.shake), shy = rand(-G.shake, G.shake);
  ctx.save();
  ctx.translate(Math.round(W / 2 - G.cam.x + shx), Math.round(H / 2 - G.cam.y + shy));

  drawGround();

  // 파도 장벽 범위 미리보기 (스킬 준비되면 히나코 발밑에 희미하게)
  const f = G.follower;
  if (G.player.skillTimer <= 0 && G.state === 'play') {
    pathEllipse(ctx, f.x, f.y, S().skillRadius, S().skillRadius * 0.5);
    ctx.strokeStyle = `rgba(170,230,255,${0.35 + Math.sin(G.time * 5) * 0.1})`;
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

  // 파도 장벽 이펙트 (바닥)
  for (const e of G.effects) {
    if (e.type !== 'ring') continue;
    const k = e.t / e.life;
    pathEllipse(ctx, e.x, e.y, e.r * (0.3 + k * 0.7), e.r * 0.5 * (0.3 + k * 0.7));
    ctx.fillStyle = `rgba(90,190,240,${0.35 * (1 - k)})`;
    ctx.fill();
    ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.strokeStyle = `rgba(225,248,255,${1 - k})`;
    ctx.stroke();
    // 안쪽 물결
    pathEllipse(ctx, e.x, e.y, e.r * 0.75 * (0.3 + k * 0.7), e.r * 0.375 * (0.3 + k * 0.7));
    ctx.lineWidth = 3 * (1 - k) + 0.5;
    ctx.strokeStyle = `rgba(140,215,255,${0.8 * (1 - k)})`;
    ctx.stroke();
  }

  // 대시 잔상
  for (const gh of G.ghosts) {
    ctx.globalAlpha = 0.45 * (1 - gh.t / gh.life);
    Art.shiori(ctx, { x: gh.x, y: gh.y, t: gh.pt, moving: true, dirX: gh.dirX, back: gh.back, flash: true, swing: 0, claw: gh.claw });
  }
  ctx.globalAlpha = 1;

  // 캐릭터와 몬스터를 y좌표 순서로 그려요 (아래쪽에 있는 게 앞에 보이도록)
  const p = G.player;
  const list = [
    { y: p.y, draw: () => Art.shiori(ctx, { ...p, flash: false }) },
    { y: f.y, draw: () => Art.hinako(ctx, { ...f, flash: f.flash > 0 }) },
  ];
  for (const m of G.monsters) list.push({ y: m.y, draw: () => drawMonster(m) });
  list.sort((a, b) => a.y - b.y);
  list.forEach((o) => o.draw());

  // 히나코 머리 위 체력바
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
      g.addColorStop(0.4, 'rgba(150,220,255,0.9)');
      g.addColorStop(1, 'rgba(80,170,240,0)');
      ctx.fillStyle = g;
      pathEllipse(ctx, o.x, o.y, 16, 16);
      ctx.fill();
    }
  }

  for (const e of G.effects) {
    if (e.type === 'slash') drawSlash(e);
    else if (e.type === 'spark') drawSpark(e);
    else if (e.type === 'pop') {
      const k = e.t / e.life;
      pathEllipse(ctx, e.x, e.y, e.r * (0.4 + k * 0.8), e.r * (0.4 + k * 0.8));
      ctx.lineWidth = 5 * (1 - k) + 0.5;
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.stroke();
    }
  }

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
    const popScale = 1 + 0.6 * Math.max(0, 1 - tx.t / 0.1);
    ctx.font = `${Math.round(tx.size * popScale)}px ${FONT_TITLE}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2b2233';
    ctx.strokeText(tx.text, tx.x, tx.y);
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.text, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // 스테이지 분위기 색 덧칠
  const tint = { street: null, beach: 'rgba(255,110,60,0.14)', shrine: 'rgba(20,20,80,0.3)' }[stage().theme];
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }

  // 스킬을 쓰면 화면이 순간 하얗게 번쩍
  if (G.flashScreen > 0) {
    ctx.fillStyle = `rgba(220,245,255,${G.flashScreen / 0.15 * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// 타격 불꽃: 맞은 자리에 X자 모양 빛이 번쩍
function drawSpark(e) {
  const k = e.t / e.life;
  const len = (e.big ? 34 : 24) * (0.6 + k * 0.6);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.ang);
  ctx.globalAlpha = 1 - k;
  ctx.lineCap = 'round';
  ctx.strokeStyle = e.big ? '#ffe46b' : '#ffffff';
  ctx.lineWidth = (e.big ? 6 : 4) * (1 - k) + 1;
  ctx.beginPath();
  ctx.moveTo(-len, 0); ctx.lineTo(len, 0);
  ctx.moveTo(0, -len * 0.45); ctx.lineTo(0, len * 0.45);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawMonster(m) {
  Art[m.def.draw](ctx, { ...m, flash: m.flash > 0 });
  // 단단한 몬스터는 맞으면 체력바 표시
  if ((m.type === 'oni') && m.hp < m.maxHp) {
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

  // 히나코 얼굴 + 체력
  ctx.save();
  pathEllipse(ctx, 62, 62, 44, 44);
  ctx.fillStyle = '#3a2d52';
  ctx.fill();
  ctx.clip();
  Art.portrait(ctx, 'hinako', 62, 170, 0.36, f.hp / S().followerMax < 0.3 ? 'worry' : 'normal', t);
  ctx.restore();
  pathEllipse(ctx, 62, 62, 44, 44);
  ctx.lineWidth = 4; ctx.strokeStyle = f.flash > 0 ? '#ff5a6e' : '#ffffff'; ctx.stroke();

  const ratio = f.hp / S().followerMax;
  drawText(CHARACTERS.hinako.name, 116, 46, 24, '#ffe2c8');
  drawBar(116, 56, 300, 26, ratio, ratio > 0.5 ? '#6cff8f' : ratio > 0.25 ? '#ffd23f' : '#ff5a6e');
  drawText(`${Math.ceil(f.hp)} / ${S().followerMax}`, 266, 76, 18, '#fff', 'center', FONT_TITLE, 4);

  // 가운데: 스테이지 이름 + 남은 시간 or 보스 체력
  drawText(st.name, W / 2, 38, 24, '#ffffff', 'center');
  if (G.boss && !G.boss.dead) {
    drawText(MONSTER_TYPES.boss.name, W / 2, 66, 20, '#ff9bb0', 'center');
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
  ctx.fillStyle = cd <= 0 ? '#9fe3ff' : '#4d5a70';
  ctx.fill();
  if (cd > 0) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd));
    ctx.closePath();
    ctx.fillStyle = 'rgba(159,227,255,0.6)';
    ctx.fill();
  }
  pathEllipse(ctx, sx, sy, r, r);
  ctx.lineWidth = 3.5; ctx.strokeStyle = cd <= 0 ? '#ffffff' : '#a99cc0'; ctx.stroke();
  drawText('🌊', sx, sy + 10, 28, '#fff', 'center', FONT_TITLE, 0);
  drawText('X', sx + 26, sy + 30, 20, '#ffffff', 'center');
  drawText(cd <= 0 ? '파도 장벽 준비!' : `${Math.ceil(p.skillTimer)}초`, sx + 48, sy + 8, 18, cd <= 0 ? '#9fe3ff' : '#cfc4e0', 'left', FONT_TITLE, 4);

  // 대시 아이콘
  const dx = 60, dy = H - 168, dr = 24;
  const dcd = clamp(p.dashCd / FEEL.dashCooldown, 0, 1);
  pathEllipse(ctx, dx, dy, dr, dr);
  ctx.fillStyle = dcd <= 0 ? '#c9f1ff' : '#4d5a70';
  ctx.fill();
  if (dcd > 0) {
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.arc(dx, dy, dr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - dcd));
    ctx.closePath();
    ctx.fillStyle = 'rgba(201,241,255,0.6)';
    ctx.fill();
  }
  pathEllipse(ctx, dx, dy, dr, dr);
  ctx.lineWidth = 3; ctx.strokeStyle = dcd <= 0 ? '#ffffff' : '#a99cc0'; ctx.stroke();
  drawText('»', dx, dy + 9, 30, dcd <= 0 ? '#2c3e6b' : '#cfc4e0', 'center', FONT_TITLE, 0);
  drawText('C', dx + 20, dy + 22, 18, '#ffffff', 'center');
  drawText('대시', dx + 38, dy + 7, 18, '#cfe7ff', 'left', FONT_TITLE, 4);

  // 히나코 체력이 낮으면 화면 가장자리가 빨갛게
  if (ratio < 0.3) {
    const a = 0.25 + Math.sin(G.time * 8) * 0.12;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
    g.addColorStop(0, 'rgba(255,0,40,0)');
    g.addColorStop(1, `rgba(255,0,40,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 스테이지 시작 / 보스 경고 배너
  if (G.banner && G.banner.t < 2.6 && G.state !== 'paused') {
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
  [['shiori', 300], ['hinako', W - 300]].forEach(([who, x]) => {
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
    const nx = speaker === 'shiori' ? bx + 30 : bx + bw - 210;
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
  // 오른쪽 위 건너뛰기 버튼
  const hover = isHover(SKIP_BTN) && G.state === 'story';
  const b = SKIP_BTN;
  pathRRect(ctx, b.x, b.y, b.w, b.h, b.h / 2);
  fillStroke(ctx, hover ? 'rgba(255,246,220,0.95)' : 'rgba(25,18,40,0.75)', 3, hover ? '#ffb83f' : '#ffffff');
  drawText('건너뛰기 ▶▶', b.x + b.w / 2, b.y + 35, 26, hover ? '#3a2d52' : '#ffffff', 'center', FONT_TITLE, 0);
  drawText('S 키', b.x + b.w / 2, b.y + b.h + 24, 18, 'rgba(255,255,255,0.85)', 'center', FONT_TITLE, 4);
  drawText('Z / 클릭: 다음   ESC: 메뉴', 30, 40, 20, 'rgba(255,255,255,0.85)', 'left', FONT_TITLE, 4);
}

// ---------- 타이틀 / 엔딩 / 게임오버 ----------
function drawTitle() {
  const t = G.stateTime;
  // 밤바다 하늘
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, H * 0.55, '#1c2147', '#6a5596');
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {
    const x = (i * 211) % W, y = (i * 137) % (H * 0.45);
    ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(t * 2 + i)})`;
    pathEllipse(ctx, x, y, 1.5, 1.5); ctx.fill();
  }
  // 달
  const moonX = W - 220;
  pathEllipse(ctx, moonX, 130, 60, 60);
  ctx.fillStyle = '#fff6d6'; ctx.fill();
  // 바다
  const seaTop = H * 0.52;
  ctx.fillStyle = linGrad(ctx, 0, seaTop, 0, H - 150, '#3a5d9c', '#1c2f5c');
  ctx.fillRect(0, seaTop, W, H - 150 - seaTop);
  // 달빛이 바다에 비쳐 반짝반짝
  for (let i = 0; i < 14; i++) {
    const y = seaTop + 8 + i * 13;
    const w = 70 - i * 3 + Math.sin(t * 3 + i) * 10;
    ctx.fillStyle = `rgba(255,246,214,${0.55 - i * 0.03})`;
    ctx.fillRect(moonX - w / 2 + Math.sin(t * 2 + i * 1.7) * 6, y, w, 3);
  }
  // 잔물결
  ctx.strokeStyle = 'rgba(160,200,255,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const x = ((i * 157 + t * 20) % (W + 60)) - 30, y = seaTop + 20 + ((i * 53) % 150);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 12, y - 4, x + 24, y); ctx.stroke();
  }
  // 모래사장
  ctx.fillStyle = '#d9bf8c';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 150);
  ctx.quadraticCurveTo(W * 0.5, H - 175 + Math.sin(t * 1.5) * 4, W, H - 150);
  ctx.lineTo(W, H);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, H - 150);
  ctx.quadraticCurveTo(W * 0.5, H - 175 + Math.sin(t * 1.5) * 4, W, H - 150);
  ctx.stroke();

  // 나란히 걸어가는 두 사람
  ctx.save();
  ctx.translate(W / 2 + 40, H - 70);
  ctx.scale(2.6, 2.6);
  Art.hinako(ctx, { x: -40, y: 0, t, moving: true, dirX: 1, back: false, flash: false });
  Art.shiori(ctx, { x: 10, y: 0, t: t + 0.2, moving: true, dirX: 1, back: false, flash: false, swing: 0, claw: 0 });
  ctx.restore();

  const bob = Math.sin(t * 2) * 6;
  drawText('지켜줄게요, 히나코', W / 2, 170 + bob, 92, '#e6f4ff', 'center', FONT_TITLE, 10);
  drawText('~ 「나를 먹고 싶은, 괴물」 팬게임 ~', W / 2, 225 + bob, 28, '#d8d0ff', 'center', FONT_TITLE, 6);

  if (Math.floor(t * 2) % 2 === 0) drawText('Z 키를 눌러 시작', W / 2, 310, 34, '#ffffff', 'center');
  drawText('방향키: 이동   Z: 손톱 공격   X: 파도 장벽   C: 대시   ESC: 메뉴   M: 소리', W / 2, H - 20, 20, 'rgba(255,255,255,0.9)', 'center', FONT_TITLE, 4);
}

function drawGameOver() {
  const a = Math.min(1, G.stateTime / 0.8);
  ctx.fillStyle = `rgba(20,5,15,${0.75 * a})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = a;
  Art.portrait(ctx, 'hinako', W / 2, H + 60, 0.9, 'worry', G.stateTime);
  drawText('히나코를 지키지 못했다…', W / 2, 200, 64, '#ff9bb0', 'center', FONT_TITLE, 8);
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
  Art.portrait(ctx, 'shiori', W / 2 - 230, H + 40, 0.95, 'smirk', t);
  Art.portrait(ctx, 'hinako', W / 2 + 230, H + 40, 0.95, 'smile', t);
  drawText('THE END', W / 2, 150, 96, '#ffffff', 'center', FONT_TITLE, 10);
  drawText(`최종 레벨 ${G.progress.level}   ·   쓰러뜨린 몬스터 ${G.progress.kills}마리`, W / 2, 210, 28, '#ffffff', 'center');
  drawText('플레이해 줘서 고마워요!', W / 2, 255, 26, '#fff3c4', 'center');
  if (t > 1.5 && Math.floor(t * 2) % 2 === 0) drawText('Z : 타이틀로', W / 2, 300, 26, '#ffffff', 'center');
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (G.state === 'paused') {
    drawScene(G.pause.from); // 멈춘 화면을 뒤에 그대로 보여주고
    drawPauseMenu();         // 그 위에 메뉴를 덮어요
  } else {
    drawScene(G.state);
  }

  if (Sound.muted) drawText('🔇', W - 30, H - 50, 24, '#fff', 'right', FONT_TITLE, 0);
}

function drawScene(state) {
  switch (state) {
    case 'title':
      drawTitle();
      break;
    case 'story':
      drawStory();
      break;
    case 'play':
    case 'levelup':
    case 'clear':
    case 'gameover':
      drawWorld();
      if (state !== 'gameover') drawHUD();
      if (state === 'levelup') drawLevelUp();
      if (state === 'clear') {
        const k = Math.min(1, G.stateTime * 3);
        ctx.fillStyle = `rgba(255,250,220,${0.25 * k})`;
        ctx.fillRect(0, 0, W, H);
        drawText('STAGE CLEAR!', W / 2, H / 2 - 20, 60 + 30 * k, '#ffe27a', 'center', FONT_TITLE, 10);
      }
      if (state === 'gameover') drawGameOver();
      break;
    case 'ending':
      drawEnding();
      break;
    case 'quit':
      drawQuit();
      break;
  }
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
