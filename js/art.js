// =====================================================
// art.js — 캐릭터, 몬스터, 대화 일러스트를 "코드로" 그려요.
// 픽셀이 아니라 도형(원, 곡선)으로 그리기 때문에 확대해도 매끈해요.
// 나중에 직접 그린 그림(PNG)으로 바꾸고 싶으면 README를 참고하세요.
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
//    o = { x, y, t(시간), moving, dirX(1 오른쪽/-1 왼쪽), back(뒤돌아봄), flash, swing }
// =====================================================

const HERO_COLORS = {
  skin: '#ffd9bf', hair: '#5a3a2a', hairLight: '#7a5038',
  tunic: '#4a7bd0', tunicDark: '#33589c', belt: '#7a4e2d',
  pants: '#3d3a52', boots: '#5b3b26', cape: '#d0443e', eye: '#2b2233',
};
const LUNA_COLORS = {
  skin: '#ffe2cf', hair: '#f3c4dc', hairDark: '#d99cc5',
  dress: '#b996e8', dressDark: '#8e6cc4', collar: '#ffffff',
  boots: '#6a4d8c', ribbon: '#7b5cd6', eye: '#4b2f6b',
};

function legs(ctx, step, pantsColor, bootColor, flash) {
  // 걸을 때 두 다리가 번갈아 들려요
  const lift1 = Math.max(0, step) * 3;
  const lift2 = Math.max(0, -step) * 3;
  [[-5 + step * 2, lift1], [5 - step * 2, lift2]].forEach(([lx, lift]) => {
    pathRRect(ctx, lx - 4, -15 - lift, 8, 12, 3);
    fillStroke(ctx, flash ? FLASH : pantsColor, 2);
    pathRRect(ctx, lx - 5, -7 - lift, 10, 7, 3);
    fillStroke(ctx, flash ? FLASH : bootColor, 2);
  });
}

Art.hero = function (ctx, o) {
  const C = HERO_COLORS;
  const f = o.flash;
  const step = o.moving ? Math.sin(o.t * 13) : 0;
  const bob = o.moving ? -Math.abs(Math.cos(o.t * 13)) * 3 : Math.sin(o.t * 2.5) * 0.8;

  ctx.save();
  ctx.translate(o.x, o.y);
  shadow(ctx, 0, 0, 17);
  ctx.scale(o.dirX, 1);

  const capeSway = Math.sin(o.t * 6) * (o.moving ? 3 : 1);
  const drawCape = () => {
    ctx.beginPath();
    ctx.moveTo(-7, -36 + bob);
    ctx.quadraticCurveTo(-18 - capeSway, -24 + bob, -17 - capeSway, -9 + bob);
    ctx.lineTo(6, -11 + bob);
    ctx.lineTo(6, -34 + bob);
    ctx.closePath();
    fillStroke(ctx, f ? FLASH : C.cape, 2);
  };

  if (!o.back) drawCape();
  legs(ctx, step, C.pants, C.boots, f);

  // 뒤쪽 팔
  pathEllipse(ctx, -10, -25 + bob - step * 2, 4, 7);
  fillStroke(ctx, f ? FLASH : C.tunicDark, 2);

  // 몸통
  pathRRect(ctx, -10, -37 + bob, 20, 24, 7);
  fillStroke(ctx, f ? FLASH : C.tunic, 2.5);
  ctx.fillStyle = f ? FLASH : C.belt;
  ctx.fillRect(-10, -19 + bob, 20, 4);

  if (o.back) drawCape();

  // 검 (공격 중이면 휘두르는 각도로)
  ctx.save();
  ctx.translate(9, -24 + bob);
  const swingAngle = o.swing > 0 ? -2.0 + (1 - o.swing) * 3.4 : 0.55;
  ctx.rotate(swingAngle);
  pathRRect(ctx, -2, 2, 4, 26, 2);
  fillStroke(ctx, f ? FLASH : '#e8eef7', 2);
  pathRRect(ctx, -6, 0, 12, 4, 2);
  fillStroke(ctx, f ? FLASH : '#c9a23a', 2);
  ctx.restore();

  // 앞쪽 팔
  pathEllipse(ctx, 9, -24 + bob + step * 2, 4, 6);
  fillStroke(ctx, f ? FLASH : C.tunic, 2);

  // 머리
  const hy = -49 + bob;
  pathEllipse(ctx, 0, hy, 13, 12.5);
  fillStroke(ctx, f ? FLASH : C.skin, 2.5);

  if (o.back) {
    pathEllipse(ctx, 0, hy - 1, 14, 13);
    fillStroke(ctx, f ? FLASH : C.hair, 2.5);
  } else {
    // 머리카락 (뾰족한 앞머리)
    ctx.beginPath();
    ctx.moveTo(-14, hy + 2);
    ctx.quadraticCurveTo(-16, hy - 16, 0, hy - 15);
    ctx.quadraticCurveTo(15, hy - 15, 15, hy - 3);
    ctx.lineTo(10, hy - 6);
    ctx.lineTo(7, hy - 1);
    ctx.lineTo(3, hy - 7);
    ctx.lineTo(-2, hy - 2);
    ctx.lineTo(-6, hy - 6);
    ctx.lineTo(-10, hy + 4);
    ctx.closePath();
    fillStroke(ctx, f ? FLASH : C.hair, 2.5);
    // 눈
    if (!f) {
      if (isBlinking(o.t)) {
        ctx.strokeStyle = C.eye; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(1, hy + 1); ctx.lineTo(5, hy + 1);
        ctx.moveTo(8, hy + 1); ctx.lineTo(12, hy + 1); ctx.stroke();
      } else {
        pathEllipse(ctx, 3.5, hy + 1, 1.9, 3); ctx.fillStyle = C.eye; ctx.fill();
        pathEllipse(ctx, 10, hy + 1, 1.9, 3); ctx.fill();
      }
      pathEllipse(ctx, 6, hy + 6, 3, 1.5); ctx.fillStyle = 'rgba(255,120,120,0.4)'; ctx.fill();
    }
  }
  ctx.restore();
};

