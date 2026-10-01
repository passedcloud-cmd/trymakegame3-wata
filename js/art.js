// =====================================================
// art.js — 캐릭터, 요괴, 대화 일러스트를 "코드로" 그려요.
// 픽셀이 아니라 도형(원, 곡선)으로 그리기 때문에 확대해도 매끈해요.
// 직접 그린 그림(PNG)이 준비되면 이 파일의 그림을 이미지로 바꿀 거예요.
// =====================================================

const OUTLINE = '#2b2233';

// 오래된 브라우저용: roundRect가 없으면 직접 만들어 줘요
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(Array.isArray(r) ? r[0] : r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

// ---------- 도형 도우미 ----------
function pathEllipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}
function pathRRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function fillStroke(ctx, fill, lw = 2.5, stroke = OUTLINE) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}
function shadow(ctx, x, y, rx, ry = rx * 0.35) {
  pathEllipse(ctx, x, y, rx, ry);
  ctx.fillStyle = 'rgba(20, 10, 30, 0.25)';
  ctx.fill();
}
function linGrad(ctx, x0, y0, x1, y1, c0, c1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}
// 눈 깜빡임: 약 3.5초마다 0.12초 동안 감아요
function isBlinking(t, offset = 0) {
  return ((t + offset) % 3.5) < 0.12;
}

// 맞았을 때 하얗게 번쩍이는 색
const FLASH = '#ffffff';

const Art = {};

// =====================================================
// 1) 게임 화면 속 캐릭터 (작은 크기, 탑다운 시점)
//    o = { x, y, t(시간), moving, dirX(1 오른쪽/-1 왼쪽), back(뒤돌아봄), flash, swing, claw }
// =====================================================

// 두 사람 다 흰 세일러 교복. 머리색/눈색만 달라요.
const UNIFORM = {
  shirt: '#ffffff', shirtShade: '#dfe3ee', collar: '#2c3e6b', scarf: '#d6455d',
  skirt: '#2c3e6b', socks: '#2b2233', shoes: '#4a3428',
};
const SHIORI_COLORS = {
  ...UNIFORM,
  skin: '#ffe3d1', hair: '#4f7fd6', hairDark: '#355fb0', hairLight: '#8cb4f5', eye: '#1f3f7a',
  claw: '#3fb6c9', clawDark: '#1d7f94', nail: '#eafcff', // 변형된 오른팔 (인어의 비늘 색)
};
const HINAKO_COLORS = {
  ...UNIFORM,
  skin: '#ffe6d6', hair: '#8a5a3b', hairDark: '#6b4329', hairLight: '#b07f58', eye: '#4a2c18',
  bag: '#5a4636',
};

function girlLegs(ctx, step, C, f) {
  // 걸을 때 두 다리가 번갈아 들려요
  const lift1 = Math.max(0, step) * 3;
  const lift2 = Math.max(0, -step) * 3;
  [[-4 + step * 2, lift1], [4 - step * 2, lift2]].forEach(([lx, lift]) => {
    pathRRect(ctx, lx - 2.8, -15 - lift, 5.6, 10, 2.5);
    fillStroke(ctx, f ? FLASH : C.skin, 1.8);
    pathRRect(ctx, lx - 3.2, -8 - lift, 6.4, 5, 2);
    fillStroke(ctx, f ? FLASH : C.socks, 1.8);
    pathRRect(ctx, lx - 4, -4.5 - lift, 8, 4.5, 2);
    fillStroke(ctx, f ? FLASH : C.shoes, 1.8);
  });
}

function girlBody(ctx, C, bob, back, f) {
  // 치마
  ctx.beginPath();
  ctx.moveTo(-9, -22 + bob);
  ctx.lineTo(9, -22 + bob);
  ctx.lineTo(13, -11 + bob);
  ctx.lineTo(-13, -11 + bob);
  ctx.closePath();
  fillStroke(ctx, f ? FLASH : C.skirt, 2.2);
  if (!f) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const px of [-6, -2, 2, 6]) { ctx.moveTo(px * 0.8, -21 + bob); ctx.lineTo(px * 1.25, -12 + bob); }
    ctx.stroke();
  }
  // 상의
  pathRRect(ctx, -9, -37 + bob, 18, 17, 6);
  fillStroke(ctx, f ? FLASH : C.shirt, 2.2);
  if (back) {
    // 뒤에서 본 네모난 세일러 깃
    pathRRect(ctx, -8, -37 + bob, 16, 9, 2);
    fillStroke(ctx, f ? FLASH : C.collar, 1.6);
  } else {
    pathEllipse(ctx, 0, -35 + bob, 9.5, 3.8);
    fillStroke(ctx, f ? FLASH : C.collar, 1.6);
    // 스카프
    ctx.beginPath();
    ctx.moveTo(-1, -32 + bob); ctx.lineTo(5, -32 + bob); ctx.lineTo(2, -26 + bob);
    ctx.closePath();
    fillStroke(ctx, f ? FLASH : C.scarf, 1.4);
  }
}

