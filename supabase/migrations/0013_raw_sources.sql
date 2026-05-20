-- 0013_raw_sources.sql
-- KPOL 공식 데이터 소스 raw 저장소.
--
-- 정책:
--   - 모든 raw 테이블은 출처(source) + raw_payload(jsonb)를 남겨 역추적 가능
--   - ranking 테이블은 산정 엔진이 raw로부터 계산한 "결과 출력" 테이블
--   - AI 임의 생성 데이터는 들어가지 않음
--
-- RLS:
--   - 1차: anon select 허용 (검증·/data-test 용)
--   - 쓰기: anon insert 허용 (1차 단순 운영, 차후 service_role 전용으로 강화)

------------------------------------------------------------------
-- 1) election_candidates_raw — 선관위/공공데이터포털 후보자 원본
------------------------------------------------------------------
create table if not exists public.election_candidates_raw (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- 'NEC' | 'PUBLICDATA' | ...
  election_id text,                      -- 선거 ID
  election_type_code text,               -- 선거 종류 코드
  candidate_id text,                     -- 후보자 ID
  candidate_name text,                   -- 후보자명
  party_name text,                       -- 정당명
  district_name text,                    -- 선거구명
  city_name text,                        -- 시도명
  career text,                           -- 경력 (긴 텍스트)
  education text,                        -- 학력
  registration_status text,              -- 등록 상태
  raw_payload jsonb,                     -- 원본 응답 전체
  fetched_at timestamptz not null default now()
);
create index if not exists ecr_source_idx on public.election_candidates_raw (source);
create index if not exists ecr_election_id_idx on public.election_candidates_raw (election_id);
create index if not exists ecr_candidate_id_idx on public.election_candidates_raw (candidate_id);
create index if not exists ecr_candidate_name_idx on public.election_candidates_raw (candidate_name);
create index if not exists ecr_fetched_at_idx on public.election_candidates_raw (fetched_at desc);

------------------------------------------------------------------
-- 2) election_candidate_sources — 후보자별 출처 매핑/추적
------------------------------------------------------------------
create table if not exists public.election_candidate_sources (
  id uuid primary key default gen_random_uuid(),
  candidate_id text,                     -- election_candidates_raw.candidate_id 참조 (느슨)
  candidate_name text,
  source text not null,                  -- 'NEC' | 'PUBLICDATA' | 'PARTY_OFFICIAL' 등
  source_url text,
  source_label text,                     -- 사람이 읽는 라벨 ("선관위 등록정보" 등)
  raw_payload jsonb,
  fetched_at timestamptz not null default now()
);
create index if not exists ecs_candidate_id_idx on public.election_candidate_sources (candidate_id);
create index if not exists ecs_source_idx on public.election_candidate_sources (source);

------------------------------------------------------------------
-- 3) media_sources_raw — 미디어/유튜브/언론사 원본
------------------------------------------------------------------
create table if not exists public.media_sources_raw (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- 'MANUAL' | 'YOUTUBE_API' | 'KPF' | ...
  media_name text not null,
  media_type text,                       -- youtube_channel | youtuber | news_media | podcast | online_media | other
  official_url text,
  youtube_channel_url text,
  raw_payload jsonb,
  fetched_at timestamptz not null default now()
);
create index if not exists msr_media_type_idx on public.media_sources_raw (media_type);
create index if not exists msr_media_name_idx on public.media_sources_raw (media_name);

------------------------------------------------------------------
-- 4) news_mentions_raw — 빅카인즈/뉴스 API 언급량 원본
------------------------------------------------------------------
create table if not exists public.news_mentions_raw (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- 'BIGKINDS' | 'NAVER_NEWS' 등
  target_type text not null,             -- 'person' | 'media' | 'party' | 'keyword'
  target_name text not null,
  keyword text,
  article_count integer,
  period_start date,
  period_end date,
  raw_payload jsonb,
  fetched_at timestamptz not null default now()
);
create index if not exists nmr_target_idx on public.news_mentions_raw (target_type, target_name);
create index if not exists nmr_period_idx on public.news_mentions_raw (period_start, period_end);
create index if not exists nmr_fetched_at_idx on public.news_mentions_raw (fetched_at desc);

------------------------------------------------------------------
-- 5) ranking_calculation_logs — 산정 엔진의 점수 계산 추적
------------------------------------------------------------------
create table if not exists public.ranking_calculation_logs (
  id uuid primary key default gen_random_uuid(),
  ranking_table text not null,           -- 'people_rankings' | 'media_rankings' | ...
  target_name text not null,
  score numeric,
  rank integer,
  formula_version text,                  -- 산정 공식 버전 식별자
  evidence jsonb,                        -- 입력 데이터 / 가중치 / 출처 ID 목록
  calculated_at timestamptz not null default now()
);
create index if not exists rcl_table_target_idx on public.ranking_calculation_logs (ranking_table, target_name);
create index if not exists rcl_calculated_at_idx on public.ranking_calculation_logs (calculated_at desc);

------------------------------------------------------------------
-- RLS
------------------------------------------------------------------
alter table public.election_candidates_raw enable row level security;
alter table public.election_candidate_sources enable row level security;
alter table public.media_sources_raw enable row level security;
alter table public.news_mentions_raw enable row level security;
alter table public.ranking_calculation_logs enable row level security;

-- anon select (검증/관측용). 운영 강화 시 admin 전용으로 좁힐 것.
drop policy if exists ecr_anon_select on public.election_candidates_raw;
create policy ecr_anon_select on public.election_candidates_raw
  for select to anon using (true);

drop policy if exists ecs_anon_select on public.election_candidate_sources;
create policy ecs_anon_select on public.election_candidate_sources
  for select to anon using (true);

drop policy if exists msr_anon_select on public.media_sources_raw;
create policy msr_anon_select on public.media_sources_raw
  for select to anon using (true);

drop policy if exists nmr_anon_select on public.news_mentions_raw;
create policy nmr_anon_select on public.news_mentions_raw
  for select to anon using (true);

drop policy if exists rcl_anon_select on public.ranking_calculation_logs;
create policy rcl_anon_select on public.ranking_calculation_logs
  for select to anon using (true);

-- 1차: anon insert 허용 (server route가 anon key로 insert). 차후 service_role 전용으로 교체.
drop policy if exists ecr_anon_insert on public.election_candidates_raw;
create policy ecr_anon_insert on public.election_candidates_raw
  for insert to anon with check (true);

drop policy if exists ecs_anon_insert on public.election_candidate_sources;
create policy ecs_anon_insert on public.election_candidate_sources
  for insert to anon with check (true);

drop policy if exists msr_anon_insert on public.media_sources_raw;
create policy msr_anon_insert on public.media_sources_raw
  for insert to anon with check (true);

drop policy if exists nmr_anon_insert on public.news_mentions_raw;
create policy nmr_anon_insert on public.news_mentions_raw
  for insert to anon with check (true);

drop policy if exists rcl_anon_insert on public.ranking_calculation_logs;
create policy rcl_anon_insert on public.ranking_calculation_logs
  for insert to anon with check (true);

comment on table public.election_candidates_raw is '선관위/공공데이터 후보자 정보 원본 (역추적용)';
comment on table public.election_candidate_sources is '후보자별 출처 URL/라벨 매핑';
comment on table public.media_sources_raw is '미디어 채널 원본 (수동 등록 + YouTube/KPF API)';
comment on table public.news_mentions_raw is '뉴스 언급량/기사 수 원본 (빅카인즈/네이버)';
comment on table public.ranking_calculation_logs is 'KPOL 랭킹 산정 엔진의 점수 계산 로그';
