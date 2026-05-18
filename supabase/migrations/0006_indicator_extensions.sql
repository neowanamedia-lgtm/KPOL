-- KPOL 6대 차트 지표 — 스키마 확장 + 계산 함수
-- 선행: 0001 ~ 0005
-- 적용 시점: 빅카인즈 API 연결 후 J4 호출 흐름에 통합.
--
-- 6대 지표:
--   1. 전국 뉴스 노출 지수      national_exposure
--   2. 지역 뉴스 노출 지수      regional_exposure
--   3. 정책 키워드 연결 지수    policy_keyword_index
--   4. 이슈 집중도              issue_concentration_hhi
--   5. 언론사 다양성 지수       source_diversity (Shannon entropy)
--   6. 근거 기사 목록           (article_mentions 조회 — 이미 0004 RPC 존재)

-- ─────────────────────────────────────────────────────────────────────
-- sources 정규화 테이블 — 3단계 RSS 확장 대비
-- ─────────────────────────────────────────────────────────────────────
create table if not exists sources (
  id              text primary key,                -- slug. ex) 'chosun', 'busan_ilbo'
  name            text not null,
  source_type     text not null check (source_type in (
    'national_press',     -- 전국지
    'broadcast',          -- 방송
    'regional_press',     -- 지역지
    'online',             -- 온라인 매체
    'wire_service'        -- 통신사
  )),
  region_code     text,                            -- 지역지/광역방송의 행정구역 코드
  base_url        text,
  rss_url         text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index sources_type_idx on sources(source_type);
create index sources_region_idx on sources(region_code);

-- news_articles에 source_id 추가 (기존 source text 컬럼은 호환 유지)
alter table news_articles
  add column if not exists source_id text references sources(id);

create index if not exists na_source_id_idx on news_articles(source_id);

-- ─────────────────────────────────────────────────────────────────────
-- 정책 키워드 사전 — 빅카인즈 키워드 → 정책 키워드 매핑
-- ─────────────────────────────────────────────────────────────────────
create table if not exists policy_keywords (
  keyword         text primary key,
  theme_id        text references themes(id),
  weight          numeric default 1.0,
  is_active       boolean not null default true
);

-- ─────────────────────────────────────────────────────────────────────
-- politician_daily_indicators — 6대 지표 일배치 결과 저장
-- ─────────────────────────────────────────────────────────────────────
create table if not exists politician_daily_indicators (
  politician_id            uuid not null references politicians(id) on delete cascade,
  date                     date not null,
  national_exposure        numeric not null default 0,
  regional_exposure        numeric not null default 0,
  policy_keyword_index     numeric not null default 0,
  issue_concentration_hhi  numeric not null default 0,
  source_diversity         numeric not null default 0,
  distinct_source_count    int not null default 0,
  top_themes_share         jsonb not null default '{}'::jsonb,
  computed_at              timestamptz not null default now(),
  primary key (politician_id, date)
);

create index pdi_date_idx on politician_daily_indicators(date desc);

-- ─────────────────────────────────────────────────────────────────────
-- 헬퍼: source가 전국/지역인지 분류
-- 빅카인즈 응답에 매체 분류가 없으면 sources 테이블로, 그것도 없으면 text 매칭.
-- ─────────────────────────────────────────────────────────────────────
create or replace function _fn_source_is_regional(p_article_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    (select s.source_type = 'regional_press'
      from news_articles na
      join sources s on s.id = na.source_id
      where na.id = p_article_id),
    false
  );
$$;

create or replace function _fn_source_region_code(p_article_id uuid)
returns text
language sql
stable
as $$
  select s.region_code
  from news_articles na
  join sources s on s.id = na.source_id
  where na.id = p_article_id;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 1. 전국 뉴스 노출 지수
--    national_exposure = mention_count_national * ln(1 + national_source_count)
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_national_exposure(
  p_politician_id uuid,
  p_date date,
  p_window_days int default 7
)
returns numeric
language sql
stable
as $$
  with hits as (
    select na.id, coalesce(na.source_id, na.source) as src
    from article_mentions am
    join news_articles na on na.id = am.article_id
    left join sources s on s.id = na.source_id
    where am.politician_id = p_politician_id
      and am.confidence >= 0.85
      and na.published_at >= (p_date - (p_window_days - 1))::timestamptz
      and na.published_at < (p_date + 1)::timestamptz
      and (s.source_type is null or s.source_type in ('national_press', 'broadcast', 'wire_service', 'online'))
  )
  select coalesce(count(*) * ln(1 + count(distinct src)), 0)::numeric(12,2)
  from hits;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. 지역 뉴스 노출 지수