// 시오리의 오른팔: 평소엔 사람 팔, 싸울 땐 비늘 덮인 팔 + 긴 손톱
function shioriArm(ctx, o, C, bob, step, f) {
  ctx.save();
  ctx.translate(8, -30 + bob);
  if (o.claw > 0) {
    const ang = o.swing > 0 ? -1.9 + (1 - o.swing) * 3.0 : 0.45 + Math.sin(o.t * 3) * 0.05;
    ctx.rotate(ang);
    // 손톱 3개 (길고 날카롭게)
    [-2.6, 0, 2.6].forEach((k, i) => {
      ctx.beginPath();
      ctx.moveTo(k - 1.3, 14);
      ctx.quadraticCurveTo(k * 1.6 + 3, 26, k * 1.3 + 2 + i * 0.5, 38);
      ctx.lineTo(k + 1.3, 14);
      ctx.closePath();
      fillStroke(ctx, f ? FLASH : C.nail, 1.3);
    });
    // 비늘 덮인 팔
    pathRRect(ctx, -3.8, 0, 7.6, 16, 3.8);
    fillStroke(ctx, f ? FLASH : linGrad(ctx, 0, 0, 0, 16, C.claw, C.clawDark), 1.8);
    if (!f) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-1, 5, 2, 0.2, Math.PI - 0.2);
      ctx.arc(1.5, 9, 2, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  } else {
    ctx.rotate(0.15 + step * 0.25);
    pathEllipse(ctx, 0, 5, 3.4, 6.2);
    fillStroke(ctx, f ? FLASH : C.shirt, 1.8);
    pathEllipse(ctx, 0, 12, 2.4, 2.4);
    fillStroke(ctx, f ? FLASH : C.skin, 1.5);
  }
  ctx.restore();
}

function girlEyes(ctx, hy, C, t, offset, sleepy) {
  if (isBlinking(t, offset)) {
    ctx.strokeStyle = C.eye; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(1, hy + 2); ctx.lineTo(5, hy + 2);
    ctx.moveTo(8, hy + 2); ctx.lineTo(12, hy + 2); ctx.stroke();
    return;
  }
  ctx.fillStyle = C.eye;
  // 졸린 눈은 납작하게
  const ry = sleepy ? 1.8 : 3.3;
  pathEllipse(ctx, 3.5, hy + 2 + (sleepy ? 1 : 0), 2.3, ry); ctx.fill();
  pathEllipse(ctx, 10, hy + 2 + (sleepy ? 1 : 0), 2.3, ry); ctx.fill();
  if (!sleepy) {
    ctx.fillStyle = '#fff';
    pathEllipse(ctx, 3, hy + 1, 0.8, 1); ctx.fill();
    pathEllipse(ctx, 9.5, hy + 1, 0.8, 1); ctx.fill();
  }
}

Art.shiori = function (ctx, o) {
  const C = SHIORI_COLORS;
  const f = o.flash;
  const step = o.moving ? Math.sin(o.t * 13) : 0;
  const bob = o.moving ? -Math.abs(Math.cos(o.t * 13)) * 3 : Math.sin(o.t * 2.5) * 0.8;
  const hy = -47 + bob;
  const sway = Math.sin(o.t * 6) * (o.moving ? 2.5 : 0.8);

  ctx.save();
  ctx.translate(o.x, o.y);
  shadow(ctx, 0, 0, 15);
  ctx.scale(o.dirX, 1);

  // 파란 긴 생머리 (허리까지)
  const longHair = () => {
    pathRRect(ctx, -14 - sway, hy - 6, 24, 40, [12, 12, 4, 4]);
    fillStroke(ctx, f ? FLASH : linGrad(ctx, 0, hy, 0, hy + 34, C.hair, C.hairDark), 2.4);
  };
  if (!o.back) longHair();
  girlLegs(ctx, step, C, f);
  // 뒤쪽 팔
  pathEllipse(ctx, -9, -27 + bob - step * 2, 3.4, 6.2);
  fillStroke(ctx, f ? FLASH : C.shirtShade, 1.8);
  girlBody(ctx, C, bob, o.back, f);
  if (o.back) longHair();
  shioriArm(ctx, o, C, bob, step, f);

  // 머리
  pathEllipse(ctx, 0, hy, 12.5, 12);
  fillStroke(ctx, f ? FLASH : C.skin, 2.4);
  if (o.back) {
    pathEllipse(ctx, 0, hy - 1, 13.5, 12.8);
    fillStroke(ctx, f ? FLASH : C.hair, 2.4);
  } else {
    // 일자로 내려오는 앞머리
    ctx.beginPath();
    ctx.moveTo(-14, hy + 8);
    ctx.quadraticCurveTo(-16, hy - 15, 0, hy - 14);
    ctx.quadraticCurveTo(15, hy - 14, 14, hy - 1);
    ctx.lineTo(13, hy - 3);
    ctx.lineTo(1, hy - 3);
    ctx.lineTo(-3, hy - 2);
    ctx.lineTo(-7, hy + 4);
    ctx.lineTo(-9, hy + 12);
    ctx.closePath();
    fillStroke(ctx, f ? FLASH : C.hair, 2.4);
    if (!f) {
      girlEyes(ctx, hy, C, o.t, 0, false);
      pathEllipse(ctx, 6.5, hy + 7, 3, 1.5); ctx.fillStyle = 'rgba(255,120,150,0.35)'; ctx.fill();
    }
  }
  ctx.restore();
};

