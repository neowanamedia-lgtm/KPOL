-- KPOL 랭킹 계산 함수
-- 각 함수는 rankings + ranking_entries에 새 스냅샷 INSERT.
-- J4 (aggregate_and_rank) Edge Function이 이 함수들을 호출.
--
-- 스냅샷 방식: 매 실행마다 새 rankings.id 생성 → 시계열 보존.
-- 과거 랭킹을 조회하려면 ranking_type + computed_at 범위로 검색.

-- ─────────────────────────────────────────────────────────────────────
-- compute_ranking_today_surge(date)
-- 선출직 중 (영향력 인물 제외) day_change_pct 상위 10.
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_ranking_today_surge(p_date date)
returns uuid
language plpgsql
as $$
declare
  v_ranking_id uuid;
  v_basis text := '뉴스 언급량 일변화율 기준';
begin
  insert into rankings (ranking_type, scope, basis_label, source_window_start, source_window_end)
  values ('today_surge', 'all', v_basis, p_date::timestamptz, (p_date + 1)::timestamptz)
  returning id into v_ranking_id;

  insert into ranking_entries (ranking_id, rank, politician_id, metric_value, metric_change)
  select
    v_ranking_id,
    row_number() over (order by vpm.day_change_pct desc nulls last),
    p.id,
    coalesce(vpm.mention_count, 0),
    vpm.day_change_pct
  from politicians p
  join v_politician_metrics vpm on vpm.politician_id = p.id and vpm.date = p_date
  where p.is_active = true
    and p.person_type not in (
      'political_commentator', 'political_youtuber',
      'political_platform_operator', 'political_influencer'
    )
    and vpm.day_change_pct is not null
    and vpm.mention_count >= 3       -- 노이즈 차단
  order by vpm.day_change_pct desc nulls last
  limit 10;

  return v_ranking_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- compute_ranking_weekly_mention(date)
-- 최근 7일 누적 언급량 상위 10. (선출직 한정)
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_ranking_weekly_mention(p_date date)
returns uuid
language plpgsql
as $$
declare
  v_ranking_id uuid;
  v_basis text := '최근 7일 누적 뉴스 언급량 기준';
begin
  insert into rankings (ranking_type, scope, basis_label, source_window_start, source_window_end)
  values ('weekly_mention', 'all', v_basis, (p_date - 6)::timestamptz, (p_date + 1)::timestamptz)
  returning id into v_ranking_id;

  insert into ranking_entries (ranking_id, rank, politician_id, metric_value, metric_change)
  select
    v_ranking_id,
    row_number() over (order by week_sum desc),
    politician_id,
    week_sum,
    null
  from (
    select dm.politician_id, sum(dm.mention_count) as week_sum
    from daily_metrics dm
    join politicians p on p.id = dm.politician_id
    where dm.date between p_date - 6 and p_date
      and p.is_active = true
      and p.person_type not in (
        'political_commentator', 'political_youtuber',
        'political_platform_operator', 'political_influencer'
      )
    group by dm.politician_id
    order by week_sum desc
    limit 10
  ) t;

  return v_ranking_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- compute_ranking_top_mentioned(date)
-- 오늘 언급량 상위 10. (선출직)
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_ranking_top_mentioned(p_date date)
returns uuid
language plpgsql
as $$
declare
  v_ranking_id uuid;
  v_basis text := '오늘 뉴스 언급량 기준';
begin
  insert into rankings (ranking_type, scope, basis_label, source_window_start, source_window_end)
  values ('top_mentioned', 'all', v_basis, p_date::timestamptz, (p_date + 1)::timestamptz)
  returning id into v_ranking_id;

  insert into ranking_entries (ranking_id, rank, politician_id, metric_value, metric_change)
  select
    v_ranking_id,
    row_number() over (order by dm.mention_count desc),
    dm.politician_id,
    dm.mention_count,
    vpm.day_change_pct
  from daily_metrics dm
  join politicians p on p.id = dm.politician_id
  left join v_politician_metrics vpm on vpm.politician_id = dm.politician_id and vpm.date = dm.date
  where dm.date = p_date
    and p.is_active = true
    and p.person_type not in (
      'political_commentator', 'political_youtuber',
      'political_platform_operator', 'political_influencer'
    )
  order by dm.mention_count desc
  limit 10;

  return v_ranking_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- compute_ranking_theme_surge(date)
-- 테마별 전일 대비 변화율 상위.
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_ranking_theme_surge(p_date date)
returns uuid
language plpgsql
as $$
declare
  v_ranking_id uuid;
  v_basis text := '테마 뉴스 언급량 변화율 기준';
begin
  insert into rankings (ranking_type, scope, basis_label, source_window_start, source_window_end)
  values ('theme_surge', 'all', v_basis, p_date::timestamptz, (p_date + 1)::timestamptz)
  returning id into v_ranking_id;

  insert into ranking_entries (ranking_id, rank, theme_id, metric_value, metric_change)
  select
    v_ranking_id,
    row_number() over (order by chg desc nulls last),
    theme_id,
    today_count,
    chg
  from (
    select
      t.id as theme_id,
      coalesce(today.mention_count, 0) as today_count,
      case
        when coalesce(prev.mention_count, 0) = 0 then null
        else round(
          ((coalesce(today.mention_count, 0) - prev.mention_count)::numeric
            / prev.mention_count) * 100, 1)
      end as chg
    from themes t
    left join daily_theme_metrics today on today.theme_id = t.id and today.date = p_date
    left join daily_theme_metrics prev on prev.theme_id = t.id and prev.date = p_date - 1
    where t.is_active = true
  ) computed
  order by chg desc nulls last
  limit 10;

  return v_ranking_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- compute_ranking_influence_flow(date)