--    regional_exposure = mention_count_regional * ln(1 + regional_source_count)
--
--    매칭 규칙:
--      - source가 regional_press 이고
--      - source.region_code가 정치인의 현재 region_code와 같거나
--      - 기사 본문/제목에 정치인 district 키워드 포함 (MVP 단계는 본문 미저장이라 후순위)
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_regional_exposure(
  p_politician_id uuid,
  p_date date,
  p_window_days int default 30
)
returns numeric
language sql
stable
as $$
  with politician_region as (
    select pp.region_code
    from politician_positions pp
    where pp.politician_id = p_politician_id and pp.end_date is null
    limit 1
  ),
  hits as (
    select na.id, coalesce(na.source_id, na.source) as src
    from article_mentions am
    join news_articles na on na.id = am.article_id
    join sources s on s.id = na.source_id
    cross join politician_region pr
    where am.politician_id = p_politician_id
      and am.confidence >= 0.85
      and na.published_at >= (p_date - (p_window_days - 1))::timestamptz
      and na.published_at < (p_date + 1)::timestamptz
      and s.source_type = 'regional_press'
      and (pr.region_code is null or s.region_code = pr.region_code)
  )
  select coalesce(count(*) * ln(1 + count(distinct src)), 0)::numeric(12,2)
  from hits;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. 정책 키워드 연결 지수
--    distinct policy keywords 수 + 0.1 * total occurrences (가중 합)
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_policy_keyword_index(
  p_politician_id uuid,
  p_date date,
  p_window_days int default 30
)
returns numeric
language sql
stable
as $$
  with kw_occurs as (
    select pk.keyword, count(*) as cnt
    from article_mentions am
    join news_articles na on na.id = am.article_id
    cross join lateral unnest(na.extracted_keywords) as kw(name)
    join policy_keywords pk on pk.keyword = kw.name and pk.is_active = true
    where am.politician_id = p_politician_id
      and am.confidence >= 0.85
      and na.published_at >= (p_date - (p_window_days - 1))::timestamptz
      and na.published_at < (p_date + 1)::timestamptz
    group by pk.keyword
  )
  select coalesce(count(*) + 0.1 * sum(cnt), 0)::numeric(10,2)
  from kw_occurs;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. 이슈 집중도 (HHI)
--    sum(share_i^2) where share_i = articles_in_theme_i / total_articles
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_issue_concentration(
  p_politician_id uuid,
  p_date date,
  p_window_days int default 7
)
returns numeric
language sql
stable
as $$
  with theme_counts as (
    select at.theme_id, count(*)::numeric as cnt
    from article_mentions am
    join news_articles na on na.id = am.article_id
    join article_themes at on at.article_id = am.article_id
    where am.politician_id = p_politician_id
      and am.confidence >= 0.85
      and na.published_at >= (p_date - (p_window_days - 1))::timestamptz
      and na.published_at < (p_date + 1)::timestamptz
    group by at.theme_id
  ),
  total as (
    select sum(cnt) as t from theme_counts
  )
  select coalesce(
    (select round(sum(power(cnt / nullif(total.t, 0), 2))::numeric, 3)
     from theme_counts, total),
    0
  );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 4b. 이슈 집중도 부속: top themes share (UI 보조 표시용)
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_top_themes_share(
  p_politician_id uuid,
  p_date date,
  p_window_days int default 7,
  p_limit int default 3
)
returns jsonb
language sql
stable
as $$
  with theme_counts as (
    select t.name_ko, count(*)::numeric as cnt
    from article_mentions am
    join news_articles na on na.id = am.article_id
    join article_themes at on at.article_id = am.article_id
    join themes t on t.id = at.theme_id
    where am.politician_id = p_politician_id
      and am.confidence >= 0.85
      and na.published_at >= (p_date - (p_window_days - 1))::timestamptz
      and na.published_at < (p_date + 1)::timestamptz
    group by t.name_ko
  ),
  total as (
    select sum(cnt) as t from theme_counts
  )
  select coalesce(
    jsonb_object_agg(name_ko, round(cnt / nullif(total.t, 0), 3))
      filter (where rn <= p_limit),
    '{}'::jsonb
  )
  from (
    select name_ko, cnt, row_number() over (order by cnt desc) as rn
    from theme_counts
  ) ranked, total
  group by total.t;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. 언론사 다양성 지수 (Shannon entropy)