Art.hinako = function (ctx, o) {
  const C = HINAKO_COLORS;
  const f = o.flash;
  const step = o.moving ? Math.sin(o.t * 12) : 0;
  const bob = o.moving ? -Math.abs(Math.cos(o.t * 12)) * 2.5 : Math.sin(o.t * 2.0) * 0.8;
  const hy = -46 + bob;

  ctx.save();
  ctx.translate(o.x, o.y);
  shadow(ctx, 0, 0, 14);
  ctx.scale(o.dirX, 1);

  // 학교 가방 (등 뒤)
  const bag = () => {
    pathRRect(ctx, -15, -33 + bob, 9, 13, 2.5);
    fillStroke(ctx, f ? FLASH : C.bag, 1.8);
  };
  if (!o.back) bag();
  girlLegs(ctx, step, C, f);
  girlBody(ctx, C, bob, o.back, f);
  if (o.back) bag();
  // 두 손을 앞으로 모은 모습
  pathEllipse(ctx, 3, -24 + bob, 4, 3.3);
  fillStroke(ctx, f ? FLASH : C.skin, 1.6);

  // 머리 (갈색 단발)
  pathEllipse(ctx, 0, hy, 12.5, 12);
  fillStroke(ctx, f ? FLASH : C.skin, 2.4);
  if (o.back) {
    pathRRect(ctx, -14, hy - 13, 28, 24, [13, 13, 6, 6]);
    fillStroke(ctx, f ? FLASH : C.hair, 2.4);
  } else {
    ctx.beginPath();
    ctx.moveTo(-14, hy + 9);
    ctx.quadraticCurveTo(-17, hy - 15, 0, hy - 14);
    ctx.quadraticCurveTo(16, hy - 14, 14, hy);
    ctx.quadraticCurveTo(9, hy - 5, 5, hy - 3);
    ctx.quadraticCurveTo(1, hy - 6, -3, hy - 3);
    ctx.quadraticCurveTo(-7, hy - 1, -8, hy + 6);
    ctx.quadraticCurveTo(-9, hy + 10, -14, hy + 9);
    ctx.closePath();
    fillStroke(ctx, f ? FLASH : C.hair, 2.4);
    // 단발 끝 (앞쪽 옆머리)
    pathRRect(ctx, 10, hy - 3, 5, 13, [2, 2, 3, 3]);
    fillStroke(ctx, f ? FLASH : C.hair, 1.8);
    if (!f) {
      girlEyes(ctx, hy, C, o.t, 1.3, true); // 늘 졸린 듯한 눈
      pathEllipse(ctx, 6.5, hy + 7, 3, 1.5); ctx.fillStyle = 'rgba(255,120,150,0.3)'; ctx.fill();
    }
  }
  ctx.restore();
};

// =====================================================
// 2) 식인 요괴들
// =====================================================

// 그림자 요괴: 꾸물꾸물한 검은 덩어리, 외눈에 이빨
Art.blob = function (ctx, m) {
  const r = m.r;
  const sq = Math.sin(m.t * 8) * 0.12;
  const rx = r * (1 + sq), ry = r * 0.9 * (1 - sq);
  ctx.save();
  ctx.translate(m.x, m.y);
  shadow(ctx, 0, 0, r * 1.05);
  let fill = FLASH;
  if (!m.flash) {
    const g = ctx.createRadialGradient(-rx * 0.3, -ry * 1.4, 2, 0, -ry, rx * 1.2);
    g.addColorStop(0, m.def.light);
    g.addColorStop(1, m.def.color);
    fill = g;
  }
  // 몸 (아래쪽이 흐물흐물)
  ctx.beginPath();
  ctx.moveTo(-rx, -ry * 0.4);
  ctx.quadraticCurveTo(-rx, -ry * 2.1, 0, -ry * 2.1);
  ctx.quadraticCurveTo(rx, -ry * 2.1, rx, -ry * 0.4);
  for (let i = 0; i <= 4; i++) {
    const x = rx - (i / 4) * rx * 2;
    ctx.quadraticCurveTo(x + rx * 0.25, 2 + Math.sin(m.t * 6 + i) * 2, x, -ry * 0.1);
  }
  ctx.closePath();
  fillStroke(ctx, fill, 2.4);
  if (!m.flash) {
    const lx = m.lookX * 3;
    // 외눈
    pathEllipse(ctx, lx, -ry * 1.3, r * 0.42, r * 0.36);
    fillStroke(ctx, '#ffe46b', 1.6);
    pathEllipse(ctx, lx + m.lookX * 1.5, -ry * 1.3, 1.8, r * 0.28);
    ctx.fillStyle = '#1b1426'; ctx.fill();
    // 이빨 달린 입
    ctx.beginPath();
    ctx.moveTo(lx - r * 0.45, -ry * 0.7);
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(lx - r * 0.45 + (i + 0.5) * r * 0.225, -ry * 0.48);
      ctx.lineTo(lx - r * 0.45 + (i + 1) * r * 0.225, -ry * 0.7);
    }
    ctx.closePath();
    fillStroke(ctx, '#ffffff', 1.2);
  }
  ctx.restore();
};

