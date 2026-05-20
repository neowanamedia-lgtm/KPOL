-- 0015_daily_view_rankings.sql
-- KPOL 미디어 프로그램 랭킹 — "전날 조회수" 단일 지표.
--
-- 정책:
--   - rank_score = previous_day_view_count  (다른 지표 혼합 금지)
--   - 대상 영상: 채널의 최근 14일 이내 업로드된 YouTube 영상
--   - previous_day_view_count = sum( today_snapshot - yesterday_snapshot ) over those videos
--   - rank_delta = yesterday_rank - today_rank  (양수=상승, 음수=하락, null=신규)
--
-- 한계:
--   - 같은 youtube_channel_id 를 공유하는 여러 프로그램은 동일 score 가짐.
--     향후 program.youtube_title_filter (regex) 도입 시 분리.

------------------------------------------------------------------
-- 1) youtube_video_daily_snapshots — 영상 단위 일일 cumulative 지표
------------------------------------------------------------------
create table if not exists public.youtube_video_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  video_id text not null,                    -- YouTube video ID
  channel_id text not null,                  -- 채널 ID (program.youtube_channel_id 와 매칭)
  snapshot_date date not null,               -- 캡처 날짜 (KST 기준)
  cumulative_view_count bigint,              -- snapshot 시점 누적 조회수
  cumulative_like_count bigint,
  cumulative_comment_count bigint,
  published_at timestamptz,                  -- 영상 업로드 시각
  title text,                                -- 영상 제목 (denormalized, UI 표시용)
  raw_payload jsonb,                         -- videos.list items[0] 원본
  fetched_at timestamptz not null default now(),
  constraint youtube_video_daily_snapshots_uq unique (video_id, snapshot_date)
);
create index if not exists yvds_channel_date_idx       on public.youtube_video_daily_snapshots (channel_id, snapshot_date desc);
create index if not exists yvds_video_date_idx         on public.youtube_video_daily_snapshots (video_id, snapshot_date desc);
create index if not exists yvds_snapshot_date_idx      on public.youtube_video_daily_snapshots (snapshot_date desc);
create index if not exists yvds_published_at_idx       on public.youtube_video_daily_snapshots (published_at desc);

comment on table public.youtube_video_daily_snapshots is
  'YouTube 영상 일일 cumulative 조회수 snapshot. 24h delta 계산 재료.';

------------------------------------------------------------------
-- 2) media_program_daily_rankings — 프로그램 일일 랭킹
------------------------------------------------------------------
create table if not exists public.media_program_daily_rankings (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.media_programs(id) on delete cascade,
  snapshot_date date not null,               -- 랭킹 산정 날짜 (KST 기준)

  -- 핵심 지표 (단일 — 다른 지표 혼합 ✗)
  previous_day_view_count bigint,            -- 24h 동안 발생한 조회수 합 (sum of deltas over 14d videos)

  -- 순위
  rank int,                                  -- 1..N (NULLS LAST → 데이터 없는 프로그램은 마지막)
  rank_delta int,                            -- yesterday_rank - today_rank. null=신규/비교 불가

  -- 메타
  recent_video_count int,                    -- 14일 이내 영상 수 (참고)
  recent_window_days int not null default 14,
  formula_version text not null default 'media_programs_v1_prev_day_views',

  created_at timestamptz not null default now(),
  constraint mpdr_unique unique (program_id, snapshot_date)
);
create index if not exists mpdr_program_date_idx   on public.media_program_daily_rankings (program_id, snapshot_date desc);
create index if not exists mpdr_date_rank_idx      on public.media_program_daily_rankings (snapshot_date desc, rank);

comment on table public.media_program_daily_rankings is
  'KPOL 미디어 프로그램 일일 랭킹. 전날 24h 조회수 단일 지표.';
comment on column public.media_program_daily_rankings.previous_day_view_count is
  '대상 영상: 최근 14일 업로드. 값 = sum(today_snapshot - yesterday_snapshot).';

------------------------------------------------------------------
-- 3) RLS — public read, 쓰기는 service_role
------------------------------------------------------------------
alter table public.youtube_video_daily_snapshots enable row level security;
alter table public.media_program_daily_rankings   enable row level security;

drop policy if exists yvds_public_read on public.youtube_video_daily_snapshots;
create policy yvds_public_read on public.youtube_video_daily_snapshots
  for select to anon, authenticated using (true);

drop policy if exists mpdr_public_read on public.media_program_daily_rankings;
create policy mpdr_public_read on public.media_program_daily_rankings
  for select to anon, authenticated using (true);
