-- KPOL 권리자단 + 4개 랭킹 테이블 (1차 구조).
-- public read 허용, 쓰기는 service_role만 (관리자 auth는 다음 단계).

------------------------------------------------------------------
-- 1) kpol_admins — 운영 권한 식별 (auth 연결 전 placeholder)
------------------------------------------------------------------
create table if not exists public.kpol_admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'admin',  -- owner | admin | editor | viewer
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

------------------------------------------------------------------
-- 2) people_rankings
------------------------------------------------------------------
create table if not exists public.people_rankings (
  id uuid primary key default gen_random_uuid(),
  rank integer not null,
  name text not null,
  category text,
  score numeric,
  description text,
  image_url text,
  source_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists people_rankings_rank_idx on public.people_rankings (rank);
create index if not exists people_rankings_active_idx on public.people_rankings (is_active);

------------------------------------------------------------------
-- 3) by_election_rankings
------------------------------------------------------------------
create table if not exists public.by_election_rankings (
  id uuid primary key default gen_random_uuid(),
  rank integer not null,
  name text not null,
  category text,
  score numeric,
  description text,
  image_url text,
  source_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists by_election_rankings_rank_idx on public.by_election_rankings (rank);
create index if not exists by_election_rankings_active_idx on public.by_election_rankings (is_active);

------------------------------------------------------------------
-- 4) local_election_rankings
------------------------------------------------------------------
create table if not exists public.local_election_rankings (
  id uuid primary key default gen_random_uuid(),
  rank integer not null,
  name text not null,
  category text,
  score numeric,
  description text,
  image_url text,
  source_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists local_election_rankings_rank_idx on public.local_election_rankings (rank);
create index if not exists local_election_rankings_active_idx on public.local_election_rankings (is_active);

------------------------------------------------------------------
-- 5) media_rankings — media_type 추가
------------------------------------------------------------------
create table if not exists public.media_rankings (
  id uuid primary key default gen_random_uuid(),
  rank integer not null,
  name text not null,
  media_type text,  -- youtube_channel | youtuber | news_media | podcast | online_media | other
  category text,
  score numeric,
  description text,
  image_url text,
  source_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists media_rankings_rank_idx on public.media_rankings (rank);
create index if not exists media_rankings_active_idx on public.media_rankings (is_active);
create index if not exists media_rankings_type_idx on public.media_rankings (media_type);

------------------------------------------------------------------
-- 6) RLS — 4 ranking 테이블 public read, kpol_admins은 service_role만
------------------------------------------------------------------
alter table public.kpol_admins enable row level security;
alter table public.people_rankings enable row level security;
alter table public.by_election_rankings enable row level security;
alter table public.local_election_rankings enable row level security;
alter table public.media_rankings enable row level security;

drop policy if exists people_rankings_public_read on public.people_rankings;
create policy people_rankings_public_read on public.people_rankings
  for select to anon, authenticated using (true);

drop policy if exists by_election_rankings_public_read on public.by_election_rankings;
create policy by_election_rankings_public_read on public.by_election_rankings
  for select to anon, authenticated using (true);

drop policy if exists local_election_rankings_public_read on public.local_election_rankings;
create policy local_election_rankings_public_read on public.local_election_rankings
  for select to anon, authenticated using (true);

drop policy if exists media_rankings_public_read on public.media_rankings;
create policy media_rankings_public_read on public.media_rankings
  for select to anon, authenticated using (true);

-- service_role은 모든 작업 자동 허용 (RLS 우회). 별도 정책 불필요.
-- kpol_admins은 anon select 정책 없음 → 관리자 식별 데이터 보호.

comment on table public.kpol_admins is 'KPOL 운영 권한 사용자. auth 연결 후 email 매핑으로 권한 체크.';
comment on table public.people_rankings is 'KPOL 인물 TOP100 랭킹';
comment on table public.by_election_rankings is 'KPOL 보궐선거 랭킹';
comment on table public.local_election_rankings is 'KPOL 지방선거 랭킹';
comment on table public.media_rankings is 'KPOL 미디어 TOP100 (유튜브/언론/팟캐스트 통합)';
