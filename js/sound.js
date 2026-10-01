// =====================================================
// sound.js — 간단한 효과음 (파일 없이 코드로 소리를 만들어요)
// M 키로 음소거를 켜고 끌 수 있어요.
// =====================================================

const Sound = {
  ctx: null,
  muted: false,

  unlock() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.ctx = null;
    }
  },

  // freq: 시작 음 높이, to: 끝 음 높이, dur: 길이(초)
  tone(freq, to, dur, type = 'sine', vol = 0.15, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  swing()   { this.tone(900, 250, 0.09, 'triangle', 0.06); },
  hit()     { this.tone(260, 90, 0.08, 'square', 0.05); },
  kill()    { this.tone(500, 120, 0.12, 'triangle', 0.06); },
  pickup()  { this.tone(1100, 1600, 0.06, 'sine', 0.05); },
  heal()    { this.tone(600, 1200, 0.25, 'sine', 0.08); },
  hurt()    { this.tone(220, 80, 0.2, 'sawtooth', 0.08); },
  skill()   { this.tone(300, 1200, 0.35, 'sine', 0.12); this.tone(450, 1800, 0.35, 'triangle', 0.05, 0.05); },
  select()  { this.tone(700, 900, 0.05, 'sine', 0.06); },
  text()    { this.tone(1200, 1100, 0.02, 'sine', 0.015); },
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.15, 'triangle', 0.08, i * 0.08)); },
  clear()   { [523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.2, 'triangle', 0.08, i * 0.12)); },
  fail()    { [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.98, 0.3, 'triangle', 0.08, i * 0.2)); },
  warning() { [0, 0.35, 0.7].forEach((d) => this.tone(180, 160, 0.25, 'sawtooth', 0.07, d)); },
};