--    H = -sum(p_i * ln(p_i)) where p_i = articles_in_source_i / total_articles
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_source_diversity(
  p_politician_id uuid,
  p_date date,
  p_window_days int default 7
)
returns numeric
language sql
stable
as $$
  with source_counts as (
    select coalesce(na.source_id, na.source) as src, count(*)::numeric as cnt
    from article_mentions am
    join news_articles na on na.id = am.article_id
    where am.politician_id = p_politician_id
      and am.confidence >= 0.85
      and na.published_at >= (p_date - (p_window_days - 1))::timestamptz
      and na.published_at < (p_date + 1)::timestamptz
    group by coalesce(na.source_id, na.source)
  ),
  total as (
    select sum(cnt) as t from source_counts
  )
  select coalesce(
    round(-sum((cnt / nullif(total.t, 0)) * ln(cnt / nullif(total.t, 0)))::numeric, 3),
    0
  )
  from source_counts, total
  where cnt > 0;
$$;

create or replace function compute_distinct_source_count(
  p_politician_id uuid,
  p_date date,
  p_window_days int default 7
)
returns int
language sql
stable
as $$
  select count(distinct coalesce(na.source_id, na.source))::int
  from article_mentions am
  join news_articles na on na.id = am.article_id
  where am.politician_id = p_politician_id
    and am.confidence >= 0.85
    and na.published_at >= (p_date - (p_window_days - 1))::timestamptz
    and na.published_at < (p_date + 1)::timestamptz;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- refresh_politician_daily_indicators(date)
-- J4가 호출. 모든 활성 정치인에 대해 5개 지표 일괄 계산 후 UPSERT.
-- ─────────────────────────────────────────────────────────────────────
create or replace function refresh_politician_daily_indicators(p_date date default current_date)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  insert into politician_daily_indicators (
    politician_id, date,
    national_exposure, regional_exposure,
    policy_keyword_index, issue_concentration_hhi,
    source_diversity, distinct_source_count,
    top_themes_share, computed_at
  )
  select
    p.id,
    p_date,
    compute_national_exposure(p.id, p_date, 7),
    compute_regional_exposure(p.id, p_date, 30),
    compute_policy_keyword_index(p.id, p_date, 30),
    compute_issue_concentration(p.id, p_date, 7),
    compute_source_diversity(p.id, p_date, 7),
    compute_distinct_source_count(p.id, p_date, 7),
    compute_top_themes_share(p.id, p_date, 7, 3),
    now()
  from politicians p
  where p.is_active = true
  on conflict (politician_id, date) do update set
    national_exposure       = excluded.national_exposure,
    regional_exposure       = excluded.regional_exposure,
    policy_keyword_index    = excluded.policy_keyword_index,
    issue_concentration_hhi = excluded.issue_concentration_hhi,
    source_diversity        = excluded.source_diversity,
    distinct_source_count   = excluded.distinct_source_count,
    top_themes_share        = excluded.top_themes_share,
    computed_at             = excluded.computed_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- get_politician_detail() 확장 — indicators 필드 추가
