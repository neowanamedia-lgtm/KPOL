import type { NewsItem } from '../types';

export const fakeNews: NewsItem[] = [
  {
    id: 'n_001',
    title: '재건축 안전진단 기준 개편안 논의 진전',
    source: '연합뉴스',
    publishedAt: '2026-05-19T08:14:00+09:00',
    politicianIds: ['p_001'],
    keywords: ['재건축', '부동산'],
  },
  {
    id: 'n_002',
    title: '국가 AI 컴퓨팅 인프라 예산 심사 본격화',
    source: '한국경제',
    publishedAt: '2026-05-19T07:42:00+09:00',
    politicianIds: ['p_002'],
    keywords: ['AI', 'R&D'],
  },
  {
    id: 'n_003',
    title: '청년 주거 지원 확대 법안 발의',
    source: '뉴시스',
    publishedAt: '2026-05-18T18:05:00+09:00',
    politicianIds: ['p_003'],
    keywords: ['청년', '주거'],
  },
  {
    id: 'n_004',
    title: '연금 개혁 위원회 추가 안건 상정',
    source: '서울신문',
    publishedAt: '2026-05-18T15:22:00+09:00',
    politicianIds: ['p_006'],
    keywords: ['연금', '복지'],
  },
  {
    id: 'n_005',
    title: 'GTX-D 노선 환경영향평가 절차 진행',
    source: '머니투데이',
    publishedAt: '2026-05-18T11:01:00+09:00',
    politicianIds: ['p_005'],
    keywords: ['GTX', '교통'],
  },
  {
    id: 'n_006',
    title: '엑스포 부지 조성 사업 추가 예산 검토',
    source: '부산일보',
    publishedAt: '2026-05-17T20:48:00+09:00',
    politicianIds: ['p_004'],
    keywords: ['엑스포', '부산'],
  },
  // 영향력 인물 관련 — 모두 사실 형식의 가상 제목
  {
    id: 'n_007',
    title: '당대표 취임 100일 회견, 당론 방향 정리',
    source: '뉴스1',
    publishedAt: '2026-05-19T09:20:00+09:00',
    politicianIds: ['p_009'],
    keywords: ['당대표', '당론'],
  },
  {
    id: 'n_008',
    title: "유튜브 채널 '정치노트' 분기 누적 조회수 발표",
    source: '미디어오늘',
    publishedAt: '2026-05-18T13:10:00+09:00',
    politicianIds: ['p_010'],
    keywords: ['유튜브', '미디어'],
  },
  {
    id: 'n_009',
    title: '프레스인사이트 칼럼 — 예산 심사 일정 정리',
    source: '프레스인사이트',
    publishedAt: '2026-05-18T08:00:00+09:00',
    politicianIds: ['p_011'],
    keywords: ['예산', '국정감사'],
  },
  {
    id: 'n_010',
    title: "정치 데이터 플랫폼 '폴리뷰', 공약 데이터셋 공개",
    source: '디지털데일리',
    publishedAt: '2026-05-17T17:30:00+09:00',
    politicianIds: ['p_012'],
    keywords: ['데이터', '공약'],
  },
  {
    id: 'n_011',
    title: '청년 정치참여 캠페인 SNS 인용 건수 집계',
    source: '아이뉴스24',
    publishedAt: '2026-05-17T11:05:00+09:00',
    politicianIds: ['p_013'],
    keywords: ['청년', 'SNS'],
  },
];

export const newsByPolitician = (politicianId: string): NewsItem[] =>
  fakeNews.filter((n) => n.politicianIds.includes(politicianId));
