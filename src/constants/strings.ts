/**
 * UI 문구 모음.
 * 감정적 표현 / 평가 표현 금지.
 * "좋다 / 나쁘다 / 최고 / 최악 / 승 / 패" 같은 단어를 쓰지 않는다.
 */
export const strings = {
  appName: 'KPOL',
  appTagline: '대한민국 정치 흐름 터미널',

  // 섹션
  todayFlow: '오늘의 정치 흐름',
  mentionSurge: '뉴스 언급량 급증',
  topMentioned: '오늘 많이 언급된 인물',
  themeSurge: '급등 테마',
  influenceFlow: '영향력 인물 흐름',
  watchlist: '관심 인물',

  // 라벨
  mentions: '언급',
  change: '변화',
  keywords: '키워드',
  themes: '테마',
  recentNews: '최근 뉴스',
  recentFlow: '최근 흐름',
  party: '정당',
  position: '직책',
  region: '지역',

  // 변화량 표기 (감정 배제)
  up: '증가',
  down: '감소',
  flat: '변동 없음',

  // 검색 / 설정
  searchPlaceholder: '인물 · 정당 · 정책 검색',
  noResults: '결과 없음',
  settings: '설정',
  about: 'KPOL 정보',
  dataPolicy: '데이터 정책',
  disclaimer: '면책 조항',

  // 면책 (의견 없음 원칙)
  disclaimerBody:
    'KPOL은 뉴스 및 공개 데이터 기반의 흐름 시각화 서비스입니다. ' +
    '운영자/사용자 의견, 평가, 토론, 선거 예측을 제공하지 않습니다.',
} as const;
