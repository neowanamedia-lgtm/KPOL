-- KPOL 초기 스키마
-- 작성일: 2026-05-19
-- 적용: Supabase 프로젝트 생성 후 `supabase db push` 또는 SQL Editor 실행
--
-- 핵심 테이블: politicians, parties, news_articles, article_mentions,
--             themes, daily_metrics, rankings, update_logs (사용자 지정 8종)
-- 보조 테이블: politician_positions, politician_affiliations, article_themes,
--             daily_theme_metrics, ranking_entries
--
-- 모든 시각은 timestamptz. 모든 ID는 uuid 또는 도메인 자연키.
-- KPOL 데이터 원칙: 모든 변화 수치는 article_mentions로 역추적 가능해야 함.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────
-- 1. 정당 (parties)
-- ─────────────────────────────────────────────────────────────────────
create table parties (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  short_name      text,
  founded_date    date,
  dissolved_date  date,
  predecessor_id  uuid references parties(id),
  status          text not null check (status in ('active', 'merged', 'dissolved')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (name)
);

create index parties_status_idx on parties(status);

-- ─────────────────────────────────────────────────────────────────────
-- 2. 인물 (politicians) — 사용자 지정 ①
--    사람 자체를 표현. 직책·정당은 politician_positions로 시간 분리.
-- ─────────────────────────────────────────────────────────────────────
create table politicians (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  name_normalized       text not null,           -- 검색용 (공백/특수문자 제거)
  aliases               jsonb not null default '[]'::jsonb,  -- ["한자명","영문","별칭"]
  person_type           text not null check (person_type in (
    'elected_official', 'party_leader', 'local_government',
    'political_commentator', 'political_youtuber',
    'political_platform_operator', 'political_influencer'
  )),
  birth_year            int,
  gender                text check (gender in ('male', 'female', 'other') or gender is null),
  profile_image_url     text,
  career_summary        text,
  education             text,
  external_nec_id       text,                    -- 선관위 후보자 ID
  external_assembly_id  text,                    -- 국회 의원 ID
  is_active             boolean not null default true,
  source_origin         text not null check (source_origin in ('nec', 'assembly', 'manual', 'mixed')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index politicians_name_norm_idx on politicians(name_normalized);
create index politicians_type_idx on politicians(person_type);
create index politicians_active_idx on politicians(is_active);
create index politicians_aliases_idx on politicians using gin (aliases);

-- ─────────────────────────────────────────────────────────────────────
-- 3. 직책 이력 (politician_positions) — 보조
--    "이재명: 더불어민주당 → ..." 같은 시간 기반 변화 추적용.
--    현재 직책은 end_date IS NULL인 row.
-- ─────────────────────────────────────────────────────────────────────
create table politician_positions (
  id                       uuid primary key default gen_random_uuid(),
  politician_id            uuid not null references politicians(id) on delete cascade,
  party_id                 uuid references parties(id),
  position_label           text not null,        -- '국회의원·3선', '서울특별시장', '정치 평론가' 등
  national_assembly_term   int,
  district                 text,                 -- '서울 종로'
  district_code            text,
  region_code              text,
  election_count           int,
  start_date               date not null,
  end_date                 date,
  source_origin            text,
  notes                    text,
  created_at               timestamptz not null default now()
);

create index pp_politician_idx on politician_positions(politician_id);
create index pp_current_idx on politician_positions(politician_id) where end_date is null;
create index pp_party_idx on politician_positions(party_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. 영향력 인물 소속 (politician_affiliations) — 보조
--    채널/매체/플랫폼 등 비정당 소속 정보.
-- ─────────────────────────────────────────────────────────────────────
create table politician_affiliations (
  id              uuid primary key default gen_random_uuid(),
  politician_id   uuid not null references politicians(id) on delete cascade,
  channel_name    text,
  channel_url     text,
  outlet_name     text,
  outlet_type     text,                          -- 'youtube', 'column', 'broadcast', 'sns', 'platform'
  start_date      date,
  end_date        date,
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index pa_politician_idx on politician_affiliations(politician_id);

-- ─────────────────────────────────────────────────────────────────────
-- 5. 테마 (themes) — 사용자 지정 ⑤
-- ─────────────────────────────────────────────────────────────────────
create table themes (
  id              text primary key,              -- 'realestate', 'ai_tech' 같은 slug
  name_ko         text not null,
  description     text,
  display_order   int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- 6. 뉴스 기사 (news_articles) — 사용자 지정 ③
-- ─────────────────────────────────────────────────────────────────────
create table news_articles (
  id                  uuid primary key default gen_random_uuid(),
  external_id         text,                      -- 빅카인즈 등의 외부 ID
  source_provider     text not null check (source_provider in ('bigkinds', 'naver', 'manual')),
  title               text not null,
  source              text not null,             -- 언론사명
  published_at        timestamptz not null,
  url                 text not null,
  url_normalized      text not null,             -- dedupe 키
  summary             text,
  ai_summary_flag     boolean not null default false,  -- AI 요약 사용 시 UI에 표시
  category            text,
  collected_at        timestamptz not null default now(),
  unique (url_normalized)
);

create index na_published_idx on news_articles(published_at desc);
create index na_external_idx on news_articles(source_provider, external_id);

-- ─────────────────────────────────────────────────────────────────────
-- 7. 기사-정치인 매핑 (article_mentions) — 사용자 지정 ④
--    근거 추적의 핵심. daily_metrics는 이 테이블에서 도출됨.
-- ─────────────────────────────────────────────────────────────────────
create table article_mentions (
  article_id      uuid not null references news_articles(id) on delete cascade,
  politician_id   uuid not null references politicians(id) on delete cascade,
  confidence      numeric(4,3) not null check (confidence between 0 and 1),
  matched_by      text not null check (matched_by in ('ner', 'alias', 'manual')),
  reviewed_at     timestamptz,
  reviewed_by     text,
  created_at      timestamptz not null default now(),
  primary key (article_id, politician_id)
);

create index am_politician_idx on article_mentions(politician_id);
create index am_unreviewed_idx on article_mentions(politician_id)
  where confidence < 0.85 and reviewed_at is null;

-- ─────────────────────────────────────────────────────────────────────
-- 8. 기사-테마 매핑 (article_themes) — 보조
-- ─────────────────────────────────────────────────────────────────────
create table article_themes (
  article_id      uuid not null references news_articles(id) on delete cascade,
  theme_id        text not null references themes(id) on delete cascade,
  confidence      numeric(4,3),
  primary key (article_id, theme_id)
);

create index at_theme_idx on article_themes(theme_id);

-- ─────────────────────────────────────────────────────────────────────
-- 9. 일별 지표 (daily_metrics) — 사용자 지정 ⑥
--    daily_mention_metrics의 약식 이름. 정치인 × 날짜 집계.
-- ─────────────────────────────────────────────────────────────────────
create table daily_metrics (
  politician_id        uuid not null references politicians(id) on delete cascade,
  date                 date not null,
  mention_count        int not null default 0,
  source_count         int not null default 0,    -- 매체 다양성 지표
  theme_distribution   jsonb not null default '{}'::jsonb,
  computed_at          timestamptz not null default now(),
  primary key (politician_id, date)
);

create index dm_date_idx on daily_metrics(date desc);

-- 변화율 계산 view
create view v_politician_change as
select
  politician_id,
  date,
  mention_count,
  lag(mention_count, 1) over (partition by politician_id order by date) as prev_day_count,
  avg(mention_count) over (
    partition by politician_id
    order by date
    rows between 7 preceding and 1 preceding
  )::numeric(10,2) as week_avg_count
from daily_metrics;

-- ─────────────────────────────────────────────────────────────────────
-- 10. 테마 일별 지표 (daily_theme_metrics) — 보조
-- ─────────────────────────────────────────────────────────────────────
create table daily_theme_metrics (
  theme_id        text not null references themes(id) on delete cascade,
  date            date not null,
  mention_count   int not null default 0,
  computed_at     timestamptz not null default now(),
  primary key (theme_id, date)
);

-- ─────────────────────────────────────────────────────────────────────
-- 11. 랭킹 스냅샷 (rankings) — 사용자 지정 ⑦
--     "다축 랭킹" 원칙 — 단일 인기 순위 금지.
--     매 배치마다 새 row를 만들어 시계열 보존.
-- ─────────────────────────────────────────────────────────────────────
create table rankings (
  id                     uuid primary key default gen_random_uuid(),
  ranking_type           text not null,
  -- 'today_surge'        : 오늘의 관심도 상승
  -- 'weekly_mention'     : 주간 언급량 상위
  -- 'top_mentioned'      : 오늘 많이 언급된 인물
  -- 'theme_surge'        : 급등 테마
  -- 'influence_flow'     : 영향력 인물 흐름
  scope                  text not null default 'all',
  -- 'all' | 'elected' | 'influence' | 'theme:<theme_id>'
  computed_at            timestamptz not null default now(),
  basis_label            text not null,           -- UI에 표시할 산정 기준 문구
  source_window_start    timestamptz,
  source_window_end      timestamptz
);

create index r_type_time_idx on rankings(ranking_type, computed_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- 12. 랭킹 항목 (ranking_entries) — 보조
-- ─────────────────────────────────────────────────────────────────────
create table ranking_entries (
  ranking_id      uuid not null references rankings(id) on delete cascade,
  rank            int not null,
  politician_id   uuid references politicians(id) on delete cascade,
  theme_id        text references themes(id) on delete cascade,
  metric_value    numeric not null,
  metric_change   numeric,
  primary key (ranking_id, rank),
  check (politician_id is not null or theme_id is not null)
);

create index re_pol_idx on ranking_entries(politician_id);
create index re_theme_idx on ranking_entries(theme_id);

-- ─────────────────────────────────────────────────────────────────────
-- 13. 업데이트 로그 (update_logs) — 사용자 지정 ⑧
--     앱의 "마지막 업데이트" 표시 출처 + 감사 추적.
-- ─────────────────────────────────────────────────────────────────────
create table update_logs (
  id                   uuid primary key default gen_random_uuid(),
  job_id               text not null,
  -- 'J1' | 'J2' | 'J3' | 'J4' | 'manual:<descriptor>'
  started_at           timestamptz not null default now(),
  finished_at          timestamptz,
  status               text not null check (status in ('running', 'success', 'failed', 'partial')),
  articles_processed   int not null default 0,
  mentions_added       int not null default 0,
  errors_count         int not null default 0,
  error_summary        text,
  triggered_by         text not null default 'cron'   -- 'cron' | 'manual:<user>'
);

create index ul_job_time_idx on update_logs(job_id, finished_at desc);
create index ul_success_idx on update_logs(job_id, finished_at desc) where status = 'success';

-- ─────────────────────────────────────────────────────────────────────
-- 14. 시스템 설정 (system_settings) — 운영 토글용
-- ─────────────────────────────────────────────────────────────────────
create table system_settings (
  key             text primary key,
  value           jsonb not null,
  description     text,
  updated_at      timestamptz not null default now(),
  updated_by      text
);

-- 기본 설정 시드
insert into system_settings (key, value, description) values
  ('election_period_active', 'false'::jsonb, '선거 기간 특별 정책 활성화 여부'),
  ('demo_mode', 'true'::jsonb, 'true이면 앱 UI에 DEMO 라벨 표시. 실 데이터 적재 시작 시 false로 변경.');

-- ─────────────────────────────────────────────────────────────────────
-- updated_at 자동 갱신 트리거
-- ─────────────────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_parties_updated      before update on parties      for each row execute function set_updated_at();
create trigger trg_politicians_updated  before update on politicians  for each row execute function set_updated_at();
create trigger trg_settings_updated     before update on system_settings for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- RLS — 앱(anon)에는 read-only. 워커는 service_role 사용.
-- 실 적용은 Supabase 프로젝트 생성 후 진행.
-- ─────────────────────────────────────────────────────────────────────
-- alter table politicians enable row level security;
-- alter table parties enable row level security;
-- alter table news_articles enable row level security;
-- ... (RLS 정책은 0002_rls.sql에서 분리 정의)

comment on table politicians is 'KPOL 인물 마스터. personType으로 7종 구분.';
comment on table news_articles is 'KPOL 뉴스 원천. url_normalized로 dedupe.';
comment on table article_mentions is '기사-인물 매핑. 모든 daily_metrics의 근거 추적 시작점.';
comment on table daily_metrics is '정치인 일별 언급량 집계. v_politician_change에서 변화율 계산.';
comment on table rankings is '다축 랭킹 스냅샷. 매 배치마다 새 row.';
comment on table update_logs is '배치 잡 감사 추적. 앱 "마지막 업데이트" 표시 출처.';
