/**
 * KPOL 위젯 모델 — Interest Target + Panel Architecture.
 *
 * 상위 레이어: InterestTarget (사용자 관심 대상 — 사람·선거구·지역·선거·이슈 묶음)
 * 하위 레이어: Panel (12종 — 관심 대상 내부의 흐름 데이터 패널)
 *
 * 기존 WidgetType 기반 모델은 폐기됨. 위젯 = 관심 대상.
 */

import type { FlowPointDTO } from '../services/dataProvider/types';

// ─────────────────────────────────────────────────────────────
// InterestTarget — 상위 레이어
// ─────────────────────────────────────────────────────────────

export type InterestTargetType =
  | 'politician'        // 사람 (이재명, 한동훈)
  | 'district'          // 일반 선거구 (종로, 분당갑)
  | 'regional_office'   // 광역단체장 선거구 (서울시장, 경기지사)
  | 'election'          // 선거 회차 전체 (9회 지방선거)
  | 'issue_cluster';    // 동적/큐레이션 묶음 (재보궐 14곳)

export type Priority = 'pinned' | 'high' | 'normal' | 'low';

export type GeneratedReason =
  | 'election_cycle'    // 선거 일정 근접
  | 'mention_surge'     // 기사 급증
  | 'regional_focus'    // 지역 뉴스 집중
  | 'editorial_focus'   // 외부 사설 집중
  | 'keyword_surge'     // 키워드 급등
  | 'manager_pick';     // 관리자 수동

export interface InterestTarget {
  id: string;                       // interest_targets.id
  type: InterestTargetType;
  /** 외부 키 — politicians.id / electoral_districts.id / elections.id / cluster slug */
  target_ref: string;
  title: string;
  subtitle?: string;

  // 운영 메타
  auto_generated: boolean;
  pinned: boolean;
  priority: Priority;
  priority_score: number;
  active: boolean;
  generated_reason?: GeneratedReason;
  reason_metadata?: Record<string, unknown>;
  expires_at?: string;
  updated_at: string;

  // 패널 구성
  panels: PanelConfig[];

  /** 홈 카드 미리보기용 사전 계산 데이터 */
  preview?: TargetPreview;
}

/**
 * 홈 카드 표시용 미리 계산된 요약.
 * Provider가 채워서 보낸다. 카드는 이 객체만 보고 렌더.
 */
export interface TargetPreview {
  /** 최근 24h 기사량 또는 총량 */
  mention_count?: number;
  /** 변화율 (%) */
  mention_change?: number;
  /** 미니 스파크라인용 7일 흐름 */
  flow_7d?: FlowPointDTO[];
  /** 구성원 수 — district(후보), election(선거구), cluster(멤버), regional_office(후보) */
  member_count?: number;
  /** 컨텍스트 메타 — "D-15", "24h", "자동 집계" 등 */
  context_meta?: string;
}

// ─────────────────────────────────────────────────────────────
// Panel — 하위 레이어 (관심 대상 내부 흐름 패널)
// ─────────────────────────────────────────────────────────────

export type PanelType =
  // 사용자 명시 8종
  | 'news_flow'
  | 'keyword_flow'
  | 'compare_panel'
  | 'chart_panel'
  | 'editorial_panel'
  | 'official_sources_panel'
  | 'article_panel'
  | 'trend_panel'
  // 확장 4종
  | 'indicators_panel'
  | 'related_targets_panel'
  | 'policy_panel'
  | 'media_panel';

export interface PanelConfig {
  type: PanelType;
  visible: boolean;
  order: number;
  params?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// 추천 관심 대상 (HomeScreen "추천" 영역)
// ─────────────────────────────────────────────────────────────

export interface RecommendedTarget {
  id: string;                       // interest_targets.id
  type: InterestTargetType;
  target_ref: string;
  title: string;
  subtitle?: string;
  generated_reason: GeneratedReason;
  reason_metadata?: Record<string, unknown>;
  priority_score: number;
  preview?: TargetPreview;
}

// ─────────────────────────────────────────────────────────────
// 컴포넌트 Props (Registry 진입점)
// ─────────────────────────────────────────────────────────────

export interface TargetCardProps {
  target: InterestTarget;
  onOpen?: (target: InterestTarget) => void;
}

export interface PanelProps {
  target: InterestTarget;
  params?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// generated_reason → 사람 친화 라벨
// ─────────────────────────────────────────────────────────────

export const reasonLabel: Record<GeneratedReason, string> = {
  election_cycle: '선거 임박',
  mention_surge: '기사 급증',
  regional_focus: '지역 집중',
  editorial_focus: '사설 집중',
  keyword_surge: '키워드 급등',
  manager_pick: '큐레이션',
};