Art.luna = function (ctx, o) {
  const C = LUNA_COLORS;
  const f = o.flash;
  const step = o.moving ? Math.sin(o.t * 12) : 0;
  const bob = o.moving ? -Math.abs(Math.cos(o.t * 12)) * 2.5 : Math.sin(o.t * 2.2) * 0.8;
  const hy = -46 + bob;

  ctx.save();
  ctx.translate(o.x, o.y);
  shadow(ctx, 0, 0, 15);
  ctx.scale(o.dirX, 1);

  const hairSway = Math.sin(o.t * 5) * (o.moving ? 2.5 : 1);
  const longHair = () => {
    pathRRect(ctx, -15 - hairSway, hy - 6, 24, 36, [12, 12, 10, 10]);
    fillStroke(ctx, f ? FLASH : C.hairDark, 2.5);
  };
  if (!o.back) longHair();

  legs(ctx, step, C.skin, C.boots, f);

  // 드레스
  ctx.beginPath();
  ctx.moveTo(-8, -35 + bob);
  ctx.lineTo(8, -35 + bob);
  ctx.quadraticCurveTo(14, -20 + bob, 15, -11 + bob);
  ctx.quadraticCurveTo(0, -7 + bob, -15, -11 + bob);
  ctx.quadraticCurveTo(-14, -20 + bob, -8, -35 + bob);
  ctx.closePath();
  fillStroke(ctx, f ? FLASH : linGrad(ctx, 0, -35, 0, -10, C.dress, C.dressDark), 2.5);
  // 흰 옷깃
  pathEllipse(ctx, 0, -33 + bob, 8, 3.5);
  fillStroke(ctx, f ? FLASH : C.collar, 1.5);
  // 두 손을 모은 모습
  pathEllipse(ctx, 4, -24 + bob, 4, 3.5);
  fillStroke(ctx, f ? FLASH : C.skin, 1.8);

  if (o.back) longHair();

  // 머리
  pathEllipse(ctx, 0, hy, 12.5, 12);
  fillStroke(ctx, f ? FLASH : C.skin, 2.5);
  if (o.back) {
    pathEllipse(ctx, 0, hy - 1, 13.5, 12.5);
    fillStroke(ctx, f ? FLASH : C.hair, 2.5);
  } else {
    ctx.beginPath();
    ctx.moveTo(-14, hy + 6);
    ctx.quadraticCurveTo(-16, hy - 15, 0, hy - 14);
    ctx.quadraticCurveTo(15, hy - 14, 14, hy - 2);
    ctx.quadraticCurveTo(8, hy - 4, 5, hy - 3);
    ctx.quadraticCurveTo(0, hy - 6, -4, hy - 3);
    ctx.quadraticCurveTo(-8, hy - 2, -9, hy + 6);
    ctx.closePath();
    fillStroke(ctx, f ? FLASH : C.hair, 2.5);
    if (!f) {
      if (isBlinking(o.t, 1.3)) {
        ctx.strokeStyle = C.eye; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(1, hy + 2); ctx.lineTo(5, hy + 2);
        ctx.moveTo(8, hy + 2); ctx.lineTo(12, hy + 2); ctx.stroke();
      } else {
        pathEllipse(ctx, 3.5, hy + 2, 2.2, 3.3); ctx.fillStyle = C.eye; ctx.fill();
        pathEllipse(ctx, 10, hy + 2, 2.2, 3.3); ctx.fill();
        pathEllipse(ctx, 3, hy + 1, 0.8, 1); ctx.fillStyle = '#fff'; ctx.fill();
        pathEllipse(ctx, 9.5, hy + 1, 0.8, 1); ctx.fill();
      }
      pathEllipse(ctx, 6.5, hy + 7, 3, 1.5); ctx.fillStyle = 'rgba(255,120,150,0.45)'; ctx.fill();
    }
  }
  // 리본
  ctx.save();
  ctx.translate(-9, hy - 10);
  ctx.rotate(-0.4);
  pathEllipse(ctx, -5, 0, 5, 3.5); fillStroke(ctx, f ? FLASH : C.ribbon, 1.8);
  pathEllipse(ctx, 5, 0, 5, 3.5); fillStroke(ctx, f ? FLASH : C.ribbon, 1.8);
  pathEllipse(ctx, 0, 0, 2.5, 2.5); fillStroke(ctx, f ? FLASH : C.ribbon, 1.5);
  ctx.restore();

  ctx.restore();
};