// 귀신불: 둥둥 떠다니는 푸른 불꽃
Art.wisp = function (ctx, m) {
  const float = -22 + Math.sin(m.t * 5) * 4;
  const flick = Math.sin(m.t * 18) * 2;
  ctx.save();
  ctx.translate(m.x, m.y);
  shadow(ctx, 0, 0, 9, 3.2);
  ctx.translate(0, float);
  if (!m.flash) {
    const glow = ctx.createRadialGradient(0, -4, 2, 0, -4, 26);
    glow.addColorStop(0, 'rgba(140,220,255,0.45)');
    glow.addColorStop(1, 'rgba(140,220,255,0)');
    ctx.fillStyle = glow;
    pathEllipse(ctx, 0, -4, 26, 26); ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, -26 + flick);
  ctx.quadraticCurveTo(6, -14, 11, -4);
  ctx.quadraticCurveTo(13, 8, 0, 9);
  ctx.quadraticCurveTo(-13, 8, -11, -4);
  ctx.quadraticCurveTo(-8, -10, -4, -12 - flick);
  ctx.quadraticCurveTo(-1, -16, 0, -26 + flick);
  ctx.closePath();
  fillStroke(ctx, m.flash ? FLASH : linGrad(ctx, 0, -26, 0, 9, m.def.light, m.def.color), 2);
  if (!m.flash) {
    ctx.fillStyle = '#1b2a4a';
    pathEllipse(ctx, -3.5 + m.lookX * 1.5, 0, 1.8, 2.6); ctx.fill();
    pathEllipse(ctx, 3.5 + m.lookX * 1.5, 0, 1.8, 2.6); ctx.fill();
    ctx.beginPath();
    ctx.arc(m.lookX * 1.5, 4, 2.2, 0, Math.PI);
    ctx.strokeStyle = '#1b2a4a'; ctx.lineWidth = 1.4; ctx.stroke();
  }
  ctx.restore();
};

// 오니: 뿔 달린 빨간 도깨비, 튼튼하고 느려요
Art.oni = function (ctx, m) {
  const r = m.r;
  const step = Math.sin(m.t * 5);
  const bob = -Math.abs(step) * 2;
  ctx.save();
  ctx.translate(m.x, m.y);
  shadow(ctx, 0, 0, r * 1.1);
  ctx.scale(m.lookX < 0 ? -1 : 1, 1);
  const f = m.flash;
  const skin = f ? FLASH : m.def.color;
  const dark = f ? FLASH : m.def.dark;
  // 다리
  pathRRect(ctx, -r * 0.6, -r * 0.55 - Math.max(0, step) * 3, r * 0.45, r * 0.55, 4); fillStroke(ctx, dark, 2.5);
  pathRRect(ctx, r * 0.15, -r * 0.55 - Math.max(0, -step) * 3, r * 0.45, r * 0.55, 4); fillStroke(ctx, dark, 2.5);
  // 호랑이 무늬 옷
  pathRRect(ctx, -r * 0.8, -r * 0.85 + bob, r * 1.6, r * 0.45, 4);
  fillStroke(ctx, f ? FLASH : '#f2c14e', 2.2);
  if (!f) {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const sx of [-0.45, 0, 0.45]) { ctx.moveTo(r * sx - 3, -r * 0.82 + bob); ctx.lineTo(r * sx + 2, -r * 0.45 + bob); }
    ctx.stroke();
  }
  // 몸통
  pathRRect(ctx, -r * 0.85, -r * 2.05 + bob, r * 1.7, r * 1.3, 12);
  fillStroke(ctx, f ? FLASH : linGrad(ctx, 0, -r * 2, 0, -r * 0.7, m.def.light, skin), 3);
  // 뿔
  ctx.beginPath();
  ctx.moveTo(-4, -r * 2.0 + bob);
  ctx.quadraticCurveTo(0, -r * 2.75 + bob, 5, -r * 2.0 + bob);
  ctx.closePath();
  fillStroke(ctx, f ? FLASH : '#f4ecd8', 2);
  // 팔 + 방망이
  ctx.save();
  ctx.translate(r * 0.85, -r * 1.4 + bob);
  ctx.rotate(0.4 + step * 0.3);
  pathRRect(ctx, -3, -26, 7, 30, 3); fillStroke(ctx, f ? FLASH : '#6b4a2e', 2);
  pathRRect(ctx, -5, -30, 11, 16, 5); fillStroke(ctx, f ? FLASH : '#7d5838', 2);
  ctx.restore();
  pathEllipse(ctx, r * 0.85, -r * 1.35 + bob, 5, 5); fillStroke(ctx, skin, 2);
  if (!f) {
    // 눈 + 송곳니
    ctx.fillStyle = '#ffe46b';
    pathEllipse(ctx, r * 0.05, -r * 1.55 + bob, 3, 2.4); ctx.fill();
    pathEllipse(ctx, r * 0.5, -r * 1.55 + bob, 3, 2.4); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 1.2 + bob); ctx.lineTo(r * 0.12, -r * 1.05 + bob); ctx.lineTo(r * 0.2, -r * 1.2 + bob);
    ctx.moveTo(r * 0.4, -r * 1.2 + bob); ctx.lineTo(r * 0.47, -r * 1.05 + bob); ctx.lineTo(r * 0.55, -r * 1.2 + bob);
    ctx.fill();
  }
  ctx.restore();
};

