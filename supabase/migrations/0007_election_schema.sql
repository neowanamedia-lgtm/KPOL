-- KPOL 6·3 선거 흐름 터미널 — 선거 데이터 모델
-- 작성: 2026-05-19 (D-15)
-- 선행: 0001 ~ 0006 적용 완료 후 실행
-- 적용 시점: Supabase 발급 + 0001~0006 적용 후 ⚠️ 현재 단계는 초안만, 실행 보류
--
-- 추가 테이블: elections, electoral_districts, candidates, district_watch, daily_district_metrics
-- ALTER: news_articles.article_type, article_mentions.district_id, politicians.current_candidacy_district_id

-- ─────────────────────────────────────────────────────────────────────
-- 1. elections — 선거 회차 마스터
-- ─────────────────────────────────────────────────────────────────────
create table if not exists elections (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  election_type   text not null check (election_type in (
    'general',           -- 국회의원 총선
    'local',             -- 전국동시지방선거
    'by_election',       -- 재·보궐
    'presidential',      -- 대통령
    'educational'        -- 교육감
  )),
  date            date not null,
  status          text not null check (status in ('upcoming', 'ongoing', 'completed')),
  nec_election_id text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index elections_date_idx on elections(date desc);
create index elections_status_idx on elections(status);

-- ─────────────────────────────────────────────────────────────────────
-- 2. electoral_districts — 선거구
-- ─────────────────────────────────────────────────────────────────────
create table if not exists electoral_districts (
  id                uuid primary key default gen_random_uuid(),
  election_id       uuid not null references elections(id) on delete cascade,
  name              text not null,
  name_short        text,
  region_code       text,
  parent_region     text,
  district_type     text not null check (district_type in (
    'assembly_member',                -- 국회의원
    'metro_governor',                 -- 광역시장
    'metro_province_governor',        -- 도지사
    'metro_council_seat',             -- 광역의원 (지역구)
    'metro_council_proportional',     -- 광역의원 (비례)
    'basic_mayor',                    -- 기초단체장
    'basic_council_seat',             -- 기초의원 (지역구)
    'basic_council_proportional',     -- 기초의원 (비례)
    'educational_superintendent',     -- 교육감
    'educational_committee'           -- 교육위원
  )),
  seats             int not null default 1,
  nec_district_code text,
  is_byelection     boolean not null default false,
  status            text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_at        timestamptz not null default now(),
  unique (election_id, nec_district_code)
);

create index ed_election_idx on electoral_districts(election_id);
create index ed_region_idx on electoral_districts(region_code);
create index ed_type_idx on electoral_districts(district_type);
create index ed_byelection_idx on electoral_districts(election_id) where is_byelection = true;

-- ─────────────────────────────────────────────────────────────────────
-- 3. candidates — 후보자 (선거 × 선거구 × 인물)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists candidates (
  id                uuid primary key default gen_random_uuid(),
  election_id       uuid not null references elections(id) on delete cascade,
  district_id       uuid not null references electoral_districts(id) on delete cascade,
  politician_id     uuid not null references politicians(id) on delete cascade,
  party_id          uuid references parties(id),
  candidate_number  int,
  status            text not null check (status in (
    'registered', 'withdrew', 'elected', 'not_elected', 'invalid'
  )),
  registered_at     timestamptz,
  nec_candidate_id  text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  unique (election_id, district_id, politician_id)
);

create index c_district_idx on candidates(district_id);
create index c_politician_idx on candidates(politician_id);
create index c_election_idx on candidates(election_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. district_watch — 사용자 관심 선거구 (1차 출시는 디바이스 단위 익명)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists district_watch (
  user_id      text not null,
  district_id  uuid not null references electoral_districts(id) on delete cascade,
  added_at     timestamptz not null default now(),
  primary key (user_id, district_id)
);

create index dw_user_idx on district_watch(user_id);

-- ─────────────────────────────────────────────────────────────────────
-- 5. daily_district_metrics — 선거구 일배치 집계
-- ─────────────────────────────────────────────────────────────────────
create table if not exists daily_district_metrics (
  district_id      uuid not null references electoral_districts(id) on delete cascade,
  date             date not null,
  mention_count    int not null default 0,
  source_count     int not null default 0,
  top_keywords     text[] not null default '{}',
  top_themes       text[] not null default '{}',
  candidate_count  int not null default 0,
  computed_at      timestamptz not null default now(),
  primary key (district_id, date)
);

create index ddm_date_idx on daily_district_metrics(date desc);

-- ─────────────────────────────────────────────────────────────────────
-- 기존 테이블 확장
-- ─────────────────────────────────────────────────────────────────────

-- news_articles : 기사 분류 5종
alter table news_articles
  add column if not exists article_type text not null default 'news'
  check (article_type in (
    'news',              -- 일반 기사
    'editorial',         -- 사설·칼럼 (외부 의견 — UI에 명시 의무)
    'analysis',          -- 해설 기사
    'interview',         -- 인터뷰
    'official_source'    -- 공식자료 (선관위·국회·지자체)
  ));

create index if not exists na_article_type_idx on news_articles(article_type);

-- article_mentions : 선거구 컨텍스트
alter table article_mentions
  add column if not exists district_id uuid references electoral_districts(id);

create index if not exists am_district_idx on article_mentions(district_id) where district_id is not null;

-- politicians : 현재 출마 선거구 캐시 (J1이 갱신)
alter table politicians
  add column if not exists current_candidacy_district_id uuid references electoral_districts(id);

-- source_provider 확장 — 'nec' / 'assembly' / 'local_gov' 공식자료용
alter table news_articles
  drop constraint if exists news_articles_source_provider_check;

alter table news_articles
  add constraint news_articles_source_provider_check
  check (source_provider in (
    'bigkinds', 'naver', 'manual',
    'nec', 'assembly', 'local_gov',   -- 공식자료 출처
    'regional_rss'                    -- 3단계 지역 RSS
  ));

-- ─────────────────────────────────────────────────────────────────────
-- 선거 기간 정책 토글
-- ─────────────────────────────────────────────────────────────────────
insert into system_settings (key, value, description) values
  ('current_election_id', 'null'::jsonb, '현재 활성 선거 ID. 6·3 선거 시 9회 지방선거의 elections.id'),
  ('compare_widget_strict_label', 'true'::jsonb, '선거 기간 비교 위젯 헤더 "흐름 차이 표시 · 평가 아님" 라벨 강제'),
  ('poll_period_blackout', 'false'::jsonb, '여론조사 공표 제한 기간 차단 토글 (6/2 24시 ~ 6/3 20시)')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 9회 전국동시지방선거 시드 (실제 nec_election_id는 선관위 API 확인 후 갱신)
-- ─────────────────────────────────────────────────────────────────────
-- insert into elections (id, name, election_type, date, status, nec_election_id)
-- values (
--   gen_random_uuid(),
--   '제9회 전국동시지방선거',
--   'local',
--   '2026-06-03',
--   'upcoming',
--   '<선관위 선거ID 값>'
-- );

-- insert into elections (name, election_type, date, status, nec_election_id)
-- values (
--   '2026 국회의원 재·보궐선거',
--   'by_election',
--   '2026-06-03',
--   'upcoming',
--   '<선관위 선거ID 값>'
-- );

-- ─────────────────────────────────────────────────────────────────────
-- view: v_active_election_districts — 진행 중 선거 + 선거구
-- ─────────────────────────────────────────────────────────────────────
create or replace view v_active_election_districts as
select
  e.id as election_id,
  e.name as election_name,
  e.date as election_date,
  e.election_type,
  d.id as district_id,
  d.name as district_name,
  d.parent_region,
  d.district_type,
  d.seats,
  d.is_byelection,
  d.nec_district_code,
  (select count(*) from candidates c where c.district_id = d.id and c.status = 'registered') as candidate_count
from elections e
join electoral_districts d on d.election_id = e.id
where e.status in ('upcoming', 'ongoing')
  and d.status = 'active';

comment on table elections is '선거 회차 마스터. 9회 지방선거·재보궐 등.';
comment on table electoral_districts is '선거구. district_type으로 의원/단체장/교육감 등 구분.';
comment on table candidates is '후보자 = 인물(politicians) × 선거(elections) × 선거구.';
comment on table daily_district_metrics is '선거구 단위 일배치 집계. 6·3 사이클 핵심 지표 출처.';
comment on column news_articles.article_type is '기사 분류 5종. editorial/analysis는 UI에서 "외부 의견" 라벨 의무.';
