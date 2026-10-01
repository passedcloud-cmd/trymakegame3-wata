// =====================================================
// input.js — 키보드 입력 관리
// 키 배치를 바꾸고 싶으면 아래 KEYMAP만 고치면 돼요.
// (키 이름 목록: https://developer.mozilla.org/docs/Web/API/KeyboardEvent/code)
// =====================================================

const KEYMAP = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  attack: ['KeyZ', 'ShiftLeft'],        // 공격 (누르고 있으면 계속 휘둘러요)
  skill: ['KeyX', 'KeyA'],              // 스킬: 수호의 빛
  confirm: ['KeyZ', 'Enter', 'Space'],  // 대화 넘기기 / 선택
  back: ['KeyX', 'Backspace'],
  skip: ['Escape'],                     // 대화 건너뛰기
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
};

const Input = {
  down: new Set(),    // 지금 눌려 있는 키
  pressed: new Set(), // 이번 프레임에 "새로" 눌린 키

  init() {
    window.addEventListener('keydown', (e) => {
      // 방향키·스페이스로 페이지가 스크롤되지 않게 막기
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      Sound.unlock(); // 브라우저는 키를 한 번 눌러야 소리를 허용해요
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    // 창 밖으로 포커스가 나가면 눌린 키 초기화 (키가 계속 눌린 상태로 남는 버그 방지)
    window.addEventListener('blur', () => this.down.clear());
  },

  isDown(action) {
    return KEYMAP[action].some((k) => this.down.has(k));
  },

  wasPressed(action) {
    return KEYMAP[action].some((k) => this.pressed.has(k));
  },

  // 매 프레임 끝에 호출해서 "새로 눌림" 기록을 지워요
  endFrame() {
    this.pressed.clear();
  },
};

Input.init();