// 보스: 굶주린 대요괴 — 하얀 가면, 커다란 입, 긴 팔
Art.boss = function (ctx, m) {
  const r = m.r;
  const bob = Math.sin(m.t * 2) * 3;
  const f = m.flash;
  const open = m.state === 'aim' ? 1 : m.state === 'dash' ? 0.8 : 0.25 + Math.sin(m.t * 3) * 0.1;
  ctx.save();
  ctx.translate(m.x, m.y);
  const pulse = 0.5 + Math.sin(m.t * 4) * 0.2;
  pathEllipse(ctx, 0, 0, r * 1.6, r * 0.55);
  ctx.fillStyle = `rgba(120, 30, 60, ${0.3 * pulse})`; ctx.fill();
  shadow(ctx, 0, 0, r * 1.1);
  ctx.scale(m.lookX < 0 ? -1 : 1, 1);
  const body = f ? FLASH : '#2a1f33';
  // 긴 팔 (양쪽)
  [-1, 1].forEach((s) => {
    const swing = Math.sin(m.t * 3 + s) * 0.2;
    ctx.save();
    ctx.translate(s * 34, -80 + bob);
    ctx.rotate(s * (0.5 + swing) + (m.state === 'aim' ? -s * 0.9 : 0));
    pathRRect(ctx, -6, 0, 12, 70, 6); fillStroke(ctx, body, 3);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 4 - 2, 66); ctx.lineTo(k * 6, 88); ctx.lineTo(k * 4 + 2, 66);
      ctx.closePath();
      fillStroke(ctx, f ? FLASH : '#e8dcc8', 1.8);
    }
    ctx.restore();
  });
  // 몸 (너덜너덜한 그림자 망토)
  const sway = Math.sin(m.t * 3) * 5;
  ctx.beginPath();
  ctx.moveTo(-40, -110 + bob);
  ctx.quadraticCurveTo(-58, -40, -50 - sway, -2);
  ctx.lineTo(-34, -12); ctx.lineTo(-22 + sway, 0); ctx.lineTo(-8, -12); ctx.lineTo(6 - sway, 0);
  ctx.lineTo(20, -12); ctx.lineTo(34 + sway, 0); ctx.lineTo(46, -10);
  ctx.quadraticCurveTo(56, -40, 40, -110 + bob);
  ctx.quadraticCurveTo(0, -150 + bob, -40, -110 + bob);
  ctx.closePath();
  fillStroke(ctx, f ? FLASH : linGrad(ctx, 0, -150, 0, 0, '#4a3358', '#1c1424'), 3);
  // 하얀 가면
  const hy = -108 + bob;
  pathEllipse(ctx, 6, hy, 26, 30);
  fillStroke(ctx, f ? FLASH : '#f4ecdf', 3);
  if (!f) {
    ctx.fillStyle = '#ff3355';
    pathEllipse(ctx, -3, hy - 8, 5, 3, 0.3); ctx.fill();
    pathEllipse(ctx, 17, hy - 8, 5, 3, -0.3); ctx.fill();
    // 붉은 무늬
    ctx.strokeStyle = '#c4334f'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-10, hy - 18); ctx.lineTo(-2, hy - 14); ctx.moveTo(24, hy - 18); ctx.lineTo(16, hy - 14); ctx.stroke();
    // 큰 입 (돌진 준비 중엔 크게 벌려요)
    const mh = 6 + open * 16;
    pathEllipse(ctx, 7, hy + 12, 14, mh * 0.5);
    ctx.fillStyle = '#3a0f1c'; ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = -5 + i * 6;
      ctx.moveTo(x, hy + 12 - mh * 0.45); ctx.lineTo(x + 3, hy + 12 - mh * 0.15); ctx.lineTo(x + 6, hy + 12 - mh * 0.45);
      ctx.moveTo(x, hy + 12 + mh * 0.45); ctx.lineTo(x + 3, hy + 12 + mh * 0.15); ctx.lineTo(x + 6, hy + 12 + mh * 0.45);
    }
    ctx.fill();
  }
  ctx.restore();
};

