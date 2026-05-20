-- 0016_program_title_filter.sql
-- 채널 공유 한계 해소 — 한 채널의 여러 프로그램을 영상 제목 기반으로 분리.
--
-- 예: MBC 라디오 시사 채널 (UCTTmtS2ljy1vyl_s-d_LEHQ) 은
--   시선집중 · 뉴스하이킥 · 정치人싸 영상을 모두 업로드함.
-- 각 프로그램에 youtube_title_filter 를 두면
--   snapshot 루틴이 video.title 에 해당 키워드가 포함된 것만 집계.
--
-- 정책:
--   - nullable. null 이면 채널의 모든 영상이 해당 프로그램에 귀속 (기존 동작 유지).
--   - 검색 알고리즘: case-insensitive 부분 일치 (substring).
--   - regex 미지원 1차 — 단순 keyword. 추후 필요시 별도 필드로 확장.

alter table public.media_programs
  add column if not exists youtube_title_filter text;

comment on column public.media_programs.youtube_title_filter is
  'Optional: keyword (case-insensitive substring) to filter the youtube_channel_id''s uploads to videos belonging only to this program. null = no filter (all videos counted).';
