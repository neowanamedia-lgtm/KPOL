-- 0012_seed_rankings.sql
-- KPOL ranking 테이블에 사용자가 제공한 실제 데이터를 1차 입력하기 위한 마이그레이션.
--
-- 구성:
--   1) name unique 제약 추가 (재실행 시 ON CONFLICT 동작용)
--   2) INSERT ... ON CONFLICT (name) DO UPDATE 템플릿
--      → VALUES 부분은 사용자가 직접 채워 실행
--
-- 정책:
--   - rank는 변동값 → unique 키로 쓰지 않음
--   - name이 식별 키 (동명이인은 description 또는 category로 구분)
--   - AI는 실명/score/description을 생성하지 않음. 사용자 제공 데이터만 입력.

------------------------------------------------------------------
-- 1) name unique 제약 추가 (DROP 후 ADD — 재실행 안전)
------------------------------------------------------------------
alter table public.people_rankings
  drop constraint if exists people_rankings_name_unique;
alter table public.people_rankings
  add constraint people_rankings_name_unique unique (name);

alter table public.media_rankings
  drop constraint if exists media_rankings_name_unique;
alter table public.media_rankings
  add constraint media_rankings_name_unique unique (name);

------------------------------------------------------------------
-- 2) people_rankings INSERT 템플릿
--    사용자가 VALUES (...) 절을 직접 채운 뒤 실행할 것.
--    데이터가 없으면 이 INSERT 블록은 통째로 주석 처리 또는 삭제.
------------------------------------------------------------------
-- insert into public.people_rankings
--   (rank, name, category, score, description, source_url, is_active)
-- values
--   -- (1, '<이름>', '<카테고리>', <0-100>, '<설명 한 줄>', '<https://...>', true),
--   -- (2, '<이름>', '<카테고리>', <0-100>, '<설명 한 줄>', '<https://...>', true),
--   -- ... 20~30건
-- on conflict (name) do update set
--   rank        = excluded.rank,
--   category    = excluded.category,
--   score       = excluded.score,
--   description = excluded.description,
--   source_url  = excluded.source_url,
--   is_active   = excluded.is_active,
--   updated_at  = now();

------------------------------------------------------------------
-- 3) media_rankings INSERT 템플릿
--    media_type 필수.
--    값: youtube_channel | youtuber | news_media | podcast | online_media | other
------------------------------------------------------------------
-- insert into public.media_rankings
--   (rank, name, media_type, category, score, description, source_url, is_active)
-- values
--   -- (1, '<미디어 이름>', '<media_type>', '<카테고리>', <0-100>, '<설명>', '<https://...>', true),
--   -- (2, '<미디어 이름>', '<media_type>', '<카테고리>', <0-100>, '<설명>', '<https://...>', true),
--   -- ... 20~30건
-- on conflict (name) do update set
--   rank        = excluded.rank,
--   media_type  = excluded.media_type,
--   category    = excluded.category,
--   score       = excluded.score,
--   description = excluded.description,
--   source_url  = excluded.source_url,
--   is_active   = excluded.is_active,
--   updated_at  = now();
