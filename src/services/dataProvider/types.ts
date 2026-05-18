/**
 * DataProvider 인터페이스 + API 응답 컨트랙트.
 *
 * 앱은 이 인터페이스만 알면 된다.
 * 현재 FakeDataProvider가 구현하지만, 내일 SupabaseDataProvider로 한 줄 교체.
 *
 * 모든 응답에는 산정 기준 라벨(basis_label)과 집계 시각(as_of)이 포함된다.
 * KPOL 데이터 원칙: 모든 변화는 근거를 표시한다.
 */

import type {
  DataMode,
  DateString,
  Iso,
  PersonType,
  RankingType,
} from '../../db/types';
import type { InterestTarget, RecommendedTarget } from '../../types/widget';

// ─────────────────────────────────────────────────────────────
// 공통: 모든 응답에 동봉되는 메타
// ─────────────────────────────────────────────────────────────
export interface ResponseMeta {
  basis_label: string;        // 예: "뉴스 언급량 기준"
  as_of: Iso;                 // 데이터 집계 시각
  data_mode: DataMode;        // 'demo' | 'live' — UI가 DEMO 라벨 결정
}

// ─────────────────────────────────────────────────────────────
// 마지막 업데이트
// ─────────────────────────────────────────────────────────────
export interface LastUpdateStatus extends ResponseMeta {
  last_success_at: Iso | null;
  job_id: string | null;
  age_label: string;          // "12분 전", "오늘 03:20" 같은 사람용 표기
}

// ─────────────────────────────────────────────────────────────
// 카드 표현용 정치인 요약
// ─────────────────────────────────────────────────────────────
export interface PoliticianCardDTO {
  id: string;
  name: string;
  person_type: PersonType;
  party_name: string | null;
  affiliation: string | null;     // 영향력 인물의 채널/매체명
  position_label: string;          // "국회의원·3선" 등
  region: string | null;
  mention_count: number;
  mention_change: number;          // 변화율 (%)
  keywords: string[];
  themes: string[];
}

// ─────────────────────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────────────────────
export interface ThemeFlowDTO {
  id: string;
  name: string;
  mention_count: number;
  mention_change: number;
}

export interface HomeSummaryDTO {
  date: DateString;
  total_articles: number;
  total_change: number;
  active_themes: number;
  headline: string;                // 사실 기반 한 줄
}

export interface HomeFeed extends ResponseMeta {
  summary: HomeSummaryDTO;
  surge_politicians: PoliticianCardDTO[];     // 뉴스 언급량 급증
  top_mentioned: PoliticianCardDTO[];         // 오늘 많이 언급된 인물
  theme_surge: ThemeFlowDTO[];                // 급등 테마
  influence_flow: PoliticianCardDTO[];        // 영향력 인물 흐름
  watchlist: PoliticianCardDTO[];             // 관심 인물 (현재 고정)
}

// ─────────────────────────────────────────────────────────────
// POLITICIAN DETAIL
// ─────────────────────────────────────────────────────────────
export interface FlowPointDTO {
  date: DateString;
  value: number;
}

export interface RelatedArticleDTO {
  id: string;
  title: string;
  source: string;
  published_at: Iso;
  url: string;
  ai_summary_flag: boolean;
}

export interface IndicatorValueDTO {
  value: number;
  basis: string;
  window_days?: number;
  /** policy_keyword_index 전용 — 상위 정책 키워드 */
  top?: string[];
  /** issue_concentration 전용 — 상위 테마 share map */
  top_themes_share?: Record<string, number>;
  /** source_diversity 전용 — distinct source count */
  distinct_count?: number;
}

export interface PoliticianIndicatorsDTO {
  national_exposure: IndicatorValueDTO;
  regional_exposure: IndicatorValueDTO;
  policy_keyword_index: IndicatorValueDTO;
  issue_concentration: IndicatorValueDTO;
  source_diversity: IndicatorValueDTO;
}

