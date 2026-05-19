-- KPOL admin 화면이 anon key로 event_logs 통계를 조회할 수 있게 select 허용.
-- 운영 단계 임시 정책: 별도 인증 시스템 도입 시 더 엄격한 정책으로 교체.

drop policy if exists event_logs_anon_select on public.event_logs;
create policy event_logs_anon_select
  on public.event_logs
  for select
  to anon
  using (true);