// =====================================================
// 2) 몬스터
// =====================================================

Art.slime = function (ctx, m) {
  const r = m.r;
  const sq = Math.sin(m.t * 8) * 0.12;
  const rx = r * (1 + sq), ry = r * 0.85 * (1 - sq);
  ctx.save();
  ctx.translate(m.x, m.y);
  shadow(ctx, 0, 0, r * 1.05);
  let fill = '#fff';
  if (!m.flash) {
    const g = ctx.createRadialGradient(-rx * 0.3, -ry * 1.4, 2, 0, -ry, rx * 1.2);
    g.addColorStop(0, m.def.light);
    g.addColorStop(1, m.def.color);
    fill = g;
  }
  pathEllipse(ctx, 0, -ry, rx, ry);
  fillStroke(ctx, fill, 2.5);
  pathEllipse(ctx, -rx * 0.4, -ry * 1.45, rx * 0.22, ry * 0.15, -0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  const lx = m.lookX * 3;
  ctx.fillStyle = OUTLINE;
  pathEllipse(ctx, -r * 0.3 + lx, -ry * 1.05, 2.4, 3.6); ctx.fill();
  pathEllipse(ctx, r * 0.3 + lx, -ry * 1.05, 2.4, 3.6); ctx.fill();
  ctx.restore();
};

Art.bat = function (ctx, m) {
  const float = -24 + Math.sin(m.t * 5) * 4;
  const flap = Math.sin(m.t * 22);
  ctx.save();
  ctx.translate(m.x, m.y);
  shadow(ctx, 0, 0, 10, 3.5);
  ctx.translate(0, float);
  const col = m.flash ? FLASH : m.def.color;
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * 6, -2);
    ctx.quadraticCurveTo(s * 18, -14 - flap * 10, s * 26, -6 - flap * 10);
    ctx.quadraticCurveTo(s * 20, 0, s * 18, 4);
    ctx.quadraticCurveTo(s * 13, 1, s * 10, 5);
    ctx.quadraticCurveTo(s * 8, 2, s * 6, 4);
    ctx.closePath();
    fillStroke(ctx, m.flash ? FLASH : m.def.dark, 2);
  });
  pathEllipse(ctx, 0, 0, 9, 8.5);
  fillStroke(ctx, col, 2.2);
  // 귀
  ctx.beginPath();
  ctx.moveTo(-6, -5); ctx.lineTo(-5, -13); ctx.lineTo(-1, -7);
  ctx.moveTo(6, -5); ctx.lineTo(5, -13); ctx.lineTo(1, -7);
  fillStroke(ctx, col, 2);
  ctx.fillStyle = '#ffde59';
  pathEllipse(ctx, -3 + m.lookX * 1.5, -1, 1.8, 2.2); ctx.fill();
  pathEllipse(ctx, 3 + m.lookX * 1.5, -1, 1.8, 2.2); ctx.fill();
  ctx.restore();
};