// =====================================================
// 3) 대화창 일러스트 (큰 그림)
//    (cx, bottom) = 그림 아래쪽 가운데 위치, s = 크기 배율
//    face = 'normal' | 'smile' | 'smirk' | 'sleepy' | 'worry' | 'surprise' | 'angry'
// =====================================================

function portraitEye(ctx, x, y, side, o, blink) {
  const { iris, irisDark, face, lash, skin, lid } = o;
  ctx.strokeStyle = OUTLINE; ctx.lineCap = 'round';
  if (face === 'smile') {
    // 웃는 눈 ^ ^
    ctx.beginPath();
    ctx.arc(x, y + 8, 17, Math.PI * 1.15, Math.PI * 1.85);
    ctx.lineWidth = 5; ctx.stroke();
    return;
  }
  if (blink) {
    ctx.beginPath();
    ctx.moveTo(x - 18, y + 3); ctx.quadraticCurveTo(x, y + 9, x + 18, y + 3);
    ctx.lineWidth = 5; ctx.stroke();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  pathEllipse(ctx, 0, 0, 17, 21);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.save();
  ctx.clip();
  const small = face === 'surprise' ? 0.8 : 1;
  pathEllipse(ctx, 0, 3, 13 * small, 17 * small);
  ctx.fillStyle = linGrad(ctx, 0, -14, 0, 20, irisDark, iris);
  ctx.fill();
  const pr = face === 'surprise' ? 0.55 : 1;
  pathEllipse(ctx, 0, 4, 6 * pr, 9 * pr);
  ctx.fillStyle = '#1b1426'; ctx.fill();
  pathEllipse(ctx, -5, -5, 4.5, 5.5); ctx.fillStyle = '#ffffff'; ctx.fill();
  pathEllipse(ctx, 5, 10, 2, 2); ctx.fill();
  // 눈꺼풀: lid가 1보다 작으면 위쪽을 피부색으로 덮어서 반쯤 감은 눈
  const cover = (1 - lid) * 42;
  if (cover > 0) {
    ctx.fillStyle = skin;
    ctx.fillRect(-20, -23, 40, cover);
  }
  ctx.restore();
  ctx.restore();
  // 윗 속눈썹
  ctx.lineWidth = lash;
  ctx.beginPath();
  let ly;
  if (cover > 0) {
    ly = y - 21 + cover;
    ctx.moveTo(x - 19, ly + 3);
    ctx.quadraticCurveTo(x, ly - 3, x + 19, ly + 3);
  } else {
    ly = y - 18;
    ctx.ellipse(x, y, 19, 22, 0, Math.PI * 1.08, Math.PI * 1.92);
  }
  ctx.stroke();
  // 바깥쪽 속눈썹 끝
  ctx.beginPath();
  ctx.moveTo(x + side * 17, ly + 4);
  ctx.lineTo(x + side * 25, ly - 2);
  ctx.lineWidth = 3; ctx.stroke();
}

function portraitFace(ctx, o) {
  const { face, t, blinkOffset } = o;
  const blink = isBlinking(t, blinkOffset);
  const ey = -252;
  // 볼터치
  const blushA = face === 'smile' ? 0.5 : 0.28;
  pathEllipse(ctx, -50, -222, 15, 8); ctx.fillStyle = `rgba(255,120,140,${blushA})`; ctx.fill();
  pathEllipse(ctx, 50, -222, 15, 8); ctx.fill();
  // 눈
  portraitEye(ctx, -33, ey, -1, o, blink);
  portraitEye(ctx, 33, ey, 1, o, blink);
  // 눈썹
  const base = ey - 36 + (o.browLift || 0);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4; ctx.lineCap = 'round';
  [-1, 1].forEach((s) => {
    let inner = base, outer = base;
    if (face === 'worry') { inner = base - 8; outer = base + 3; }
    if (face === 'angry') { inner = base + 7; outer = base - 5; }
    if (face === 'surprise') { inner = base - 9; outer = base - 9; }
    if (face === 'smile') { inner = base - 3; outer = base - 3; }
    if (face === 'sleepy') { inner = base - 3; outer = base + 2; } // 나른하게 축 처진 눈썹
    if (face === 'smirk' && s === 1) { inner = base - 7; outer = base - 5; } // 한쪽 눈썹만 쓱
    ctx.beginPath();
    ctx.moveTo(s * 33 - s * 15, inner);
    ctx.quadraticCurveTo(s * 33, Math.min(inner, outer) - 4, s * 33 + s * 16, outer);
    ctx.stroke();
  });
  // 코
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(2, -232); ctx.lineTo(-1, -226); ctx.stroke();
  // 입
  const my = -206;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  if (face === 'smile') {
    ctx.moveTo(-16, my - 4);
    ctx.quadraticCurveTo(0, my + 22, 16, my - 4);
    ctx.closePath();
    fillStroke(ctx, '#c4475a', 3);
    pathEllipse(ctx, 0, my + 6, 7, 3.5); ctx.fillStyle = '#f08a98'; ctx.fill();
  } else if (face === 'smirk') {
    ctx.moveTo(-13, my);
    ctx.quadraticCurveTo(2, my + 6, 15, my - 8);
    ctx.stroke();
  } else if (face === 'sleepy') {
    ctx.moveTo(-7, my);
    ctx.lineTo(7, my);
    ctx.stroke();
  } else if (face === 'surprise') {
    pathEllipse(ctx, 0, my, 7, 10);
    fillStroke(ctx, '#7a2b3a', 3);
  } else if (face === 'worry') {
    ctx.moveTo(-10, my + 2);
    ctx.quadraticCurveTo(0, my - 7, 10, my + 2);
    ctx.stroke();
  } else if (face === 'angry') {
    ctx.moveTo(-12, my);
    ctx.quadraticCurveTo(0, my - 4, 12, my + 1);
    ctx.stroke();
  } else {
    ctx.moveTo(-10, my - 2);
    ctx.quadraticCurveTo(0, my + 6, 10, my - 2);
    ctx.stroke();
  }
}

function facePath(ctx) {
  ctx.beginPath();
  ctx.ellipse(0, -268, 76, 80, 0, Math.PI, 0);
  ctx.bezierCurveTo(76, -215, 40, -180, 0, -176);
  ctx.bezierCurveTo(-40, -180, -76, -215, -76, -268);
  ctx.closePath();
}

// 흰 세일러 교복 상반신 (두 사람 공통)
function portraitUniform(ctx, skin) {
  const C = UNIFORM;
  ctx.beginPath();
  ctx.moveTo(-150, 0);
  ctx.bezierCurveTo(-145, -80, -110, -125, -45, -138);
  ctx.lineTo(45, -138);
  ctx.bezierCurveTo(110, -125, 145, -80, 150, 0);
  ctx.closePath();
  fillStroke(ctx, linGrad(ctx, 0, -138, 0, 0, C.shirt, C.shirtShade), 4);
  // 목
  pathRRect(ctx, -21, -200, 42, 76, 18);
  fillStroke(ctx, skin, 3);
  // 세일러 깃 (V자)
  ctx.beginPath();
  ctx.moveTo(-34, -140);
  ctx.lineTo(-128, -112);
  ctx.lineTo(-100, -68);
  ctx.lineTo(0, -28);
  ctx.lineTo(100, -68);
  ctx.lineTo(128, -112);
  ctx.lineTo(34, -140);
  ctx.lineTo(0, -78);
  ctx.closePath();
  fillStroke(ctx, C.collar, 3.5);
  // 깃의 흰 줄
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * 116, -108);
    ctx.lineTo(s * 92, -74);
    ctx.lineTo(s * 14, -42);
    ctx.stroke();
  });
  // 빨간 스카프 리본
  pathEllipse(ctx, -20, -62, 22, 11, -0.3); fillStroke(ctx, C.scarf, 3);
  pathEllipse(ctx, 20, -62, 22, 11, 0.3); fillStroke(ctx, C.scarf, 3);
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * 4, -58); ctx.lineTo(s * 16, -18); ctx.lineTo(s * 4, -26);
    ctx.closePath();
    fillStroke(ctx, C.scarf, 3);
  });
  pathEllipse(ctx, 0, -60, 9, 9); fillStroke(ctx, '#b8364c', 3);
}

