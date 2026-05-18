-- KPOL 스키마 확장
-- 0001_initial.sql 적용 후 실행한다.
--
-- 주요 변경:
--   1. news_articles.extracted_keywords — 빅카인즈 LAB 키워드 추출 결과 저장
--   2. politicians.current_keywords / current_themes — J4가 갱신하는 카드용 사전 계산 필드
--   3. normalize_name() / normalize_url() — 매핑·dedupe용 immutable helper
--   4. match_politicians_by_name() — 추출된 이름으로 후보 정치인 조회
--   5. v_politician_metrics — v_politician_change에 변화율 % 컬럼 추가

-- ─────────────────────────────────────────────────────────────────────
-- 컬럼 추가
-- ─────────────────────────────────────────────────────────────────────
alter table news_articles
  add column if not exists extracted_keywords text[] not null default '{}';

create index if not exists na_keywords_gin on news_articles using gin (extracted_keywords);

alter table politicians
  add column if not exists current_keywords text[] not null default '{}';

alter table politicians
  add column if not exists current_themes text[] not null default '{}';

-- ─────────────────────────────────────────────────────────────────────
-- normalize_name(name)
-- 공백/구두점 제거, 소문자화. 한글은 그대로 유지(영문/특수문자 매칭용).
-- 매핑·검색용 immutable 함수.
-- ─────────────────────────────────────────────────────────────────────
create or replace function normalize_name(p_name text)
returns text
language sql
immutable
as $$
  select case
    when p_name is null then null
    else lower(regexp_replace(p_name, '\s+|[·.,()\-_/]', '', 'g'))
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- normalize_url(url)
-- 스킴/www/쿼리 트래킹 파라미터/끝 슬래시 제거. dedupe 키.
-- ─────────────────────────────────────────────────────────────────────
create or replace function normalize_url(p_url text)
returns text
language sql
immutable
as $$
  select case
    when p_url is null then null
    else
      regexp_replace(
        regexp_replace(
          lower(p_url),
          '^https?://(www\.)?', '', 'g'
        ),
        '(#.*$)|(\?utm_[^&]*(&|$))|(/$)', '', 'g'
      )
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- match_politicians_by_name(name)
-- 추출된 이름 1건에 대해 가능한 정치인 후보를 confidence와 함께 반환.
-- 동명이인 보정은 호출자(매핑 엔진)가 article context로 처리한다.
-- ─────────────────────────────────────────────────────────────────────
create or replace function match_politicians_by_name(p_name text)
returns table (
  politician_id uuid,
  match_type text,
  base_confidence numeric
)
language sql
stable
as $$
  with norm as (select normalize_name(p_name) as n)
  -- 정식 이름 일치
  select p.id, 'name'::text, 1.00::numeric
  from politicians p, norm
  where p.is_active = true
    and p.name_normalized = norm.n
  union all
  -- 별칭(aliases) 일치 — 정식 이름과 중복되지 않을 때만
  select p.id, 'alias'::text, 0.85::numeric
  from politicians p, norm,
    lateral jsonb_array_elements_text(p.aliases) as a(alias_name)
  where p.is_active = true
    and normalize_name(a.alias_name) = norm.n
    and p.name_normalized <> norm.n;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- v_politician_metrics
-- v_politician_change에 일변화율 / 7일평균 대비 변화율 컬럼 추가.
-- ─────────────────────────────────────────────────────────────────────
create or replace view v_politician_metrics as
select
  politician_id,
  date,
  mention_count,
  prev_day_count,
  week_avg_count,
  case
    when coalesce(prev_day_count, 0) = 0 then null
    else round(((mention_count - prev_day_count)::numeric / prev_day_count) * 100, 1)
  end as day_change_pct,
  case
    when coalesce(week_avg_count, 0) = 0 then null
    else round(((mention_count - week_avg_count)::numeric / week_avg_count) * 100, 1)
  end as week_change_pct
from v_politician_change;

-- ─────────────────────────────────────────────────────────────────────
-- politicians.name_normalized 자동 갱신 트리거
-- ─────────────────────────────────────────────────────────────────────
create or replace function set_politician_name_normalized()
returns trigger
language plpgsql
as $$
begin
  new.name_normalized := normalize_name(new.name);
  return new;
end;
$$;

drop trigger if exists trg_politicians_name_norm on politicians;
create trigger trg_politicians_name_norm
  before insert or update of name on politicians
  for each row execute function set_politician_name_normalized();

-- ─────────────────────────────────────────────────────────────────────
-- news_articles.url_normalized 자동 갱신 트리거
-- ─────────────────────────────────────────────────────────────────────
create or replace function set_article_url_normalized()
returns trigger
language plpgsql
as $$
begin
  new.url_normalized := normalize_url(new.url);
  return new;
end;
$$;

drop trigger if exists trg_articles_url_norm on news_articles;
create trigger trg_articles_url_norm
  before insert or update of url on news_articles
  for each row execute function set_article_url_normalized();

comment on column news_articles.extracted_keywords is '빅카인즈 LAB get_keyword / 자체 추출 결과. 정치인 카드 표시 keywords는 여기서 집계.';
comment on column politicians.current_keywords is 'J4가 갱신하는 최근 N일 상위 키워드. 카드용 사전 계산.';
comment on column politicians.current_themes is 'J4가 갱신하는 최근 N일 상위 테마. 카드용 사전 계산.';
comment on function match_politicians_by_name(text) is '추출 이름으로 후보 정치인 조회. 동명이인 보정은 호출자가 article context로 처리.';