Art.golem = function (ctx, m) {
  const r = m.r;
  const step = Math.sin(m.t * 5);
  const bob = -Math.abs(step) * 2;
  ctx.save();
  ctx.translate(m.x, m.y);
  shadow(ctx, 0, 0, r * 1.1);
  ctx.scale(m.lookX < 0 ? -1 : 1, 1);
  const col = m.flash ? FLASH : m.def.color;
  const dark = m.flash ? FLASH : m.def.dark;
  // 다리
  pathRRect(ctx, -r * 0.6, -r * 0.5 - Math.max(0, step) * 3, r * 0.45, r * 0.5, 4); fillStroke(ctx, dark, 2.5);
  pathRRect(ctx, r * 0.15, -r * 0.5 - Math.max(0, -step) * 3, r * 0.45, r * 0.5, 4); fillStroke(ctx, dark, 2.5);
  // 팔
  pathRRect(ctx, -r * 1.15, -r * 1.55 + bob - step * 2, r * 0.45, r * 0.95, 6); fillStroke(ctx, dark, 2.5);
  // 몸통
  pathRRect(ctx, -r * 0.85, -r * 2.0 + bob, r * 1.7, r * 1.6, 10);
  fillStroke(ctx, m.flash ? FLASH : linGrad(ctx, 0, -r * 2, 0, -r * 0.4, m.def.light, col), 3);
  // 이끼
  if (!m.flash) {
    pathEllipse(ctx, -r * 0.35, -r * 1.95 + bob, r * 0.4, r * 0.15);
    ctx.fillStyle = '#6fa651'; ctx.fill();
  }
  // 빛나는 눈
  ctx.fillStyle = m.flash ? FLASH : '#7ef7ff';
  pathEllipse(ctx, r * 0.05, -r * 1.45 + bob, 3, 2.2); ctx.fill();
  pathEllipse(ctx, r * 0.45, -r * 1.45 + bob, 3, 2.2); ctx.fill();
  pathRRect(ctx, r * 0.7, -r * 1.55 + bob + step * 2, r * 0.45, r * 0.95, 6); fillStroke(ctx, dark, 2.5);
  ctx.restore();
};