-- 기존 0004의 함수를 교체.
-- ─────────────────────────────────────────────────────────────────────
create or replace function get_politician_detail(p_politician_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_date date := current_date;
  v_meta jsonb := _fn_response_meta();
  v_profile jsonb;
  v_metrics jsonb;
  v_flow jsonb;
  v_articles jsonb;
  v_indicators jsonb;
  v_pdi politician_daily_indicators;
begin
  if not exists (select 1 from politicians where id = p_politician_id) then
    return null;
  end if;

  -- profile
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'person_type', p.person_type,
    'party_name', (
      select pa.name from politician_positions pp
      left join parties pa on pa.id = pp.party_id
      where pp.politician_id = p.id and pp.end_date is null limit 1
    ),
    'affiliation', (
      select coalesce(af.outlet_name, af.channel_name)
      from politician_affiliations af
      where af.politician_id = p.id and (af.end_date is null or af.end_date >= current_date) limit 1
    ),
    'position_label', coalesce((select position_label from politician_positions pp
      where pp.politician_id = p.id and pp.end_date is null limit 1), ''),
    'region', (select district from politician_positions pp
      where pp.politician_id = p.id and pp.end_date is null limit 1)
  ) into v_profile
  from politicians p where p.id = p_politician_id;

  -- flow_14d
  select coalesce(jsonb_agg(jsonb_build_object('date', d.date, 'value', d.mention_count) order by d.date), '[]'::jsonb)
    into v_flow
  from daily_metrics d
  where d.politician_id = p_politician_id
    and d.date between v_date - 13 and v_date;

  -- metrics
  select jsonb_build_object(
    'today_mention_count', coalesce(dm.mention_count, 0),
    'mention_change', coalesce(vpm.day_change_pct, vpm.week_change_pct, 0),
    'flow_14d', v_flow
  ) into v_metrics
  from politicians p
  left join daily_metrics dm on dm.politician_id = p.id and dm.date = v_date
  left join v_politician_metrics vpm on vpm.politician_id = p.id and vpm.date = v_date
  where p.id = p_politician_id;

  -- indicators (없으면 0으로)
  select * into v_pdi
  from politician_daily_indicators
  where politician_id = p_politician_id and date = v_date;

  v_indicators := jsonb_build_object(
    'national_exposure', jsonb_build_object(
      'value', coalesce(v_pdi.national_exposure, 0),
      'basis', '전국 매체 노출 가중',
      'window_days', 7
    ),
    'regional_exposure', jsonb_build_object(
      'value', coalesce(v_pdi.regional_exposure, 0),
      'basis', '지역 매체 노출 가중',
      'window_days', 30
    ),
    'policy_keyword_index', jsonb_build_object(
      'value', coalesce(v_pdi.policy_keyword_index, 0),
      'basis', '30일 정책 키워드 연결 수',
      'top', (select to_jsonb(current_keywords) from politicians where id = p_politician_id)
    ),
    'issue_concentration', jsonb_build_object(
      'value', coalesce(v_pdi.issue_concentration_hhi, 0),
      'basis', '테마 분포 HHI (7d)',
      'top_themes_share', coalesce(v_pdi.top_themes_share, '{}'::jsonb)
    ),
    'source_diversity', jsonb_build_object(
      'value', coalesce(v_pdi.source_diversity, 0),
      'basis', '매체 엔트로피 (7d)',
      'distinct_count', coalesce(v_pdi.distinct_source_count, 0)
    )
  );

  -- related_articles
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', na.id, 'title', na.title, 'source', na.source,
      'published_at', na.published_at, 'url', na.url,
      'ai_summary_flag', na.ai_summary_flag
    ) order by na.published_at desc
  ), '[]'::jsonb) into v_articles
  from article_mentions am
  join news_articles na on na.id = am.article_id
  where am.politician_id = p_politician_id
    and am.confidence >= 0.85
  limit 20;

  return v_meta || jsonb_build_object(
    'profile', v_profile,
    'metrics', v_metrics,
    'indicators', v_indicators,
    'keywords', (select to_jsonb(current_keywords) from politicians where id = p_politician_id),
    'themes',   (select to_jsonb(current_themes)   from politicians where id = p_politician_id),
    'related_articles', v_articles
  );
end;
$$;

grant execute on function compute_national_exposure(uuid, date, int)        to service_role;
grant execute on function compute_regional_exposure(uuid, date, int)        to service_role;
grant execute on function compute_policy_keyword_index(uuid, date, int)     to service_role;
grant execute on function compute_issue_concentration(uuid, date, int)      to service_role;
grant execute on function compute_top_themes_share(uuid, date, int, int)    to service_role;
grant execute on function compute_source_diversity(uuid, date, int)         to service_role;
grant execute on function compute_distinct_source_count(uuid, date, int)    to service_role;
grant execute on function refresh_politician_daily_indicators(date)         to service_role;
grant execute on function get_politician_detail(uuid)                       to anon, authenticated;

comment on table politician_daily_indicators is 'J4가 일배치로 갱신하는 6대 지표 결과 저장소. 근거 기사는 article_mentions로 역추적.';
comment on table sources is '매체 정규화. 전국/지역/방송/온라인/통신사 구분. 지역지는 region_code로 광역단위 매칭.';
comment on table policy_keywords is '정책 키워드 사전. 빅카인즈 키워드 추출 결과를 정책 영역으로 매핑.';
