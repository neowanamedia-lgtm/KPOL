-- KPOL Interest Targets — 동적 운영 모델
-- 작성: 2026-05-19
-- 선행: 0001 ~ 0007 적용 후 실행
-- 실행 보류 — 키 발급 + 0007 적용 후 활성화
--
-- 핵심:
--   interest_targets : 모든 관심 대상 (자동 + 관리자) 단일 테이블
--   refresh_auto_interest_targets() : J4가 호출하는 자동 생성 통합 함수
--   gen_*_targets() : 5개 reason별 자동 생성 규칙

-- ─────────────────────────────────────────────────────────────────────
-- interest_targets — 관심 대상 마스터
-- ─────────────────────────────────────────────────────────────────────
create table if not exists interest_targets (
  id               uuid primary key default gen_random_uuid(),
  target_type      text not null check (target_type in (
    'politician', 'district', 'regional_office', 'election', 'issue_cluster'
  )),
  -- 외부 키: politicians.id / electoral_districts.id / elections.id / cluster slug
  target_ref       text not null,
  title            text not null,
  subtitle         text,

  -- 운영
  auto_generated   boolean not null default false,
  pinned           boolean not null default false,
  priority         text not null default 'normal'
                   check (priority in ('pinned', 'high', 'normal', 'low')),
  priority_score   int not null default 50,         -- 정렬용 0 ~ 100
  is_active        boolean not null default true,
  generated_reason text check (generated_reason in (
    'election_cycle', 'mention_surge', 'regional_focus',
    'editorial_focus', 'keyword_surge', 'manager_pick'
  )),
  reason_metadata  jsonb not null default '{}'::jsonb,
  expires_at       timestamptz,

  -- 패널 구성 (PanelConfig[] JSONB)
  panels           jsonb not null default '[]'::jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists it_unique_active
  on interest_targets (target_type, target_ref)
  where is_active = true;

create index if not exists it_priority_idx
  on interest_targets (priority_score desc, updated_at desc)
  where is_active = true;

create index if not exists it_auto_idx
  on interest_targets (auto_generated, is_active);

create index if not exists it_reason_idx
  on interest_targets (generated_reason)
  where is_active = true;

create trigger trg_it_updated
  before update on interest_targets
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 기본 panel preset — target_type별
-- ─────────────────────────────────────────────────────────────────────
create or replace function _fn_default_panels(p_type text)
returns jsonb
language sql
immutable
as $$
  select case p_type
    when 'politician' then '[
      {"type":"trend_panel","visible":true,"order":1},
      {"type":"chart_panel","visible":true,"order":2},
      {"type":"keyword_flow","visible":true,"order":3},
      {"type":"indicators_panel","visible":true,"order":4},
      {"type":"compare_panel","visible":true,"order":5},
      {"type":"article_panel","visible":true,"order":6},
      {"type":"editorial_panel","visible":true,"order":7},
      {"type":"official_sources_panel","visible":true,"order":8}
    ]'::jsonb
    when 'district' then '[
      {"type":"trend_panel","visible":true,"order":1},
      {"type":"chart_panel","visible":true,"order":2},
      {"type":"related_targets_panel","visible":true,"order":3,"params":{"mode":"candidates"}},
      {"type":"compare_panel","visible":true,"order":4},
      {"type":"keyword_flow","visible":true,"order":5},
      {"type":"article_panel","visible":true,"order":6},
      {"type":"editorial_panel","visible":true,"order":7},
      {"type":"official_sources_panel","visible":true,"order":8}
    ]'::jsonb
    when 'regional_office' then '[
      {"type":"related_targets_panel","visible":true,"order":1,"params":{"mode":"candidates"}},
      {"type":"compare_panel","visible":true,"order":2},
      {"type":"trend_panel","visible":true,"order":3},
      {"type":"chart_panel","visible":true,"order":4},
      {"type":"keyword_flow","visible":true,"order":5},
      {"type":"article_panel","visible":true,"order":6},
      {"type":"editorial_panel","visible":true,"order":7},
      {"type":"official_sources_panel","visible":true,"order":8}
    ]'::jsonb
    when 'election' then '[
      {"type":"trend_panel","visible":true,"order":1},
      {"type":"related_targets_panel","visible":true,"order":2,"params":{"mode":"districts"}},
      {"type":"keyword_flow","visible":true,"order":3},
      {"type":"article_panel","visible":true,"order":4},
      {"type":"editorial_panel","visible":true,"order":5}
    ]'::jsonb
    when 'issue_cluster' then '[
      {"type":"related_targets_panel","visible":true,"order":1,"params":{"mode":"members"}},
      {"type":"trend_panel","visible":true,"order":2},
      {"type":"keyword_flow","visible":true,"order":3},
      {"type":"article_panel","visible":true,"order":4}
    ]'::jsonb
    else '[]'::jsonb
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- gen_mention_surge_targets — 기사 급증 인물 자동 등록
-- ─────────────────────────────────────────────────────────────────────
create or replace function gen_mention_surge_targets(p_date date)
returns int
language plpgsql
as $$
declare v_count int;
begin
  with surge as (
    select
      p.id,
      p.name,
      (select position_label from politician_positions pp
        where pp.politician_id = p.id and pp.end_date is null limit 1) as position_label,
      (select pa.name from politician_positions pp
        left join parties pa on pa.id = pp.party_id
        where pp.politician_id = p.id and pp.end_date is null limit 1) as party_name,
      vpm.day_change_pct
    from politicians p
    join v_politician_metrics vpm on vpm.politician_id = p.id and vpm.date = p_date
    where p.is_active = true
      and vpm.day_change_pct >= 25
      and vpm.mention_count >= 30
    order by vpm.day_change_pct desc
    limit 5
  )
  insert into interest_targets (
    target_type, target_ref, title, subtitle,
    auto_generated, priority, priority_score,
    generated_reason, reason_metadata, expires_at, panels
  )
  select
    'politician',
    s.id::text,
    s.name,
    coalesce(s.party_name || '·' || s.position_label, s.position_label, s.party_name),
    true,
    'high',
    80 + rank() over (order by s.day_change_pct desc)::int,
    'mention_surge',
    jsonb_build_object('day_change_pct', s.day_change_pct),
    now() + interval '3 days',
    _fn_default_panels('politician')
  from surge s
  on conflict (target_type, target_ref) where is_active = true
  do update set
    priority_score = excluded.priority_score,
    generated_reason = excluded.generated_reason,
    reason_metadata = excluded.reason_metadata,
    expires_at = excluded.expires_at,
    -- 관리자 핀은 보호
    pinned = interest_targets.pinned,
    updated_at = now()
  where interest_targets.auto_generated = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- gen_election_cycle_targets — 선거 일정 D-30 이내 선거구 자동 등록
