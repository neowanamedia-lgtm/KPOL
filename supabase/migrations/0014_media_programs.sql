-- 0014_media_programs.sql
-- KPOL Media 프로그램 중심 데이터 구조.
--
-- 정책:
--   - 채널이 아닌 "프로그램" 이 KPOL Media 의 1차 단위
--   - 프로그램은 진행자(host) / 고정 패널(panelist) / 게스트·언급(person_link) 으로 인물과 연결
--   - person_id 는 향후 persons 테이블 도입 시 FK 로 사용 (현재 nullable, name 으로 loose link)
--   - political_alignment 는 수동 입력 전용. AI 자동 판정 금지 (kpol-data-ingest-safety).
--
-- RLS:
--   - public read 허용 (UI 가 anon 으로 조회)
--   - 쓰기는 service_role (admin) 만 — 별도 정책 없음

------------------------------------------------------------------
-- 1) media_programs — 프로그램 본체
------------------------------------------------------------------
create table if not exists public.media_programs (
  id uuid primary key default gen_random_uuid(),

  -- 식별
  title text not null,
  slug text unique,                          -- URL/딥링크용 (선택)

  -- 채널·방송사 연결
  broadcaster text,                          -- 'MBC' | 'KBS' | 'JTBC' | 'YouTube Original' 등
  channel_name text,                         -- 'MBC 라디오 시사' 같은 운영 채널명
  youtube_channel_id text,                   -- UC... (media_sources_raw.raw_payload.id 와 loose link)
  external_url text,                         -- 공식 페이지/플레이리스트 URL
  thumbnail_url text,

  -- 메타
  category text,                             -- 'morning_radio' | 'news_show' | 'panel_debate' | 'commentary' | 'interview' | 'other'
  description text,
  upload_frequency text,                     -- '평일 매일' | '주간' | '월간' 등
  started_at date,
  ended_at date,
  active_status text not null default 'active', -- 'active' | 'ended' | 'on_hiatus'

  -- 영향력·분류 (수동 / 산정 결과)
  political_alignment text,                  -- 수동 입력만. null 허용. AI 임의 판정 ✗.
  average_views numeric,
  influence_score numeric,

  -- 출처 보존
  raw_payload jsonb,

  -- 시간
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_programs_title_idx           on public.media_programs (title);
create index if not exists media_programs_active_idx          on public.media_programs (active_status);
create index if not exists media_programs_broadcaster_idx     on public.media_programs (broadcaster);
create index if not exists media_programs_channel_idx         on public.media_programs (youtube_channel_id);
create index if not exists media_programs_influence_idx       on public.media_programs (influence_score desc);
create index if not exists media_programs_category_idx        on public.media_programs (category);

comment on table public.media_programs is
  'KPOL 미디어 프로그램 본체 (채널 아닌 프로그램 단위).';
comment on column public.media_programs.political_alignment is
  '수동 입력 전용. AI 임의 판정 금지 (kpol-data-ingest-safety).';

------------------------------------------------------------------
-- 2) media_program_hosts — 진행자
------------------------------------------------------------------
create table if not exists public.media_program_hosts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.media_programs(id) on delete cascade,

  person_name text not null,
  person_id uuid,                            -- future FK → persons. 현재 nullable, name loose link.

  role text not null default '진행자',         -- '진행자' | '공동진행자' | 'MC'
  active boolean not null default true,
  notes text,

  created_at timestamptz not null default now()
);
create index if not exists mph_program_idx     on public.media_program_hosts (program_id);
create index if not exists mph_person_name_idx on public.media_program_hosts (person_name);
create index if not exists mph_person_id_idx   on public.media_program_hosts (person_id);

------------------------------------------------------------------
-- 3) media_program_panelists — 고정 패널
------------------------------------------------------------------
create table if not exists public.media_program_panelists (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.media_programs(id) on delete cascade,

  person_name text not null,
  person_id uuid,

  panel_role text,                           -- '고정 패널' | '평론가' | '주간 출연' 등
  cadence text,                              -- '매회' | '주간' | '월간' (정성적 표기)
  active boolean not null default true,
  notes text,

  created_at timestamptz not null default now()
);
create index if not exists mpp_program_idx     on public.media_program_panelists (program_id);
create index if not exists mpp_person_name_idx on public.media_program_panelists (person_name);
create index if not exists mpp_person_id_idx   on public.media_program_panelists (person_id);

------------------------------------------------------------------
-- 4) media_program_person_links — 게스트 출연, 언급, 클립 등 폭넓은 연결
------------------------------------------------------------------
create table if not exists public.media_program_person_links (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.media_programs(id) on delete cascade,

  person_name text not null,
  person_id uuid,

  link_type text not null,                   -- 'guest_appearance' | 'mention' | 'clip_subject' | 'interview'
  appearance_date date,                      -- 출연·언급 일자
  context text,                              -- 자유 설명 (코너명, 발언 요지 등)
  source_url text,                           -- 영상/기사 URL
  source_video_id text,                      -- YouTube video id 가 있으면

  raw_payload jsonb,

  created_at timestamptz not null default now()
);
create index if not exists mpl_program_idx          on public.media_program_person_links (program_id);
create index if not exists mpl_person_name_idx      on public.media_program_person_links (person_name);
create index if not exists mpl_person_id_idx        on public.media_program_person_links (person_id);
create index if not exists mpl_type_date_idx        on public.media_program_person_links (link_type, appearance_date desc);
create index if not exists mpl_program_date_idx     on public.media_program_person_links (program_id, appearance_date desc);

------------------------------------------------------------------
-- 5) RLS — public read, 쓰기는 service_role (별도 정책 없음 → 자동 우회)
------------------------------------------------------------------
alter table public.media_programs              enable row level security;
alter table public.media_program_hosts         enable row level security;
alter table public.media_program_panelists     enable row level security;
alter table public.media_program_person_links  enable row level security;

drop policy if exists media_programs_public_read on public.media_programs;
create policy media_programs_public_read on public.media_programs
  for select to anon, authenticated using (true);

drop policy if exists media_program_hosts_public_read on public.media_program_hosts;
create policy media_program_hosts_public_read on public.media_program_hosts
  for select to anon, authenticated using (true);

drop policy if exists media_program_panelists_public_read on public.media_program_panelists;
create policy media_program_panelists_public_read on public.media_program_panelists
  for select to anon, authenticated using (true);

drop policy if exists media_program_person_links_public_read on public.media_program_person_links;
create policy media_program_person_links_public_read on public.media_program_person_links
  for select to anon, authenticated using (true);

------------------------------------------------------------------
-- 6) updated_at 자동 갱신 트리거 (programs 만)
------------------------------------------------------------------
create or replace function public.touch_media_programs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists media_programs_touch_updated_at on public.media_programs;
create trigger media_programs_touch_updated_at
  before update on public.media_programs
  for each row execute function public.touch_media_programs_updated_at();
