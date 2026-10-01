// =====================================================
// story.js — 캐릭터 이름과 대사
// 팬게임 원작에 맞게 이름과 대사를 마음대로 바꿔 보세요!
//
// 대사 한 줄 = { who: 누가 말하는지, face: 표정, text: 대사 }
//   who  : 'leon' | 'luna' | null(해설)
//   face : 'normal' | 'smile' | 'worry' | 'surprise' | 'angry'
// =====================================================

const CHARACTERS = {
  leon: { name: '레온', color: '#4a7bd0' }, // 플레이어 (지키는 사람)
  luna: { name: '루나', color: '#a978e0' }, // 보호 대상
};

const PROLOGUE = [
  { who: null, text: '어둠이 번지는 왕국. 그 어둠을 잠재울 수 있는 건 달의 무녀, 루나의 노래뿐이다.' },
  { who: 'luna', face: 'worry', text: '저… 정말 신전까지 저를 데려가 주실 건가요?' },
  { who: 'leon', face: 'normal', text: '그게 내 임무니까. 걱정 마, 내 뒤에만 꼭 붙어 있어.' },
  { who: 'luna', face: 'smile', text: '네! 레온 씨 뒤에 딱 붙어 있을게요!' },
  { who: 'leon', face: 'surprise', text: '…너무 딱 붙지는 말고.' },
  { who: null, text: '방향키로 이동, Z로 공격, X로 「수호의 빛」! 루나가 쓰러지면 끝이야.' },
];

const STAGE_STORIES = [
  // 1장 클리어 후
  [
    { who: 'luna', face: 'surprise', text: '와아… 그 많은 슬라임을 전부…!' },
    { who: 'leon', face: 'normal', text: '다친 데는 없어?' },
    { who: 'luna', face: 'smile', text: '네! 레온 씨가 막아 줘서 하나도 안 아파요.' },
    { who: 'luna', face: 'worry', text: '그런데… 숲을 빠져나가면 황혼의 들판이에요. 거긴 박쥐들이 엄청 많대요.' },
    { who: 'leon', face: 'angry', text: '박쥐든 뭐든, 너한테는 손끝 하나 못 대게 할 거야.' },
  ],
  // 2장 클리어 후
  [
    { who: 'leon', face: 'worry', text: '하아… 하아… 돌덩이 녀석들, 생각보다 단단하네.' },
    { who: 'luna', face: 'worry', text: '레온 씨! 팔에서 피가…!' },
    { who: 'luna', face: 'normal', text: '잠깐만요. …달빛이여, 이 사람의 상처를 감싸 주세요.' },
    { who: 'leon', face: 'surprise', text: '상처가… 사라졌어?' },
    { who: 'luna', face: 'smile', text: '저도 지켜지기만 하는 건 아니라고요. 헤헤.' },
    { who: 'leon', face: 'smile', text: '…그래. 든든하네. 이제 폐허의 성만 넘으면 신전이야.' },
  ],
  // 3장 클리어 후 (엔딩)
  [
    { who: null, text: '그림자 기사가 쓰러지자, 성을 덮고 있던 어둠이 걷히기 시작했다.' },
    { who: 'luna', face: 'surprise', text: '해냈어요… 우리가 해냈어요, 레온 씨!' },
    { who: 'leon', face: 'smile', text: '네가 끝까지 내 뒤에 있어 줬으니까.' },
    { who: 'luna', face: 'smile', text: '약속했잖아요. 딱 붙어 있겠다고.' },
    { who: 'luna', face: 'normal', text: '이제 노래할게요. 이 왕국에 다시 아침이 오도록.' },
    { who: null, text: '달의 노래가 울려 퍼지고, 긴 밤이 끝났다.' },
  ],
];
