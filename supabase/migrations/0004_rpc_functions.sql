-- KPOL RPC 함수
-- 앱이 호출하는 5+1개 RPC. 응답은 JSONB로 PoliticianCardDTO 등 TS 컨트랙트와 모양 일치.
--
-- 공통 응답 메타: { basis_label, as_of, data_mode }
--   - basis_label : "뉴스 언급량 기준"
--   - as_of       : 마지막 J4 성공 시각
--   - data_mode   : system_settings.demo_mode 값 ('demo' | 'live')

set search_path = public;

-- ─────────────────────────────────────────────────────────────────────
-- _fn_response_meta(basis_label) — 모든 RPC가 호출하는 메타 헬퍼
-- ─────────────────────────────────────────────────────────────────────
create or replace function _fn_response_meta(p_basis text default '뉴스 언급량 기준')
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'basis_label', p_basis,
    'as_of', coalesce(
      (select finished_at from update_logs
        where job_id = 'J4' and status = 'success'
        order by finished_at desc limit 1),
      now()
    ),
    'data_mode', case
      when (select value::text from system_settings where key = 'demo_mode') = 'true'
        then 'demo'
      else 'live'
    end
  );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- _fn_politician_card(politician_id, date) — PoliticianCardDTO JSONB 빌드
-- ─────────────────────────────────────────────────────────────────────
create or replace function _fn_politician_card(p_politician_id uuid, p_date date)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'person_type', p.person_type,
    'party_name', (
      select pa.name
      from politician_positions pp
      left join parties pa on pa.id = pp.party_id
      where pp.politician_id = p.id and pp.end_date is null
      order by pp.start_date desc
      limit 1
    ),
    'affiliation', (
      select coalesce(af.outlet_name, af.channel_name)
      from politician_affiliations af
      where af.politician_id = p.id and (af.end_date is null or af.end_date >= current_date)
      order by af.start_date desc nulls last
      limit 1
    ),
    'position_label', coalesce(
      (select pp.position_label
        from politician_positions pp
        where pp.politician_id = p.id and pp.end_date is null
        order by pp.start_date desc limit 1),
      ''
    ),
    'region', (
      select pp.district
      from politician_positions pp
      where pp.politician_id = p.id and pp.end_date is null
      order by pp.start_date desc limit 1
    ),
    'mention_count', coalesce(dm.mention_count, 0),
    'mention_change', coalesce(vpm.day_change_pct, vpm.week_change_pct, 0),
    'keywords', to_jsonb(p.current_keywords),
    'themes', to_jsonb(p.current_themes)
  )
  from politicians p
  left join daily_metrics dm on dm.politician_id = p.id and dm.date = p_date
  left join v_politician_metrics vpm on vpm.politician_id = p.id and vpm.date = p_date
  where p.id = p_politician_id;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- get_last_update_status()
-- ─────────────────────────────────────────────────────────────────────
create or replace function get_last_update_status()
returns jsonb
language sql
stable
as $$
  with last_j4 as (
    select finished_at, job_id
    from update_logs
    where job_id = 'J4' and status = 'success'
    order by finished_at desc limit 1
  )
  select (_fn_response_meta()) ||
    jsonb_build_object(
      'last_success_at', (select finished_at from last_j4),
      'job_id', (select job_id from last_j4),
      'age_label', case
        when (select finished_at from last_j4) is null then '데이터 없음'
        else to_char((select finished_at from last_j4) at time zone 'Asia/Seoul', 'YYYY.MM.DD HH24:MI')
      end
    );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- get_home_feed()
-- ─────────────────────────────────────────────────────────────────────
create or replace function get_home_feed()
returns jsonb
language plpgsql
stable
as $$
declare
  v_date date := current_date;
  v_meta jsonb := _fn_response_meta();
  v_summary jsonb;
  v_surge jsonb;
  v_top jsonb;
  v_themes jsonb;
  v_influence jsonb;
  v_watch jsonb;