-- 영향력 인물(평론가/유튜버/플랫폼/인플루언서) 변화율 정렬.
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_ranking_influence_flow(p_date date)
returns uuid
language plpgsql
as $$
declare
  v_ranking_id uuid;
  v_basis text := '영향력 인물 뉴스 언급량 기준';
begin
  insert into rankings (ranking_type, scope, basis_label, source_window_start, source_window_end)
  values ('influence_flow', 'influence', v_basis, p_date::timestamptz, (p_date + 1)::timestamptz)
  returning id into v_ranking_id;

  insert into ranking_entries (ranking_id, rank, politician_id, metric_value, metric_change)
  select
    v_ranking_id,
    row_number() over (order by coalesce(vpm.day_change_pct, vpm.week_change_pct, 0) desc),
    p.id,
    coalesce(vpm.mention_count, 0),
    coalesce(vpm.day_change_pct, vpm.week_change_pct, 0)
  from politicians p
  left join v_politician_metrics vpm on vpm.politician_id = p.id and vpm.date = p_date
  where p.is_active = true
    and p.person_type in (
      'political_commentator', 'political_youtuber',
      'political_platform_operator', 'political_influencer'
    )
  order by coalesce(vpm.day_change_pct, vpm.week_change_pct, 0) desc;

  return v_ranking_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- compute_all_rankings(date)
-- J4가 호출. 5종 일괄 계산.
-- ─────────────────────────────────────────────────────────────────────
create or replace function compute_all_rankings(p_date date default current_date)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb := '{}'::jsonb;
begin
  v_result := v_result || jsonb_build_object('today_surge',     compute_ranking_today_surge(p_date));
  v_result := v_result || jsonb_build_object('weekly_mention',  compute_ranking_weekly_mention(p_date));
  v_result := v_result || jsonb_build_object('top_mentioned',   compute_ranking_top_mentioned(p_date));
  v_result := v_result || jsonb_build_object('theme_surge',     compute_ranking_theme_surge(p_date));
  v_result := v_result || jsonb_build_object('influence_flow',  compute_ranking_influence_flow(p_date));
  return v_result;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- refresh_politician_current_tags(date)
-- politicians.current_keywords / current_themes 갱신.
-- 최근 7일 article_mentions × news_articles.extracted_keywords × article_themes 집계.
-- J4가 호출.
-- ─────────────────────────────────────────────────────────────────────
create or replace function refresh_politician_current_tags(p_date date default current_date)
returns int
language plpgsql
as $$
declare
  v_updated int;
begin
  with kw as (
    select am.politician_id, kw_unnest as kw, count(*) as cnt
    from article_mentions am
    join news_articles na on na.id = am.article_id
    cross join lateral unnest(na.extracted_keywords) as kw_unnest
    where am.confidence >= 0.85
      and na.published_at >= (p_date - 6)::timestamptz
    group by am.politician_id, kw_unnest
  ),
  kw_top as (
    select politician_id, array_agg(kw order by cnt desc) filter (where rn <= 5) as top_keywords
    from (
      select *, row_number() over (partition by politician_id order by cnt desc) as rn
      from kw
    ) ranked
    group by politician_id
  ),
  tm as (
    select am.politician_id, t.name_ko as theme_name, count(*) as cnt
    from article_mentions am
    join article_themes at on at.article_id = am.article_id
    join themes t on t.id = at.theme_id
    where am.confidence >= 0.85
    group by am.politician_id, t.name_ko
  ),
  tm_top as (
    select politician_id, array_agg(theme_name order by cnt desc) filter (where rn <= 3) as top_themes
    from (
      select *, row_number() over (partition by politician_id order by cnt desc) as rn
      from tm
    ) ranked
    group by politician_id
  )
  update politicians p set
    current_keywords = coalesce(kw_top.top_keywords, '{}'),
    current_themes   = coalesce(tm_top.top_themes, '{}')
  from kw_top
  full outer join tm_top using (politician_id)
  where p.id = coalesce(kw_top.politician_id, tm_top.politician_id);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- recompute_daily_metrics(date)
-- article_mentions로부터 daily_metrics 갱신. J4의 1단계.
-- ─────────────────────────────────────────────────────────────────────
create or replace function recompute_daily_metrics(p_date date default current_date)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  insert into daily_metrics (politician_id, date, mention_count, source_count, theme_distribution, computed_at)
  select
    am.politician_id,
    p_date,
    count(distinct am.article_id) as mention_count,
    count(distinct na.source) as source_count,
    coalesce(
      jsonb_object_agg(t.theme_id, t.cnt) filter (where t.theme_id is not null),
      '{}'::jsonb
    ) as theme_distribution,
    now()
  from article_mentions am
  join news_articles na on na.id = am.article_id
  left join lateral (
    select at.theme_id, count(*) as cnt
    from article_themes at where at.article_id = am.article_id
    group by at.theme_id
  ) t on true
  where am.confidence >= 0.85
    and na.published_at::date = p_date
  group by am.politician_id
  on conflict (politician_id, date) do update set
    mention_count = excluded.mention_count,
    source_count = excluded.source_count,
    theme_distribution = excluded.theme_distribution,
    computed_at = excluded.computed_at;

  get diagnostics v_count = row_count;

  -- 테마별 일배치
  insert into daily_theme_metrics (theme_id, date, mention_count, computed_at)
  select at.theme_id, p_date, count(*), now()
  from article_themes at
  join news_articles na on na.id = at.article_id
  where na.published_at::date = p_date
  group by at.theme_id
  on conflict (theme_id, date) do update set
    mention_count = excluded.mention_count,
    computed_at = excluded.computed_at;

  return v_count;
end;
$$;