Art.boss = function (ctx, m) {
  const r = m.r;
  const step = m.moving ? Math.sin(m.t * 6) : 0;
  const bob = Math.sin(m.t * 2) * 2;
  ctx.save();
  ctx.translate(m.x, m.y);
  // 보라색 오라
  const pulse = 0.5 + Math.sin(m.t * 4) * 0.2;
  pathEllipse(ctx, 0, 0, r * 1.5, r * 0.55);
  ctx.fillStyle = `rgba(150, 60, 220, ${0.25 * pulse})`; ctx.fill();
  shadow(ctx, 0, 0, r * 0.9);
  ctx.scale(m.lookX < 0 ? -1 : 1, 1);
  const f = m.flash;
  const armor = f ? FLASH : '#3d2c57';
  const armorLight = f ? FLASH : '#5b4580';
  // 망토
  const sway = Math.sin(m.t * 3) * 6;
  ctx.beginPath();
  ctx.moveTo(-18, -88 + bob);
  ctx.quadraticCurveTo(-55 - sway, -50, -48 - sway, -8);
  ctx.lineTo(-36 - sway, -16); ctx.lineTo(-28 - sway, -4); ctx.lineTo(-18, -14);
  ctx.lineTo(10, -20);
  ctx.lineTo(14, -88 + bob);
  ctx.closePath();
  fillStroke(ctx, f ? FLASH : '#8a1f3a', 3);
  // 다리
  pathRRect(ctx, -18 + step * 4, -32, 14, 32, 5); fillStroke(ctx, armor, 3);
  pathRRect(ctx, 4 - step * 4, -32, 14, 32, 5); fillStroke(ctx, armor, 3);
  // 몸통
  pathRRect(ctx, -26, -92 + bob, 52, 64, 16);
  fillStroke(ctx, f ? FLASH : linGrad(ctx, 0, -92, 0, -28, armorLight, armor), 3);
  pathEllipse(ctx, 0, -64 + bob, 8, 8);
  ctx.fillStyle = f ? FLASH : '#ff4d6d'; ctx.fill();
  // 투구
  const hy = -106 + bob;
  pathEllipse(ctx, 0, hy, 22, 21); fillStroke(ctx, armorLight, 3);
  // 뿔
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * 14, hy - 12);
    ctx.quadraticCurveTo(s * 34, hy - 20, s * 30, hy - 42);
    ctx.quadraticCurveTo(s * 24, hy - 24, s * 8, hy - 18);
    ctx.closePath();
    fillStroke(ctx, f ? FLASH : '#e8dcc8', 2.5);
  });
  // 눈 틈
  pathRRect(ctx, -4, hy - 3, 24, 6, 3);
  ctx.fillStyle = f ? FLASH : '#ff3355'; ctx.fill();
  // 큰 검
  ctx.save();
  ctx.translate(28, -60 + bob);
  ctx.rotate(m.state === 'aim' ? -1.2 : 0.4);
  pathRRect(ctx, -5, -6, 10, 70, 3); fillStroke(ctx, f ? FLASH : '#a7a3b8', 2.5);
  pathRRect(ctx, -14, -10, 28, 7, 3); fillStroke(ctx, f ? FLASH : '#6b2b8f', 2.5);
  ctx.restore();
  pathEllipse(ctx, 28, -60 + bob, 9, 9); fillStroke(ctx, armor, 2.5);
  ctx.restore();
};

// =====================================================
// 3) 대화창 일러스트 (큰 그림)
//    (cx, bottom) = 그림 아래쪽 가운데 위치, s = 크기 배율
//    face = 'normal' | 'smile' | 'worry' | 'surprise' | 'angry'
// =====================================================

function portraitEye(ctx, x, y, side, iris, irisDark, face, blink, lash) {
  if (face === 'smile') {
    // 웃는 눈 ^ ^
    ctx.beginPath();
    ctx.arc(x, y + 8, 17, Math.PI * 1.15, Math.PI * 1.85);
    ctx.lineWidth = 5; ctx.strokeStyle = OUTLINE; ctx.lineCap = 'round'; ctx.stroke();
    return;
  }
  const open = blink ? 0.08 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, open);
  pathEllipse(ctx, 0, 0, 17, 21);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.save();
  ctx.clip();
  const pr = face === 'surprise' ? 0.55 : 1;
  pathEllipse(ctx, 0, 3, 13 * (face === 'surprise' ? 0.8 : 1), 17 * (face === 'surprise' ? 0.8 : 1));
  ctx.fillStyle = linGrad(ctx, 0, -14, 0, 20, irisDark, iris);
  ctx.fill();
  pathEllipse(ctx, 0, 4, 6 * pr, 9 * pr);
  ctx.fillStyle = '#1b1426'; ctx.fill();
  pathEllipse(ctx, -5, -5, 4.5, 5.5); ctx.fillStyle = '#ffffff'; ctx.fill();
  pathEllipse(ctx, 5, 10, 2, 2); ctx.fill();
  ctx.restore();
  ctx.restore();
  // 윗 속눈썹
  ctx.beginPath();
  ctx.ellipse(x, y, 19, 22 * open, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.lineWidth = lash; ctx.strokeStyle = OUTLINE; ctx.lineCap = 'round'; ctx.stroke();
  if (lash > 5 && !blink) {
    // 여자 캐릭터는 바깥쪽 속눈썹을 살짝 추가
    ctx.beginPath();
    ctx.moveTo(x + side * 17, y - 12);
    ctx.lineTo(x + side * 25, y - 18);
    ctx.lineWidth = 3; ctx.stroke();
  }
}

