import type { Politician } from '../types';

/**
 * Fake Data — 실 데이터 연동 전까지의 UI 검증용.
 * 인물 선정과 수치는 임의이며 실제 평가/예측이 아니다.
 * 영향력 인물(평론가/유튜버/플랫폼/인플루언서)은 모두 가상 인물명을 사용한다.
 */
export const fakePoliticians: Politician[] = [
  // ── 선출직 (국회의원) ──────────────────────────────
  {
    id: 'p_001',
    name: '김민수',
    personType: 'elected_official',
    party: '제1정당',
    position: '국회의원 · 3선',
    region: '서울 강남갑',
    mentionCount: 142,
    mentionChange: 38.2,
    keywords: ['부동산', '재건축', '세제'],
    themes: ['부동산', '서울'],
  },
  {
    id: 'p_002',
    name: '이정현',
    personType: 'elected_official',
    party: '제2정당',
    position: '국회의원 · 재선',
    region: '경기 성남분당',
    mentionCount: 118,
    mentionChange: 22.1,
    keywords: ['AI', '반도체', 'R&D'],
    themes: ['AI/기술', '경제'],
  },
  {
    id: 'p_003',
    name: '박서연',
    personType: 'elected_official',
    party: '제3정당',
    position: '국회의원 · 초선',
    region: '비례',
    mentionCount: 96,
    mentionChange: 14.5,
    keywords: ['청년', '주거', '일자리'],
    themes: ['청년', '주거'],
  },

  // ── 지역 정치 (광역단체장) ─────────────────────────
  {
    id: 'p_004',
    name: '최정우',
    personType: 'local_government',
    party: '제1정당',
    position: '광역시장',
    region: '부산',
    mentionCount: 81,
    mentionChange: -6.3,
    keywords: ['항만', '관광', '엑스포'],
    themes: ['지역', '경제'],
  },
  {
    id: 'p_005',
    name: '한도윤',
    personType: 'local_government',
    party: '제2정당',
    position: '도지사',
    region: '경기',
    mentionCount: 73,
    mentionChange: 9.0,
    keywords: ['교통', 'GTX', '신도시'],
    themes: ['교통', '부동산'],
  },

  // ── 선출직 (국회의원) ──────────────────────────────
  {
    id: 'p_006',
    name: '윤하늘',
    personType: 'elected_official',
    party: '제1정당',
    position: '국회의원 · 초선',
    region: '대구 수성',
    mentionCount: 64,
    mentionChange: 41.0,
    keywords: ['연금', '복지', '재정'],
    themes: ['연금', '복지'],
  },
  {
    id: 'p_007',
    name: '오세훈',
    personType: 'elected_official',
    party: '제3정당',
    position: '국회의원 · 재선',
    region: '광주 서구',
    mentionCount: 58,
    mentionChange: -2.1,
    keywords: ['교육', '대학', '입시'],
    themes: ['교육'],
  },
  {
    id: 'p_008',
    name: '서지안',
    personType: 'elected_official',
    party: '제2정당',
    position: '국회의원 · 3선',
    region: '인천 연수',
    mentionCount: 52,
    mentionChange: 5.6,
    keywords: ['외교', '안보', '한미'],
    themes: ['외교안보'],
  },

  // ── 정당 지도부 ───────────────────────────────────
  {
    id: 'p_009',
    name: '조은하',
    personType: 'party_leader',
    party: '제1정당',
    position: '당대표',
    region: '비례',
    mentionCount: 134,
    mentionChange: 18.4,
    keywords: ['공천', '당론', '원내전략'],
    themes: ['정당'],
  },

  // ── 영향력 인물 (모두 가상 인물명) ─────────────────
  {
    id: 'p_010',
    name: '한지호',
    personType: 'political_youtuber',
    affiliation: '정치노트',
    position: '유튜브 채널 운영',
    mentionCount: 78,
    mentionChange: 24.3,
    keywords: ['공천', '경선', '여의도'],
    themes: ['정당'],
  },
  {
    id: 'p_011',
    name: '정현우',
    personType: 'political_commentator',
    affiliation: '프레스인사이트',
    position: '정치 칼럼 · 방송 패널',
    mentionCount: 64,
    mentionChange: 15.8,
    keywords: ['예산', '국정감사', '입법'],
    themes: ['경제'],
  },
  {
    id: 'p_012',
    name: '강민지',
    personType: 'political_platform_operator',
    affiliation: '폴리뷰',
    position: '정치 데이터 플랫폼 운영',
    mentionCount: 52,
    mentionChange: 11.0,
    keywords: ['데이터', '여론조사', '공약'],
    themes: ['AI/기술'],
  },
  {
    id: 'p_013',
    name: '임수아',
    personType: 'political_influencer',
    position: '정치 SNS 콘텐츠',
    mentionCount: 46,
    mentionChange: 32.5,
    keywords: ['청년', 'SNS', '정치참여'],
    themes: ['청년'],
  },
];

export const findPoliticianById = (id: string): Politician | undefined =>
  fakePoliticians.find((p) => p.id === id);