-- ─────────────────────────────────────────────────────────────────────
create or replace function gen_election_cycle_targets(p_date date)
returns int
language plpgsql
as $$
declare v_count int;
begin
  with active_districts as (
    select
      d.id,
      d.name,
      d.is_byelection,
      e.name as election_name,
      e.date - p_date as days_to_election
    from electoral_districts d
    join elections e on e.id = d.election_id
    where e.status = 'upcoming'
      and e.date - p_date between 0 and 30
      and d.status = 'active'
  )
  insert into interest_targets (
    target_type, target_ref, title, subtitle,
    auto_generated, priority, priority_score,
    generated_reason, reason_metadata, expires_at, panels
  )
  select
    case
      when d.name ~ '(시장|지사)' and d.is_byelection = false then 'regional_office'
      else 'district'
    end,
    d.id::text,
    d.name,
    d.election_name || case when d.is_byelection then ' · 재·보궐' else '' end,
    true,
    case when d.days_to_election <= 14 then 'high' else 'normal' end,
    70 + greatest(0, 30 - d.days_to_election)::int,
    'election_cycle',
    jsonb_build_object('days_to_election', d.days_to_election),
    (select date from elections where id = (
      select election_id from electoral_districts where id = d.id
    )) + interval '7 days',
    _fn_default_panels(case
      when d.name ~ '(시장|지사)' and d.is_byelection = false then 'regional_office'
      else 'district'
    end)
  from active_districts d
  on conflict (target_type, target_ref) where is_active = true
  do update set
    priority_score = excluded.priority_score,
    priority = excluded.priority,
    reason_metadata = excluded.reason_metadata,
    pinned = interest_targets.pinned,
    updated_at = now()
  where interest_targets.auto_generated = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 나머지 3개 — 스텁 (실 데이터 안정화 후 본 구현)
-- ─────────────────────────────────────────────────────────────────────
create or replace function gen_regional_focus_targets(p_date date)
returns int language plpgsql as $$
begin
  -- TODO: 광역 단위로 7일 기사 집중도 산정 후 상위 N개 광역의 대표 선거구를 regional_focus로 등록
  return 0;
end;
$$;

create or replace function gen_editorial_focus_targets(p_date date)
returns int language plpgsql as $$
begin
  -- TODO: 최근 7일 사설·해설(news_articles.article_type IN ('editorial','analysis'))이
  --       기준치 이상 등장한 인물·선거구를 editorial_focus로 등록
  return 0;
end;
$$;

create or replace function gen_keyword_surge_targets(p_date date)
returns int language plpgsql as $$
begin
  -- TODO: 정책 키워드 사전(policy_keywords)과 결합하여 급등 키워드를
  --       issue_cluster 타입으로 등록 (target_ref = 'kw_<slug>')
  return 0;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- refresh_auto_interest_targets — J4가 호출하는 통합 갱신 함수
