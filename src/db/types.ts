/**
 * KPOL DB Row 타입.
 * supabase/migrations/0001_initial.sql 과 1:1 매핑.
 *
 * SupabaseDataProvider 도입 후에는 이 타입을 그대로 호출 결과 타입으로 사용.
 * FakeDataProvider 단계에서도 같은 모양을 유지해 추후 무손실 교체를 보장.
 */

export type Iso = string; // ISO 8601 string
export type DateString = string; // YYYY-MM-DD

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

export type PersonType =
  | 'elected_official'
  | 'party_leader'
  | 'local_government'
  | 'political_commentator'
  | 'political_youtuber'
  | 'political_platform_operator'
  | 'political_influencer';

export type PartyStatus = 'active' | 'merged' | 'dissolved';

export type SourceProvider = 'bigkinds' | 'naver' | 'manual';

export type SourceOrigin = 'nec' | 'assembly' | 'manual' | 'mixed';

export type MatchedBy = 'ner' | 'alias' | 'manual';

export type JobStatus = 'running' | 'success' | 'failed' | 'partial';

export type RankingType =
  | 'today_surge'        // 오늘의 관심도 상승
  | 'weekly_mention'     // 주간 언급량 상위
  | 'top_mentioned'      // 오늘 많이 언급된 인물
  | 'theme_surge'        // 급등 테마
  | 'influence_flow';    // 영향력 인물 흐름

export type DataMode = 'demo' | 'live';

// ─────────────────────────────────────────────────────────────
// Tables
// ─────────────────────────────────────────────────────────────

export interface PartyRow {
  id: string;
  name: string;
  short_name: string | null;
  founded_date: DateString | null;
  dissolved_date: DateString | null;
  predecessor_id: string | null;
  status: PartyStatus;
  created_at: Iso;
  updated_at: Iso;
}

export interface PoliticianRow {
  id: string;
  name: string;
  name_normalized: string;
  aliases: string[];
  person_type: PersonType;
  birth_year: number | null;
  gender: 'male' | 'female' | 'other' | null;
  profile_image_url: string | null;
  career_summary: string | null;
  education: string | null;
  external_nec_id: string | null;
  external_assembly_id: string | null;
  is_active: boolean;
  source_origin: SourceOrigin;
  created_at: Iso;
  updated_at: Iso;
}

export interface PoliticianPositionRow {
  id: string;
  politician_id: string;
  party_id: string | null;
  position_label: string;
  national_assembly_term: number | null;
  district: string | null;
  district_code: string | null;
  region_code: string | null;
  election_count: number | null;
  start_date: DateString;
  end_date: DateString | null;
  source_origin: SourceOrigin | null;
  notes: string | null;
  created_at: Iso;
}

export interface PoliticianAffiliationRow {
  id: string;
  politician_id: string;
  channel_name: string | null;
  channel_url: string | null;
  outlet_name: string | null;
  outlet_type: string | null;
  start_date: DateString | null;
  end_date: DateString | null;
  verified_at: Iso | null;
  created_at: Iso;
}

export interface ThemeRow {
  id: string;             // 'realestate', 'ai_tech' 등 slug
  name_ko: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: Iso;
}

export interface NewsArticleRow {
  id: string;
  external_id: string | null;
  source_provider: SourceProvider;
  title: string;
  source: string;
  published_at: Iso;
  url: string;
  url_normalized: string;
  summary: string | null;
  ai_summary_flag: boolean;
  category: string | null;
  collected_at: Iso;
}

export interface ArticleMentionRow {
  article_id: string;
  politician_id: string;
  confidence: number;
  matched_by: MatchedBy;
  reviewed_at: Iso | null;
  reviewed_by: string | null;
  created_at: Iso;
}

export interface ArticleThemeRow {
  article_id: string;
  theme_id: string;
  confidence: number | null;
}

export interface DailyMetricsRow {
  politician_id: string;
  date: DateString;
  mention_count: number;
  source_count: number;
  theme_distribution: Record<string, number>;
  computed_at: Iso;
}

export interface DailyThemeMetricsRow {
  theme_id: string;
  date: DateString;
  mention_count: number;
  computed_at: Iso;
}

export interface RankingRow {
  id: string;
  ranking_type: RankingType;
  scope: string;
  computed_at: Iso;
  basis_label: string;
  source_window_start: Iso | null;
  source_window_end: Iso | null;
}

export interface RankingEntryRow {
  ranking_id: string;
  rank: number;
  politician_id: string | null;
  theme_id: string | null;
  metric_value: number;
  metric_change: number | null;
}

export interface UpdateLogRow {
  id: string;
  job_id: string;
  started_at: Iso;
  finished_at: Iso | null;
  status: JobStatus;
  articles_processed: number;
  mentions_added: number;
  errors_count: number;
  error_summary: string | null;
  triggered_by: string;
}

export interface SystemSettingRow {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: Iso;
  updated_by: string | null;
}

// ─────────────────────────────────────────────────────────────
// View — v_politician_change (변화율 계산)
// ─────────────────────────────────────────────────────────────
export interface PoliticianChangeViewRow {
  politician_id: string;
  date: DateString;
  mention_count: number;
  prev_day_count: number | null;
  week_avg_count: number | null;
}
