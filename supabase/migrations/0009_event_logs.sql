-- KPOL event_logs — 1차 사용량 카운팅 (공유 / 카테고리 클릭 / PWA 실행).
-- 익명 insert 허용, 개인정보 ✗.

create table if not exists public.event_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_target text,
  path text,
  user_agent text,
  is_pwa boolean,
  created_at timestamptz not null default now()
);

create index if not exists event_logs_event_type_created_at_idx
  on public.event_logs (event_type, created_at desc);

create index if not exists event_logs_created_at_idx
  on public.event_logs (created_at desc);

-- 익명 사용자가 insert만 가능. select/update/delete는 admin만 (RLS 기본 거부).
alter table public.event_logs enable row level security;

drop policy if exists event_logs_anon_insert on public.event_logs;
create policy event_logs_anon_insert
  on public.event_logs
  for insert
  to anon
  with check (true);

-- 인증된 service role은 모든 작업 가능 (대시보드/집계용)
drop policy if exists event_logs_service_all on public.event_logs;
create policy event_logs_service_all
  on public.event_logs
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.event_logs is 'KPOL 익명 사용량 이벤트. event_type: share_click | category_click | pwa_launch';
comment on column public.event_logs.event_type is 'share_click / category_click / pwa_launch';
comment on column public.event_logs.event_target is 'category_click 한정: person | media | by_election | local_election';
comment on column public.event_logs.is_pwa is 'standalone display-mode 여부';
