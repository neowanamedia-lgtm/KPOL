export type ChangeDirection = 'up' | 'down' | 'flat';

/**
 * 인물 유형.
 * 통합 기획안 v2 인물시장 분류 + 영향력시장 항목을 합친 카테고리.
 * 평가/성향 표시가 아닌 분류 목적의 라벨이다.
 */
export type PersonType =
  | 'elected_official'             // 선출직 (국회의원 등 중앙 선출직)
  | 'party_leader'                 // 정당 지도부
  | 'local_government'             // 지역 정치 (광역·기초 단체장/의원)
  | 'political_commentator'        // 정치 평론가
  | 'political_youtuber'           // 정치 유튜버
  | 'political_platform_operator'  // 정치 플랫폼 운영자
  | 'political_influencer';        // 정치 인플루언서

export interface Politician {
  id: string;
  name: string;
  /** 인물 유형 — 분류 라벨 (평가 아님) */
  personType: PersonType;
  /** 정당 — 비정당 인물(평론가/유튜버 등)은 비어 있음 */
  party?: string;
  /** 비정당 소속(채널/매체/플랫폼명 등) — 정당 없는 인물에 한해 사용 */
  affiliation?: string;
  /** 직책 또는 활동 형태 (예: "국회의원 · 3선", "유튜브 채널 운영") */
  position: string;
  /** 지역 — 영향력 인물은 비어 있을 수 있음 */
  region?: string;
  /** 최근 1일 기사 언급 횟수 */
  mentionCount: number;
  /** 직전 동일 기간 대비 변화율 (%) — 음수 가능 */
  mentionChange: number;
  /** 연결 키워드 */
  keywords: string[];
  /** 연결 테마 */
  themes: string[];
}

export interface ThemeFlow {
  id: string;
  name: string;
  /** 기사 언급량 */
  mentionCount: number;
  /** 변화율 (%) */
  mentionChange: number;
  /** 관련 정치인 ID */
  relatedPoliticianIds: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  /** ISO 날짜 문자열 */
  publishedAt: string;
  /** 관련 정치인 ID */
  politicianIds: string[];
  /** 추출 키워드 */
  keywords: string[];
}

export interface FlowPoint {
  /** ISO 날짜 */
  date: string;
  /** 해당 일자 언급량 */
  value: number;
}

export interface DailyFlowSummary {
  /** ISO 날짜 */
  date: string;
  /** 오늘 전체 기사 수 */
  totalArticles: number;
  /** 어제 대비 변화율 (%) */
  totalChange: number;
  /** 활성 테마 수 */
  activeThemes: number;
  /** 흐름 요약 한 줄 — 사실 기반, 의견 금지 */
  headline: string;
}
