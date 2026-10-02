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
  skill: ['KeyX', 'KeyA'],              // 스킬: 파도 장벽
  dash: ['KeyC'],                       // 대시 (짧게 휙 이동)
  confirm: ['KeyZ', 'Enter', 'Space'],  // 대화 넘기기 / 선택
  back: ['KeyX', 'Backspace'],
  skip: ['KeyS'],                       // 스토리 건너뛰기
  pause: ['Escape', 'KeyP'],            // 일시정지 메뉴 열기/닫기
  mute: ['KeyM'],
};

const Input = {
  down: new Set(),    // 지금 눌려 있는 키
  pressed: new Set(), // 이번 프레임에 "새로" 눌린 키
  // 마우스: 게임 화면 기준 좌표(1280x720)로 바꿔서 저장해요
  mouse: { x: -1, y: -1, clicked: false, moved: false },

  init() {
    const toGame = (e) => {
      const canvas = document.getElementById('game');
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 1280;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * 720;
    };
    window.addEventListener('mousemove', (e) => { toGame(e); this.mouse.moved = true; });
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      toGame(e);
      this.mouse.clicked = true;
      Sound.unlock();
    });

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
    this.mouse.clicked = false;
    this.mouse.moved = false;
  },
};

Input.init();