export interface PoliticianDetail extends ResponseMeta {
  profile: {
    id: string;
    name: string;
    person_type: PersonType;
    party_name: string | null;
    affiliation: string | null;
    position_label: string;
    region: string | null;
  };
  metrics: {
    today_mention_count: number;
    mention_change: number;          // 전일 또는 7일 평균 대비
    flow_14d: FlowPointDTO[];
  };
  /** 6대 차트 지표 — 실 데이터 연결 후 채워짐. Fake에서는 0 + 라벨만. */
  indicators: PoliticianIndicatorsDTO;
  keywords: string[];
  themes: string[];
  related_articles: RelatedArticleDTO[];
}

// ─────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────
export interface SearchResult extends ResponseMeta {
  results: PoliticianCardDTO[];
  total: number;
}

export type SearchFilter = PersonType | 'all';

// ─────────────────────────────────────────────────────────────
// RANKING
// ─────────────────────────────────────────────────────────────
export interface RankingEntryDTO {
  rank: number;
  politician?: PoliticianCardDTO;
  theme?: ThemeFlowDTO;
  metric_value: number;
  metric_change: number | null;
}

export interface RankingSnapshot extends ResponseMeta {
  ranking_type: RankingType;
  scope: string;
  entries: RankingEntryDTO[];
}

// ─────────────────────────────────────────────────────────────
// ARTICLE MENTIONS (근거 기사 보기)
// ─────────────────────────────────────────────────────────────
export interface ArticleMentions extends ResponseMeta {
  politician_id: string;
  articles: RelatedArticleDTO[];
  total: number;
}

// ─────────────────────────────────────────────────────────────
// WIDGET 시스템 응답 타입
// ─────────────────────────────────────────────────────────────

/** Compare 위젯이 받는 1인 데이터 — 5개 비교 지표 + 변화율 + 7일 흐름 */
export interface ComparisonItem {
  id: string;
  name: string;
  person_type: PersonType;
  party_name: string | null;
  affiliation: string | null;
  position_label: string;
  region: string | null;
  /** 최근 변화율 (%) */
  mention_change: number;
  /** 최근 24h 기사량 */
  mention_count: number;
  /** 7일 미니 흐름 */
  flow_7d: FlowPointDTO[];
  /** 상위 키워드 */
  keywords: string[];
  /** 5개 비교 지표 — 실 데이터 연결 후 채워짐 */
  indicators_lite: {
    national_exposure: { value: number; basis: string };
    policy_keyword_index: { value: number; basis: string };
    issue_concentration: { value: number; basis: string };
    source_diversity: { value: number; basis: string };
  };
}

export interface PoliticianComparison extends ResponseMeta {
  items: ComparisonItem[];
  compare_mode: 'general' | 'theme' | 'region' | 'presidential';
  context_label?: string;        // 예: "AI/기술 정책 흐름 안에서", "서울 정치 안에서"
}

export interface ThemeDetail extends ResponseMeta {
  id: string;
  name: string;
  description: string | null;
  mention_count: number;
  mention_change: number;
  flow_14d: FlowPointDTO[];
  top_politicians: PoliticianCardDTO[];
}

export interface RegionFlow extends ResponseMeta {
  region_code: string;
  region_label: string;
  politicians: PoliticianCardDTO[];
  total_articles: number;
}

export interface KeywordSurgeItem {
  keyword: string;
  mention_count: number;
  mention_change: number;
  related_themes: string[];
}
export interface KeywordSurge extends ResponseMeta {
  items: KeywordSurgeItem[];
}

export interface MarketSnapshotItem {
  label: string;
  value: number;
  change: number | null;
  /** 1줄 사실 설명 (사실 기반) */
  note: string | null;
}
export interface MarketSnapshot extends ResponseMeta {
  market: 'central' | 'parties' | 'policy' | 'region';
  market_label: string;
  items: MarketSnapshotItem[];
  /** 시장 전체 요약 한 줄 */
  headline: string;
}

export interface RecentArticles extends ResponseMeta {
  articles: RelatedArticleDTO[];
  total: number;
}

// ─────────────────────────────────────────────────────────────
// Interest Target 응답
// ─────────────────────────────────────────────────────────────