-- ─────────────────────────────────────────────────────────────────────
create or replace function refresh_auto_interest_targets(p_date date default current_date)
returns jsonb
language plpgsql
as $$
declare
  v_expired int;
  v_surge int;
  v_election int;
  v_regional int;
  v_editorial int;
  v_keyword int;
begin
  -- 1. 만료된 자동 대상 비활성화 (관리자 핀 제외)
  update interest_targets
  set is_active = false, updated_at = now()
  where auto_generated = true
    and pinned = false
    and (
      (expires_at is not null and expires_at < now()) or
      (generated_reason = 'mention_surge' and updated_at < now() - interval '3 days')
    );
  get diagnostics v_expired = row_count;

  -- 2~6. 5개 자동 생성 함수 호출
  v_surge     := gen_mention_surge_targets(p_date);
  v_election  := gen_election_cycle_targets(p_date);
  v_regional  := gen_regional_focus_targets(p_date);
  v_editorial := gen_editorial_focus_targets(p_date);
  v_keyword   := gen_keyword_surge_targets(p_date);

  return jsonb_build_object(
    'expired', v_expired,
    'mention_surge', v_surge,
    'election_cycle', v_election,
    'regional_focus', v_regional,
    'editorial_focus', v_editorial,
    'keyword_surge', v_keyword
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- RPC — 앱이 호출
-- ─────────────────────────────────────────────────────────────────────

-- get_my_interests() — 사용자 핀/관심 대상 (1차 출시는 manager_pick + pinned)
create or replace function get_my_interests()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'type', target_type,
      'target_ref', target_ref,
      'title', title,
      'subtitle', subtitle,
      'auto_generated', auto_generated,
      'pinned', pinned,
      'priority', priority,
      'priority_score', priority_score,
      'generated_reason', generated_reason,
      'panels', panels,
      'updated_at', updated_at
    ) order by priority_score desc, updated_at desc
  ), '[]'::jsonb) ||
  (select _fn_response_meta())
  from interest_targets
  where is_active = true
    and (pinned = true or generated_reason = 'manager_pick');
$$;

-- get_recommended_interests(limit) — 사용자 미추가 자동 대상
create or replace function get_recommended_interests(p_limit int default 6)
returns jsonb
language plpgsql
stable
as $$
declare
  v_meta jsonb := _fn_response_meta();
  v_items jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'type', target_type,
      'target_ref', target_ref,
      'title', title,
      'subtitle', subtitle,
      'generated_reason', generated_reason,
      'reason_metadata', reason_metadata,
      'priority_score', priority_score
    ) order by priority_score desc
  ), '[]'::jsonb) into v_items
  from (
    select * from interest_targets
    where is_active = true
      and auto_generated = true
      and pinned = false
    order by priority_score desc
    limit p_limit
  ) t;

  return v_meta || jsonb_build_object('items', v_items);
end;
$$;

grant execute on function get_my_interests() to anon, authenticated;
grant execute on function get_recommended_interests(int) to anon, authenticated;
grant execute on function refresh_auto_interest_targets(date) to service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 6·3 핀 시드 (실 ID 채워 넣은 뒤 실행)
-- ─────────────────────────────────────────────────────────────────────
-- 아래 INSERT는 0007 시드로 elections / electoral_districts 적재 후 실행한다.
-- target_ref의 <...>는 실제 uuid로 치환.
--
-- insert into interest_targets (target_type, target_ref, title, subtitle,
--                                auto_generated, pinned, priority, priority_score,
--                                generated_reason, panels) values
-- ('issue_cluster',  'by_election_14',         '재보궐 14곳', '14개 선거구 · 6·3', false, true, 'pinned', 100, 'manager_pick', _fn_default_panels('issue_cluster')),
-- ('regional_office','<seoul_mayor_id>',       '서울시장',    '9회 지방선거',       false, true, 'pinned', 99,  'manager_pick', _fn_default_panels('regional_office')),
-- ('regional_office','<gyeonggi_governor_id>', '경기지사',    '9회 지방선거',       false, true, 'pinned', 98,  'manager_pick', _fn_default_panels('regional_office')),
-- ('regional_office','<busan_mayor_id>',       '부산시장',    '9회 지방선거',       false, true, 'pinned', 97,  'manager_pick', _fn_default_panels('regional_office')),
-- ('election',       '<9th_local_election>',   '9회 지방선거','2026-06-03',         false, true, 'pinned', 96,  'manager_pick', _fn_default_panels('election'));

comment on table interest_targets is 'KPOL 관심 대상 마스터. auto_generated + manager_pick 동시 운영. J4가 refresh_auto_interest_targets로 갱신.';
comment on column interest_targets.target_ref is '외부 키. politicians.id / electoral_districts.id / elections.id / cluster slug.';
comment on column interest_targets.panels is 'PanelConfig[] JSONB — InterestDetailScreen 패널 구성.';
comment on column interest_targets.expires_at is '자동 생성 대상 만료. 관리자 핀은 NULL.';
