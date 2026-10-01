// =====================================================
// story.js — 캐릭터 이름과 대사
// 원작: 「나를 먹고 싶은, 괴물」 (팬게임)
//
// 대사 한 줄 = { who: 누가 말하는지, face: 표정, text: 대사 }
//   who  : 'shiori' | 'hinako' | null(해설)
//   face : 'normal' | 'smile' | 'smirk'(능글맞은 미소) | 'sleepy'(졸린 눈)
//          | 'worry' | 'surprise' | 'angry'
// =====================================================

const CHARACTERS = {
  shiori: { name: '시오리', color: '#4f7fd6' }, // 플레이어 (인어 요괴, 존댓말)
  hinako: { name: '히나코', color: '#a8714a' }, // 보호 대상 (반말)
};

const PROLOGUE = [
  { who: null, text: '하굣길. 오늘도 히나코의 냄새를 맡은 요괴들이 하나둘 모여들기 시작했다.' },
  { who: 'hinako', face: 'sleepy', text: '…또 왔네. 요괴.' },
  { who: 'shiori', face: 'smirk', text: '히나코는 정말 인기가 많네요. 요괴한테만요.' },
  { who: 'hinako', face: 'normal', text: '하나도 안 기뻐. …미안, 시오리. 또 귀찮게 해서.' },
  { who: 'shiori', face: 'smile', text: '사과할 필요 없어요. 히나코를 다른 녀석들한테 넘겨줄 생각은 없으니까요.' },
  { who: 'shiori', face: 'angry', text: '제 뒤에 딱 붙어 계세요. 오른팔, 잠깐만 쓸게요.' },
  { who: null, text: '방향키로 이동, Z로 손톱 공격, X로 「파도 장벽」! 히나코가 쓰러지면 끝이야.' },
];

const STAGE_STORIES = [
  // 1장 클리어 후
  [
    { who: 'hinako', face: 'sleepy', text: '…끝났어?' },
    { who: 'shiori', face: 'smirk', text: '네, 깔끔하게요. 히나코, 다친 데는 없어요?' },
    { who: 'hinako', face: 'normal', text: '응. 시오리 덕분에. …그 손톱, 안 아파?' },
    { who: 'shiori', face: 'surprise', text: '어머, 걱정해 주시는 거예요? 의외네요.' },
    { who: 'hinako', face: 'sleepy', text: '…그냥 물어본 거야.' },
    { who: 'shiori', face: 'smile', text: '후후, 그럼 그런 걸로 해 둘게요. 해 지기 전에 바닷가 쪽으로 돌아서 가요.' },
  ],
  // 2장 클리어 후
  [
    { who: 'shiori', face: 'worry', text: '해가 지니까 수가 확 늘었네요. 히나코 냄새가 바닷바람을 타고 퍼지나 봐요.' },
    { who: 'hinako', face: 'worry', text: '…나 때문에 시오리가 계속 싸우잖아.' },
    { who: 'shiori', face: 'normal', text: '히나코.' },
    { who: 'shiori', face: 'smirk', text: '저는 제가 하고 싶은 걸 하고 있을 뿐이에요. 그러니까 그런 얼굴 하지 마세요.' },
    { who: 'hinako', face: 'sleepy', text: '…알았어. 그럼 고맙다고만 할게.' },
    { who: 'shiori', face: 'smile', text: '네, 그거면 충분해요. 마지막으로 신사 앞을 지나야 하는데… 저쪽에서 큰 녀석 기운이 느껴지네요.' },
  ],
  // 3장 클리어 후 (엔딩)
  [
    { who: null, text: '거대한 요괴가 쓰러지자, 밤의 신사에 다시 고요함이 찾아왔다.' },
    { who: 'hinako', face: 'surprise', text: '…진짜로 이겼네.' },
    { who: 'shiori', face: 'smirk', text: '당연하죠. 히나코를 그렇게 쉽게 먹히게 둘 리가 없잖아요.' },
    { who: 'hinako', face: 'normal', text: '시오리. …오늘, 고마워.' },
    { who: 'shiori', face: 'surprise', text: '…히나코가 먼저 그런 말을 하다니. 내일 비라도 오려나요.' },
    { who: 'hinako', face: 'sleepy', text: '…집에 갈래.' },
    { who: 'shiori', face: 'smile', text: '네, 집까지 바래다 드릴게요. 제 뒤에 딱 붙어서요.' },
    { who: null, text: '두 사람의 그림자가 나란히, 바닷가 마을의 밤길을 걸어갔다.' },
  ],
];