function portraitFace(ctx, opt) {
  const { face, t, iris, irisDark, lash, blinkOffset } = opt;
  const blink = isBlinking(t, blinkOffset);
  const ey = -252;
  // 볼터치
  const blushA = face === 'smile' ? 0.5 : 0.3;
  pathEllipse(ctx, -50, -222, 15, 8); ctx.fillStyle = `rgba(255,120,140,${blushA})`; ctx.fill();
  pathEllipse(ctx, 50, -222, 15, 8); ctx.fill();
  // 눈
  portraitEye(ctx, -33, ey, -1, iris, irisDark, face, blink, lash);
  portraitEye(ctx, 33, ey, 1, iris, irisDark, face, blink, lash);
  // 눈썹
  const base = ey - 36;
  let inner = base, outer = base;
  if (face === 'worry') { inner = base - 8; outer = base + 3; }
  if (face === 'angry') { inner = base + 7; outer = base - 5; }
  if (face === 'surprise') { inner = base - 9; outer = base - 9; }
  if (face === 'smile') { inner = base - 3; outer = base - 3; }
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4; ctx.lineCap = 'round';
  [-1, 1].forEach((s) => {
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

function portraitLeon(ctx, face, t) {
  const C = HERO_COLORS;
  // 몸 + 어깨
  ctx.beginPath();
  ctx.moveTo(-175, 0);
  ctx.bezierCurveTo(-170, -90, -125, -132, -50, -140);
  ctx.lineTo(50, -140);
  ctx.bezierCurveTo(125, -132, 170, -90, 175, 0);
  ctx.closePath();
  fillStroke(ctx, linGrad(ctx, 0, -140, 0, 0, C.tunic, C.tunicDark), 4);
  // 가죽 끈
  ctx.beginPath();
  ctx.moveTo(-60, -138); ctx.lineTo(70, 0); ctx.lineTo(100, 0); ctx.lineTo(-25, -140);
  ctx.closePath();
  fillStroke(ctx, C.belt, 3);
  // 어깨 갑옷
  [-1, 1].forEach((s) => {
    pathEllipse(ctx, s * 118, -100, 56, 34, s * 0.35);
    fillStroke(ctx, linGrad(ctx, 0, -134, 0, -66, '#eef2f8', '#9aa6ba'), 4);
  });
  // 목
  pathRRect(ctx, -24, -205, 48, 75, 20);
  fillStroke(ctx, '#f2c4a6', 3);
  // 스카프
  pathEllipse(ctx, 0, -142, 66, 24);
  fillStroke(ctx, C.cape, 4);
  // 뒷머리
  pathEllipse(ctx, 0, -284, 94, 92);
  fillStroke(ctx, C.hair, 4);
  // 귀
  pathEllipse(ctx, -77, -248, 12, 18); fillStroke(ctx, C.skin, 3);
  pathEllipse(ctx, 77, -248, 12, 18); fillStroke(ctx, C.skin, 3);
  // 얼굴
  facePath(ctx);
  fillStroke(ctx, C.skin, 4);
  portraitFace(ctx, { face, t, iris: '#6fa8ff', irisDark: '#23468f', lash: 5, blinkOffset: 0 });
  // 앞머리 (뾰족뾰족)
  ctx.beginPath();
  ctx.moveTo(-94, -268);
  ctx.bezierCurveTo(-100, -360, -40, -385, 10, -382);
  ctx.bezierCurveTo(80, -378, 105, -330, 94, -262);
  ctx.lineTo(84, -232);
  ctx.lineTo(70, -290);
  ctx.lineTo(48, -248);
  ctx.lineTo(28, -300);
  ctx.lineTo(6, -258);
  ctx.lineTo(-14, -302);
  ctx.lineTo(-38, -250);
  ctx.lineTo(-56, -296);
  ctx.lineTo(-80, -236);
  ctx.closePath();
  fillStroke(ctx, linGrad(ctx, 0, -385, 0, -240, C.hairLight, C.hair), 4);
  // 머리 윤기
  ctx.beginPath();
  ctx.moveTo(-50, -350); ctx.quadraticCurveTo(-10, -366, 30, -356);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
}

function portraitLuna(ctx, face, t) {
  const C = LUNA_COLORS;
  const sway = Math.sin(t * 1.5) * 3;
  // 긴 뒷머리
  ctx.beginPath();
  ctx.moveTo(-100, -300);
  ctx.bezierCurveTo(-130, -200, -140 + sway, -80, -125 + sway, -20);
  ctx.quadraticCurveTo(-60, 10, 0, -10);
  ctx.quadraticCurveTo(60, 10, 125 + sway, -20);
  ctx.bezierCurveTo(140 + sway, -80, 130, -200, 100, -300);
  ctx.closePath();
  fillStroke(ctx, linGrad(ctx, 0, -300, 0, 0, C.hair, C.hairDark), 4);
  // 몸 (드레스)
  ctx.beginPath();
  ctx.moveTo(-150, 0);
  ctx.bezierCurveTo(-145, -80, -110, -125, -45, -138);
  ctx.lineTo(45, -138);
  ctx.bezierCurveTo(110, -125, 145, -80, 150, 0);
  ctx.closePath();
  fillStroke(ctx, linGrad(ctx, 0, -138, 0, 0, C.dress, C.dressDark), 4);
  // 목
  pathRRect(ctx, -21, -200, 42, 70, 18);
  fillStroke(ctx, '#f5cdb6', 3);
  // 흰 옷깃
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(0, -128);
    ctx.quadraticCurveTo(s * 50, -150, s * 78, -128);
    ctx.quadraticCurveTo(s * 60, -96, 0, -108);
    ctx.closePath();
    fillStroke(ctx, C.collar, 3);
  });
  // 초승달 펜던트
  ctx.save();
  ctx.translate(0, -92);
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.arc(5, -4, 11, 0, Math.PI * 2, true);
  ctx.fillStyle = '#ffe27a'; ctx.fill('evenodd');
  ctx.restore();
  // 얼굴
  facePath(ctx);
  fillStroke(ctx, C.skin, 4);
  portraitFace(ctx, { face, t, iris: '#c49bff', irisDark: '#5b2f9a', lash: 6.5, blinkOffset: 1.3 });
  // 앞머리 (부드러운 곡선)
  ctx.beginPath();
  ctx.moveTo(-92, -250);
  ctx.bezierCurveTo(-104, -350, -40, -382, 0, -380);
  ctx.bezierCurveTo(40, -382, 104, -350, 92, -250);
  ctx.quadraticCurveTo(80, -270, 66, -268);
  ctx.quadraticCurveTo(52, -300, 34, -280);
  ctx.quadraticCurveTo(18, -305, 0, -284);
  ctx.quadraticCurveTo(-18, -305, -34, -280);
  ctx.quadraticCurveTo(-52, -300, -66, -268);
  ctx.quadraticCurveTo(-80, -270, -92, -250);
  ctx.closePath();
  fillStroke(ctx, linGrad(ctx, 0, -380, 0, -250, '#fbe0ee', C.hair), 4);
  // 옆머리 가닥 (얼굴 앞으로 내려옴)
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * 80, -290);
    ctx.bezierCurveTo(s * 100, -220, s * (92 + sway), -150, s * 102, -95);
    ctx.quadraticCurveTo(s * 86, -110, s * 72, -100);
    ctx.bezierCurveTo(s * 80, -160, s * 70, -230, s * 66, -270);
    ctx.closePath();
    fillStroke(ctx, C.hair, 3.5);
  });
  // 리본
  ctx.save();
  ctx.translate(72, -342);
  ctx.rotate(0.35);
  pathEllipse(ctx, -24, 0, 24, 15, -0.2); fillStroke(ctx, C.ribbon, 3.5);
  pathEllipse(ctx, 24, 0, 24, 15, 0.2); fillStroke(ctx, C.ribbon, 3.5);
  pathEllipse(ctx, 0, 0, 10, 10); fillStroke(ctx, '#9b80ea', 3);
  ctx.restore();
  // 머리 윤기
  ctx.beginPath();
  ctx.moveTo(-55, -352); ctx.quadraticCurveTo(-10, -368, 35, -356);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
}

const PORTRAITS = { leon: portraitLeon, luna: portraitLuna };

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
