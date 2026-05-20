/**
 * KPOL 프로그램 중심 데이터 모델 타입.
 *
 * 0014_media_programs.sql 의 스키마에 1:1 대응.
 * person_id 는 future persons 테이블 FK — 현재 nullable, name loose link.
 */

export type ProgramActiveStatus = "active" | "ended" | "on_hiatus";

export type ProgramCategory =
  | "morning_radio"
  | "news_show"
  | "panel_debate"
  | "commentary"
  | "interview"
  | "other"
  | (string & {}); // schema 는 text — 미래 추가 카테고리 허용

export type ProgramPersonLinkType =
  | "guest_appearance"
  | "mention"
  | "clip_subject"
  | "interview"
  | (string & {});

export interface MediaProgram {
  id: string;
  title: string;
  slug: string | null;

  broadcaster: string | null;
  channel_name: string | null;
  youtube_channel_id: string | null;
  external_url: string | null;
  thumbnail_url: string | null;

  category: ProgramCategory | null;
  description: string | null;
  upload_frequency: string | null;
  started_at: string | null;
  ended_at: string | null;
  active_status: ProgramActiveStatus;

  political_alignment: string | null;
  average_views: number | null;
  influence_score: number | null;

  raw_payload: unknown;

  created_at: string;
  updated_at: string;
}

export interface MediaProgramHost {
  id: string;
  program_id: string;
  person_name: string;
  person_id: string | null;
  role: string;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface MediaProgramPanelist {
  id: string;
  program_id: string;
  person_name: string;
  person_id: string | null;
  panel_role: string | null;
  cadence: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface MediaProgramPersonLink {
  id: string;
  program_id: string;
  person_name: string;
  person_id: string | null;
  link_type: ProgramPersonLinkType;
  appearance_date: string | null;
  context: string | null;
  source_url: string | null;
  source_video_id: string | null;
  raw_payload: unknown;
  created_at: string;
}

/**
 * YouTube 채널 누적 지표 — program.youtube_channel_id 가 있을 때만 채워짐.
 * 1차 랭킹 기준이 아닌 "보조 정보". 메인 랭킹은 최근 14일 영상 기반으로 이동 예정.
 */
export interface MediaProgramChannelStats {
  channel_id: string;
  channel_title: string | null;
  custom_url: string | null;
  thumbnail_url: string | null;
  subscriber_count: number | null;
  hidden_subscriber_count: boolean;
  view_count: number | null;
  video_count: number | null;
  published_at: string | null;
  country: string | null;
  official_url: string;
  channel_fetched_at: string;
}

/**
 * 향후 도입될 "최근 14일 영상" 기반 활동성 지표 — 현재 미수집.
 * UI 는 이 shape 를 미리 알고 placeholder 표시.
 */
export interface MediaProgramRecentActivity {
  window_days: number; // 보통 14
  window_start: string;
  window_end: string;
  upload_count: number | null;
  avg_view_count: number | null;
  max_view_count: number | null;
  total_like_count: number | null;
  total_comment_count: number | null;
  last_upload_at: string | null;
  daily_view_series: number[] | null; // sparkline 용
}

/**
 * "전날 조회수" 일일 랭킹 — media_program_daily_rankings 최신 행.
 *
 * previous_day_view_count = 채널 최근 14일 영상의 24h 누적 조회수 합.
 * rank_score = previous_day_view_count (단일 지표, 다른 지표 혼합 ✗).
 * rank_delta = yesterday_rank - today_rank (positive=up, negative=down, null=new).
 */
export interface MediaProgramDailyRanking {
  program_id: string;
  snapshot_date: string;
  previous_day_view_count: number | null;
  rank: number | null;
  rank_delta: number | null;
  recent_video_count: number;
  recent_window_days: number;
  formula_version: string;
}

/**
 * ProgramDetail 의 "최근 영상" 섹션 — youtube_video_daily_snapshots 최신 snapshot_date 의 channel 영상.
 */
export interface MediaProgramRecentVideo {
  video_id: string;
  title: string | null;
  published_at: string | null;
  cumulative_view_count: number | null;
  cumulative_like_count: number | null;
  cumulative_comment_count: number | null;
  yesterday_view_count: number | null;
  daily_view_delta: number | null; // today - yesterday
  snapshot_date: string;
}

/** Detail API 가 반환하는 조인 결과 */
export interface MediaProgramFull extends MediaProgram {
  hosts: MediaProgramHost[];
  panelists: MediaProgramPanelist[];
  person_links: MediaProgramPersonLink[];
  channel?: MediaProgramChannelStats | null;
  recent_activity?: MediaProgramRecentActivity | null;
  /** 최신 일일 랭킹 (전날 조회수 기반). 첫 snapshot 전엔 null. */
  daily_ranking?: MediaProgramDailyRanking | null;
  /** 최신 snapshot_date 기준 채널 최근 14일 영상 (조회수 desc). */
  recent_videos?: MediaProgramRecentVideo[] | null;
}

/** 인물 → 프로그램 역방향 조회 결과 (UI 의 person → programs 화면용) */
export interface PersonProgramRelation {
  program: Pick<
    MediaProgram,
    | "id"
    | "title"
    | "broadcaster"
    | "channel_name"
    | "thumbnail_url"
    | "active_status"
  >;
  relations: Array<
    | { kind: "host"; role: string }
    | { kind: "panelist"; panel_role: string | null; cadence: string | null }
    | {
        kind: "person_link";
        link_type: ProgramPersonLinkType;
        appearance_date: string | null;
      }
  >;
}

// ────────────────────────────────────────────────────────────────
// 입력 검증 (admin POST body)
// ────────────────────────────────────────────────────────────────

export interface CreateProgramInput {
  title: string;
  slug?: string;
  broadcaster?: string;
  channel_name?: string;
  youtube_channel_id?: string;
  external_url?: string;
  thumbnail_url?: string;
  category?: ProgramCategory;
  description?: string;
  upload_frequency?: string;
  started_at?: string;
  ended_at?: string;
  active_status?: ProgramActiveStatus;
  political_alignment?: string;
  average_views?: number;
  influence_score?: number;
}

export interface AddHostInput {
  person_name: string;
  person_id?: string;
  role?: string;
  active?: boolean;
  notes?: string;
}

export interface AddPanelistInput {
  person_name: string;
  person_id?: string;
  panel_role?: string;
  cadence?: string;
  active?: boolean;
  notes?: string;
}

export interface AddPersonLinkInput {
  person_name: string;
  person_id?: string;
  link_type: ProgramPersonLinkType;
  appearance_date?: string;
  context?: string;
  source_url?: string;
  source_video_id?: string;
}

export function validateCreateProgram(input: unknown):
  | { ok: true; value: CreateProgramInput }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "body 가 object 가 아닙니다." };
  }
  const o = input as Record<string, unknown>;
  if (typeof o.title !== "string" || o.title.trim().length === 0) {
    return { ok: false, error: "title 필수" };
  }
  const allowedStatus: ProgramActiveStatus[] = ["active", "ended", "on_hiatus"];
  if (
    o.active_status != null &&
    !allowedStatus.includes(o.active_status as ProgramActiveStatus)
  ) {
    return {
      ok: false,
      error: `active_status 는 ${allowedStatus.join("|")} 중 하나`,
    };
  }
  return { ok: true, value: o as unknown as CreateProgramInput };
}