// 시오리: 파란 긴 생머리, 존댓말 쓰는 능글맞은 인어 요괴
const SHIORI_LIDS = { normal: 0.9, smirk: 0.72, angry: 0.75, worry: 0.95, sleepy: 0.55, surprise: 1 };
function portraitShiori(ctx, face, t) {
  const C = SHIORI_COLORS;
  const sway = Math.sin(t * 1.5) * 3;
  // 뒷머리: 허리까지 일자로 내려와요
  ctx.beginPath();
  ctx.moveTo(-100, -300);
  ctx.bezierCurveTo(-128, -220, -134, -120, -138 + sway, 0);
  ctx.lineTo(138 + sway, 0);
  ctx.bezierCurveTo(134, -120, 128, -220, 100, -300);
  ctx.closePath();
  fillStroke(ctx, linGrad(ctx, 0, -300, 0, 0, C.hair, C.hairDark), 4);
  portraitUniform(ctx, '#f5cfba');
  // 얼굴
  facePath(ctx);
  fillStroke(ctx, C.skin, 4);
  portraitFace(ctx, {
    face, t, iris: '#6cc4ee', irisDark: '#1d4f8a', lash: 6, blinkOffset: 0,
    skin: C.skin, lid: SHIORI_LIDS[face] ?? 1,
  });
  // 앞머리: 일자로 가지런한 생머리
  ctx.beginPath();
  ctx.moveTo(-94, -246);
  ctx.bezierCurveTo(-104, -350, -42, -384, 0, -382);
  ctx.bezierCurveTo(42, -384, 104, -350, 94, -246);
  ctx.lineTo(74, -270);
  ctx.lineTo(56, -282);
  ctx.lineTo(44, -276);
  ctx.lineTo(30, -288);
  ctx.lineTo(12, -284);
  ctx.lineTo(0, -292);
  ctx.lineTo(-14, -284);
  ctx.lineTo(-32, -289);
  ctx.lineTo(-46, -277);
  ctx.lineTo(-60, -282);
  ctx.lineTo(-76, -268);
  ctx.closePath();
  fillStroke(ctx, linGrad(ctx, 0, -382, 0, -250, C.hairLight, C.hair), 4);
  // 옆머리: 어깨 앞으로 길게
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * 82, -292);
    ctx.bezierCurveTo(s * 100, -220, s * (98 + sway), -140, s * 108, -30);
    ctx.lineTo(s * 80, -40);
    ctx.bezierCurveTo(s * 76, -140, s * 72, -230, s * 66, -276);
    ctx.closePath();
    fillStroke(ctx, linGrad(ctx, 0, -292, 0, -30, C.hair, C.hairDark), 3.5);
  });
  // 머리 윤기 (천사 고리)
  ctx.beginPath();
  ctx.moveTo(-58, -350); ctx.quadraticCurveTo(-10, -368, 38, -356);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
}