begin
  -- summary
  select jsonb_build_object(
    'date', v_date,
    'total_articles', coalesce(sum(dm.mention_count), 0),
    'total_change', 0,  -- 전일 합 대비. 필요 시 별도 view로 계산
    'active_themes', (select count(*) from daily_theme_metrics where date = v_date and mention_count > 0),
    'headline', '뉴스 언급량 기준 집계'
  ) into v_summary
  from daily_metrics dm where dm.date = v_date;

  -- surge_politicians: 선출직(영향력 인물 제외) 변화율 상위 5
  select coalesce(jsonb_agg(card order by chg desc), '[]'::jsonb)
    into v_surge
  from (
    select _fn_politician_card(p.id, v_date) as card,
           coalesce(vpm.day_change_pct, vpm.week_change_pct, 0) as chg
    from politicians p
    join v_politician_metrics vpm on vpm.politician_id = p.id and vpm.date = v_date
    where p.is_active = true
      and p.person_type not in (
        'political_commentator', 'political_youtuber',
        'political_platform_operator', 'political_influencer'
      )
    order by chg desc nulls last
    limit 5
  ) t;

  -- top_mentioned: 선출직 언급량 상위 5
  select coalesce(jsonb_agg(card order by cnt desc), '[]'::jsonb)
    into v_top
  from (
    select _fn_politician_card(p.id, v_date) as card,
           coalesce(dm.mention_count, 0) as cnt
    from politicians p
    left join daily_metrics dm on dm.politician_id = p.id and dm.date = v_date
    where p.is_active = true
      and p.person_type not in (
        'political_commentator', 'political_youtuber',
        'political_platform_operator', 'political_influencer'
      )
    order by cnt desc nulls last
    limit 5
  ) t;

  -- theme_surge: 테마 변화율 상위
  select coalesce(jsonb_agg(item order by chg desc), '[]'::jsonb)
    into v_themes
  from (
    select jsonb_build_object(
      'id', t.id,
      'name', t.name_ko,
      'mention_count', coalesce(dtm.mention_count, 0),
      'mention_change', coalesce(
        case when prev.mention_count > 0
          then round(((dtm.mention_count - prev.mention_count)::numeric / prev.mention_count) * 100, 1)
          else 0
        end,
        0
      )
    ) as item,
    coalesce(
      case when prev.mention_count > 0
        then ((dtm.mention_count - prev.mention_count)::numeric / prev.mention_count) * 100
        else 0
      end, 0
    ) as chg
    from themes t
    left join daily_theme_metrics dtm on dtm.theme_id = t.id and dtm.date = v_date
    left join daily_theme_metrics prev on prev.theme_id = t.id and prev.date = v_date - 1
    where t.is_active = true
    order by chg desc
    limit 8
  ) tt;

  -- influence_flow: 영향력 인물 변화율 정렬
  select coalesce(jsonb_agg(card order by chg desc), '[]'::jsonb)
    into v_influence
  from (
    select _fn_politician_card(p.id, v_date) as card,
           coalesce(vpm.day_change_pct, vpm.week_change_pct, 0) as chg
    from politicians p
    left join v_politician_metrics vpm on vpm.politician_id = p.id and vpm.date = v_date
    where p.is_active = true
      and p.person_type in (
        'political_commentator', 'political_youtuber',
        'political_platform_operator', 'political_influencer'
      )
  ) t;

  -- watchlist: 현재는 선출직 임의 상위 3 (추후 사용자 설정으로 대체)
  select coalesce(jsonb_agg(card), '[]'::jsonb)
    into v_watch
  from (
    select _fn_politician_card(p.id, v_date) as card
    from politicians p
    where p.is_active = true
      and p.person_type = 'elected_official'
    order by p.name
    limit 3
  ) t;

  return v_meta || jsonb_build_object(
    'summary', v_summary,
    'surge_politicians', v_surge,
    'top_mentioned', v_top,
    'theme_surge', v_themes,
    'influence_flow', v_influence,
    'watchlist', v_watch
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- get_politician_detail(politician_id)
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
begin
  if not exists (select 1 from politicians where id = p_politician_id) then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'person_type', p.person_type,
    'party_name', (
      select pa.name from politician_positions pp
      left join parties pa on pa.id = pp.party_id
      where pp.politician_id = p.id and pp.end_date is null
      limit 1
    ),
    'affiliation', (
      select coalesce(af.outlet_name, af.channel_name)
      from politician_affiliations af
      where af.politician_id = p.id and (af.end_date is null or af.end_date >= current_date)
      limit 1
    ),
    'position_label', coalesce(
      (select position_label from politician_positions pp
        where pp.politician_id = p.id and pp.end_date is null limit 1),
      ''
    ),
    'region', (
      select district from politician_positions pp
      where pp.politician_id = p.id and pp.end_date is null limit 1
    )
  ) into v_profile
  from politicians p where p.id = p_politician_id;

  -- flow_14d
  select coalesce(jsonb_agg(jsonb_build_object('date', d.date, 'value', d.mention_count) order by d.date), '[]'::jsonb)
    into v_flow
  from daily_metrics d
  where d.politician_id = p_politician_id
    and d.date >= v_date - 13
    and d.date <= v_date;

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

  -- related_articles (최근 20)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', na.id,
      'title', na.title,
      'source', na.source,
      'published_at', na.published_at,
      'url', na.url,
      'ai_summary_flag', na.ai_summary_flag
    ) order by na.published_at desc
  ), '[]'::jsonb) into v_articles
  from article_mentions am
  join news_articles na on na.id = am.article_id
  where am.politician_id = p_politician_id
    and am.confidence >= 0.85   -- 자동 확정만 노출
  limit 20;

  return v_meta || jsonb_build_object(
    'profile', v_profile,
    'metrics', v_metrics,
    'keywords', (select to_jsonb(current_keywords) from politicians where id = p_politician_id),
    'themes',   (select to_jsonb(current_themes)   from politicians where id = p_politician_id),
    'related_articles', v_articles
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- search_politicians(query, filter)
--   filter: 'all' | PersonType slug
-- ─────────────────────────────────────────────────────────────────────
create or replace function search_politicians(p_query text, p_filter text default 'all')
returns jsonb
language plpgsql
stable
as $$
declare
  v_date date := current_date;
  v_meta jsonb := _fn_response_meta();
  v_q text := trim(coalesce(p_query, ''));
  v_q_norm text := normalize_name(coalesce(p_query, ''));
  v_results jsonb;
  v_total int;
begin
  with matched as (
    select p.id
    from politicians p
    where p.is_active = true
      and (p_filter = 'all' or p.person_type = p_filter)
      and (
        v_q = '' or
        p.name_normalized like '%' || v_q_norm || '%' or
        exists (
          select 1 from jsonb_array_elements_text(p.aliases) as a
          where normalize_name(a) like '%' || v_q_norm || '%'
        ) or
        exists (
          select 1 from politician_positions pp
          left join parties pa on pa.id = pp.party_id
          where pp.politician_id = p.id and pp.end_date is null
            and (
              pp.district ilike '%' || v_q || '%' or
              pa.name ilike '%' || v_q || '%'
            )
        ) or
        exists (
          select 1 from politician_affiliations af
          where af.politician_id = p.id
            and (af.outlet_name ilike '%' || v_q || '%' or af.channel_name ilike '%' || v_q || '%')
        ) or
        exists (
          select 1 from unnest(p.current_keywords) as kw
          where kw ilike '%' || v_q || '%'
        )
      )
  )
  select
    coalesce(jsonb_agg(_fn_politician_card(m.id, v_date)), '[]'::jsonb),
    count(*)
    into v_results, v_total
  from matched m;

  return v_meta || jsonb_build_object(
    'results', v_results,
    'total', v_total
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- get_rankings(ranking_type, scope)
-- 최근 스냅샷 단건 반환. compute_*는 0005에서 정의.
-- ─────────────────────────────────────────────────────────────────────
create or replace function get_rankings(p_ranking_type text, p_scope text default 'all')
returns jsonb
language plpgsql
stable
as $$
declare
  v_date date := current_date;
  v_meta jsonb := _fn_response_meta();
  v_ranking_id uuid;
  v_basis text;
  v_entries jsonb;
begin
  select id, basis_label
    into v_ranking_id, v_basis
  from rankings
  where ranking_type = p_ranking_type and scope = p_scope
  order by computed_at desc limit 1;

  if v_ranking_id is null then
    return v_meta || jsonb_build_object(
      'ranking_type', p_ranking_type,
      'scope', p_scope,
      'entries', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rank', re.rank,
      'politician', case when re.politician_id is not null
        then _fn_politician_card(re.politician_id, v_date) else null end,
      'theme', case when re.theme_id is not null
        then (select jsonb_build_object(
          'id', t.id, 'name', t.name_ko,
          'mention_count', coalesce(dtm.mention_count, 0),
          'mention_change', re.metric_change
        )
        from themes t
        left join daily_theme_metrics dtm on dtm.theme_id = t.id and dtm.date = v_date
        where t.id = re.theme_id)
        else null end,
      'metric_value', re.metric_value,
      'metric_change', re.metric_change
    ) order by re.rank
  ), '[]'::jsonb) into v_entries
  from ranking_entries re
  where re.ranking_id = v_ranking_id;

  return v_meta || jsonb_build_object(
    'ranking_type', p_ranking_type,
    'scope', p_scope,
    'entries', v_entries
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- get_article_mentions(politician_id, limit)
-- ─────────────────────────────────────────────────────────────────────
create or replace function get_article_mentions(p_politician_id uuid, p_limit int default 20)
returns jsonb
language plpgsql
stable
as $$
declare
  v_meta jsonb := _fn_response_meta();
  v_articles jsonb;
  v_total int;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', na.id,
      'title', na.title,
      'source', na.source,
      'published_at', na.published_at,
      'url', na.url,
      'ai_summary_flag', na.ai_summary_flag
    ) order by na.published_at desc
  ) filter (where rn <= p_limit), '[]'::jsonb),
  count(*)
    into v_articles, v_total
  from (
    select na.*,
      row_number() over (order by na.published_at desc) as rn
    from article_mentions am
    join news_articles na on na.id = am.article_id
    where am.politician_id = p_politician_id
      and am.confidence >= 0.85
  ) na;

  return v_meta || jsonb_build_object(
    'politician_id', p_politician_id,
    'articles', v_articles,
    'total', v_total
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- RLS — anon은 RPC만 호출 가능, 직접 SELECT는 차단 (필요시 후속 마이그레이션에서 설정)
-- ─────────────────────────────────────────────────────────────────────
grant execute on function get_last_update_status()             to anon, authenticated;
grant execute on function get_home_feed()                       to anon, authenticated;
grant execute on function get_politician_detail(uuid)           to anon, authenticated;
grant execute on function search_politicians(text, text)        to anon, authenticated;
grant execute on function get_rankings(text, text)              to anon, authenticated;
grant execute on function get_article_mentions(uuid, int)       to anon, authenticated;