export interface MyInterests extends ResponseMeta {
  targets: InterestTarget[];
}

export interface RecommendedInterests extends ResponseMeta {
  items: RecommendedTarget[];
}

/** InterestDetailScreen용 — target + 패널별 데이터 묶음 (C6에서 구체화) */
export interface InterestDetail extends ResponseMeta {
  target: InterestTarget;
  /** 각 패널이 알아서 가져가도록 raw하게 묶어두는 임시 컨테이너 */
  panels_data: Record<string, unknown>;
}

/** Add Interest 화면용 카테고리 */
export type InterestCategory =
  | '인물'
  | '선거구'
  | '지방선거'
  | '정책/주제'
  | '지역'
  | '선거'
  | '이슈';

export interface AvailableTarget {
  type: import('../../types/widget').InterestTargetType;
  target_ref: string;
  title: string;
  subtitle?: string;
  category: InterestCategory;
  preview?: import('../../types/widget').TargetPreview;
}

export interface AvailableTargets extends ResponseMeta {
  targets: AvailableTarget[];
}

// ─────────────────────────────────────────────────────────────
// DataProvider 인터페이스
//
// FakeDataProvider / SupabaseDataProvider 모두 이 인터페이스만 구현.
// 화면은 useDataProvider() 훅을 통해서만 접근.
// ─────────────────────────────────────────────────────────────
export interface DataProvider {
  /** 데이터 출처 표기 (앱 진입 시 한 번 호출) */
  getLastUpdateStatus(): Promise<LastUpdateStatus>;

  /** 홈 화면 한 번에 채우기 (legacy compat) */
  getHomeFeed(): Promise<HomeFeed>;

  /** 인물 상세 — null이면 미존재 */
  getPoliticianDetail(politicianId: string): Promise<PoliticianDetail | null>;

  /** 검색 — query empty + filter 'all' 이면 전체 */
  getSearchResults(query: string, filter: SearchFilter): Promise<SearchResult>;

  /** 랭킹 스냅샷 단건 */
  getRanking(rankingType: RankingType, scope?: string): Promise<RankingSnapshot>;

  /** 근거 기사 목록 (페이지네이션은 추후) */
  getArticleMentions(politicianId: string, limit?: number): Promise<ArticleMentions>;

  // ── Widget 전용 메서드 ──────────────────────────────

  /** 정치인 비교 (2~5인) — KPOL 핵심 UX */
  getPoliticianComparison(
    politicianIds: string[],
    options?: {
      compare_mode?: 'general' | 'theme' | 'region' | 'presidential';
      theme_id?: string;
      region_code?: string;
    },
  ): Promise<PoliticianComparison>;

  /** 단일 테마 상세 */
  getThemeDetail(themeId: string): Promise<ThemeDetail | null>;

  /** 지역 정치 흐름 */
  getRegionFlow(regionCode: string, regionLabel?: string): Promise<RegionFlow>;

  /** 급등 키워드 */
  getKeywordSurge(limit?: number): Promise<KeywordSurge>;

  /** 시장 스냅샷 (중앙/정당/정책/지역) */
  getMarketSnapshot(market: 'central' | 'parties' | 'policy' | 'region'): Promise<MarketSnapshot>;

  /** 최근 뉴스 스트림 (전역) */
  getRecentArticles(limit?: number, themeId?: string): Promise<RecentArticles>;

  // ── Interest Target ────────────────────────────────────────

  /** 사용자 핀 + 관리자 큐레이션 (홈 "내 관심") */
  getMyInterests(): Promise<MyInterests>;

  /** 자동 생성된 추천 대상 (홈 "추천 관심 대상") */
  getRecommendedInterests(limit?: number): Promise<RecommendedInterests>;

  /** 단일 관심 대상 + 패널 데이터 (InterestDetailScreen용 — C6에서 본 구현) */
  getInterestDetail(targetId: string): Promise<InterestDetail | null>;

  /** Add 화면용 카탈로그 — 사용자가 홈에 설치 가능한 모든 대상 */
  getAvailableTargets(): Promise<AvailableTargets>;
}