// 히나코: 갈색 단발, 반말 쓰는 조용하고 의욕 없는 아이
const HINAKO_LIDS = { normal: 0.74, sleepy: 0.6, smirk: 0.7, angry: 0.7, worry: 0.82, smile: 1, surprise: 1 };
function portraitHinako(ctx, face, t) {
  const C = HINAKO_COLORS;
  // 뒷머리: 턱 높이에서 끝나는 단발
  ctx.beginPath();
  ctx.moveTo(-98, -290);
  ctx.bezierCurveTo(-116, -230, -112, -190, -96, -168);
  ctx.quadraticCurveTo(0, -150, 96, -168);
  ctx.bezierCurveTo(112, -190, 116, -230, 98, -290);
  ctx.closePath();
  fillStroke(ctx, linGrad(ctx, 0, -300, 0, -160, C.hair, C.hairDark), 4);
  portraitUniform(ctx, '#f5d2be');
  facePath(ctx);
  fillStroke(ctx, C.skin, 4);
  portraitFace(ctx, {
    face, t, iris: '#c08a5c', irisDark: '#4a2c18', lash: 6.5, blinkOffset: 1.3,
    skin: C.skin, lid: HINAKO_LIDS[face] ?? 0.74, browLift: -6, // 눈썹을 살짝 올려서 순한 인상으로
  });
  // 앞머리: 살짝 흐트러진 부드러운 단발
  ctx.beginPath();
  ctx.moveTo(-94, -240);
  ctx.bezierCurveTo(-106, -350, -40, -386, 4, -382);
  ctx.bezierCurveTo(50, -382, 106, -348, 94, -240);
  ctx.quadraticCurveTo(84, -262, 70, -264);
  ctx.quadraticCurveTo(58, -296, 38, -280);
  ctx.quadraticCurveTo(24, -306, 6, -286);
  ctx.quadraticCurveTo(-12, -308, -28, -282);
  ctx.quadraticCurveTo(-48, -300, -62, -266);
  ctx.quadraticCurveTo(-80, -268, -94, -240);
  ctx.closePath();
  fillStroke(ctx, linGrad(ctx, 0, -382, 0, -250, C.hairLight, C.hair), 4);
  // 옆머리: 턱선에서 안쪽으로 말려요
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * 80, -290);
    ctx.bezierCurveTo(s * 102, -240, s * 104, -200, s * 90, -168);
    ctx.quadraticCurveTo(s * 76, -164, s * 66, -176);
    ctx.bezierCurveTo(s * 76, -200, s * 74, -250, s * 64, -272);
    ctx.closePath();
    fillStroke(ctx, C.hair, 3.5);
  });
  ctx.beginPath();
  ctx.moveTo(-52, -352); ctx.quadraticCurveTo(-10, -366, 34, -356);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
}

const PORTRAITS = { shiori: portraitShiori, hinako: portraitHinako };

Art.portrait = function (ctx, who, cx, bottom, s, face, t, dim = false) {
  const draw = PORTRAITS[who];
  if (!draw) return;
  ctx.save();
  ctx.translate(cx, bottom);
  // 숨쉬는 느낌으로 살짝 위아래로 늘어났다 줄었다
  ctx.scale(s, s * (1 + Math.sin(t * 2) * 0.006));
  if (dim) ctx.filter = 'brightness(0.5) saturate(0.7)';
  draw(ctx, face || 'normal', t);
  ctx.restore();
};
