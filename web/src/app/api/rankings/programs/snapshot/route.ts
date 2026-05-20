import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkAdminAuth } from "@/lib/admin-auth";
import {
  fetchChannelRecentUploads,
  fetchVideosStatsChunked,
} from "@/lib/sources/youtube";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * KPOL 미디어 프로그램 일일 랭킹 snapshot.
 *
 * 단일 지표 (v2 — 24h 업로드 영상 기준):
 *   previous_day_view_count = 채널의 최근 24h 내 업로드된 영상의 cumulative_view_count 합
 *   recent_video_count       = 그 24h 영상의 갯수
 *   ※ "previous_day_view_count" 컬럼명은 호환 유지 — UI 라벨은 "최근 24시간 총조회수"
 *
 * 흐름:
 *   1. media_programs 활성 + youtube_channel_id 있는 행 로드
 *   2. 채널별 unique 그룹 → playlistItems.list 로 최근 14일 영상 추출
 *      (14d 윈도우로 가져오되 24h 필터는 metric 계산 단계에서 적용 — 저장은 14d 유지)
 *   3. videos.list 로 영상 통계 (viewCount/likeCount/commentCount)
 *   4. youtube_video_daily_snapshots upsert (snapshot_date=today, video_id+date unique)
 *   5. 프로그램별 24h 영상 필터 → cumulative_view_count 합
 *   6. 프로그램 어제 ranking → rank_delta = yesterday_rank - today_rank
 *   7. media_program_daily_rankings upsert
 *
 * Mode:
 *   preview : 계산 결과만 반환, DB 쓰기 0
 *   apply   : upsert 실행 (service_role 필요)
 *
 * Cron:
 *   vercel.json 에 매일 14:00 KST = 05:00 UTC 트리거 등록.
 *
 * 한계 (1차):
 *   - 같은 youtube_channel_id 공유 프로그램은 동일 score (channel-wide 영상 모음).
 *   - 향후 program.youtube_title_filter 도입 시 영상-프로그램 매칭 분리.
 */

type Mode = "preview" | "apply";
const RECENT_WINDOW_DAYS = 14;
const FORMULA_VERSION = "media_programs_v2_24h_uploads_view_sum";

interface ProgramRow {
  id: string;
  title: string;
  youtube_channel_id: string;
  /** null 이면 채널 전체 영상이 이 프로그램에 귀속. 값 있으면 title 부분 일치 필터. */
  youtube_title_filter: string | null;
}

interface VideoSnapshotRow {
  video_id: string;
  channel_id: string;
  snapshot_date: string;
  cumulative_view_count: number | null;
  cumulative_like_count: number | null;
  cumulative_comment_count: number | null;
  published_at: string | null;
  title: string | null;
  raw_payload?: unknown;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srk) return null;
  return createClient(url, srk, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** YYYY-MM-DD KST 기준 (UTC+9). UTC 시각을 KST 일자로 변환. */
function ymdKst(d: Date): string {
  const kstMs = d.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ymdDaysAgo(baseYmd: string, days: number): string {
  const [y, m, d] = baseYmd.split("-").map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const auth = checkAdminAuth(req, url);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY not set" },
      { status: 500 },
    );
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase env not set" },
      { status: 500 },
    );
  }

  const modeParam = (url.searchParams.get("mode") ?? "preview").toLowerCase();
  if (modeParam !== "preview" && modeParam !== "apply") {
    return NextResponse.json(
      { error: `mode must be 'preview' or 'apply' (got: ${modeParam})` },
      { status: 400 },
    );
  }
  const mode: Mode = modeParam;

  const startedAt = Date.now();
  const dateParam = url.searchParams.get("date")?.trim();
  const snapshotDate = dateParam || ymdKst(new Date());
  const yesterdayDate = ymdDaysAgo(snapshotDate, 1);

  // 1) 프로그램 로드 (활성 + youtube_channel_id 있는 것만)
  const { data: progRows, error: progErr } = await supabase
    .from("media_programs")
    .select(
      "id, title, youtube_channel_id, youtube_title_filter, active_status",
    )
    .eq("active_status", "active")
    .not("youtube_channel_id", "is", null);
  if (progErr) {
    return NextResponse.json(
      { error: `media_programs select 실패: ${progErr.message}` },
      { status: 500 },
    );
  }
  const programs = (progRows ?? []) as ProgramRow[];
  if (programs.length === 0) {
    return NextResponse.json({
      mode,
      snapshotDate,
      yesterdayDate,
      programs: 0,
      note: "youtube_channel_id 가 있는 활성 프로그램이 없습니다.",
      durationMs: Date.now() - startedAt,
    });
  }

  // 2) 채널 unique 그룹
  const uniqueChannelIds = Array.from(
    new Set(programs.map((p) => p.youtube_channel_id).filter(Boolean)),
  );

  // 3) 채널별 최근 14d 영상 + videos.list 통계
  const videoSnapshotRows: VideoSnapshotRow[] = [];
  const channelErrors: { channelId: string; error: string }[] = [];
  let quotaSpent = 0;

  for (const channelId of uniqueChannelIds) {
    try {
      const uploads = await fetchChannelRecentUploads({
        channelId,
        sinceDays: RECENT_WINDOW_DAYS,
      });
      quotaSpent += 1; // playlistItems = 1 unit
      if (uploads.videos.length === 0) continue;

      const videoIds = uploads.videos.map((v) => v.videoId);
      const stats = await fetchVideosStatsChunked(videoIds);
      quotaSpent += Math.ceil(videoIds.length / 50);

      const titleByVideoId = new Map(uploads.videos.map((v) => [v.videoId, v.title]));
      const publishedByVideoId = new Map(
        uploads.videos.map((v) => [v.videoId, v.publishedAt]),
      );

      for (const s of stats.items) {
        videoSnapshotRows.push({
          video_id: s.videoId,
          channel_id: channelId,
          snapshot_date: snapshotDate,
          cumulative_view_count: s.viewCount,
          cumulative_like_count: s.likeCount,
          cumulative_comment_count: s.commentCount,
          published_at:
            s.publishedAt ?? publishedByVideoId.get(s.videoId) ?? null,
          title: s.title ?? titleByVideoId.get(s.videoId) ?? null,
          raw_payload: s.raw,
        });
      }
    } catch (e) {
      channelErrors.push({
        channelId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 4) snapshot upsert (apply)
  let videosUpserted = 0;
  if (mode === "apply" && videoSnapshotRows.length > 0) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          mode,
          snapshotDate,
          error: "SUPABASE_SERVICE_ROLE_KEY 없음 — apply 차단.",
          hint: "preview 모드는 service_role 없이도 동작.",
        },
        { status: 503 },
      );
    }
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "admin client 생성 실패" },
        { status: 500 },
      );
    }
    // chunk insert (PostgREST 한 번에 많은 row OK 지만 안전망)
    const chunkSize = 500;
    for (let i = 0; i < videoSnapshotRows.length; i += chunkSize) {
      const chunk = videoSnapshotRows.slice(i, i + chunkSize);
      const { error } = await admin
        .from("youtube_video_daily_snapshots")
        .upsert(chunk, { onConflict: "video_id,snapshot_date" });
      if (error) {
        return NextResponse.json(
          {
            mode,
            snapshotDate,
            error: `video snapshot upsert 실패: ${error.message}`,
            videosUpserted,
          },
          { status: 500 },
        );
      }
      videosUpserted += chunk.length;
    }
  }

  // 5) 채널별 video grouping (in-memory)
  const videosByChannel = new Map<string, VideoSnapshotRow[]>();
  for (const v of videoSnapshotRows) {
    const arr = videosByChannel.get(v.channel_id) ?? [];
    arr.push(v);
    videosByChannel.set(v.channel_id, arr);
  }

  // 6) 프로그램별 metric 계산
  //    "최근 24시간 총조회수" = 최근 24h 내 업로드된 영상의 cumulative_view_count 합.
  //    "recent_video_count"   = 그 24h 영상의 갯수.
  //
  //    채널 공유 한계 해소 — youtube_title_filter 있으면 영상 제목에
  //    해당 keyword (case-insensitive 부분 일치) 가 포함된 것만 집계.
  //    예: MBC 라디오 시사 채널에서 "시선집중" filter → "[시선집중]" 태그 영상만.
  const cutoff24hMs = Date.now() - 24 * 60 * 60 * 1000;
  interface ComputedProgramRow {
    program_id: string;
    title: string;
    channel_id: string;
    title_filter: string | null;
    previous_day_view_count: number | null; // null = 24h 내 영상 없음 또는 데이터 부족
    recent_video_count: number;
  }
  const computed: ComputedProgramRow[] = programs.map((p) => {
    const vids = videosByChannel.get(p.youtube_channel_id) ?? [];
    const filterLc = p.youtube_title_filter
      ? p.youtube_title_filter.toLowerCase()
      : null;
    let sum24h = 0;
    let count24h = 0;
    for (const v of vids) {
      if (!v.published_at) continue;
      const pubMs = Date.parse(v.published_at);
      if (!Number.isFinite(pubMs) || pubMs < cutoff24hMs) continue;
      // title filter 적용 — null 이면 모든 영상 통과
      if (filterLc) {
        const titleLc = (v.title ?? "").toLowerCase();
        if (!titleLc.includes(filterLc)) continue;
      }
      const viewCount = v.cumulative_view_count;
      if (viewCount == null || !Number.isFinite(viewCount)) continue;
      sum24h += Math.max(0, viewCount);
      count24h += 1;
    }
    return {
      program_id: p.id,
      title: p.title,
      channel_id: p.youtube_channel_id,
      title_filter: p.youtube_title_filter ?? null,
      previous_day_view_count: count24h > 0 ? sum24h : null,
      recent_video_count: count24h,
    };
  });

  // 8) 어제 ranking 로드 → rank_delta 계산
  const { data: ydayRankRowsRaw } = await supabase
    .from("media_program_daily_rankings")
    .select("program_id, rank")
    .eq("snapshot_date", yesterdayDate);
  const ydayRankMap = new Map<string, number>();
  for (const r of (ydayRankRowsRaw ?? []) as {
    program_id: string;
    rank: number | null;
  }[]) {
    if (r.rank != null) ydayRankMap.set(r.program_id, r.rank);
  }

  // 9) rank 부여 (previous_day_view_count desc NULLS LAST)
  const sorted = [...computed].sort((a, b) => {
    const av = a.previous_day_view_count ?? -1;
    const bv = b.previous_day_view_count ?? -1;
    if (av === bv) return a.title.localeCompare(b.title, "ko");
    return bv - av;
  });
  const programRankingRows = sorted.map((c, i) => {
    const rank = c.previous_day_view_count != null ? i + 1 : null;
    const prevRank = ydayRankMap.get(c.program_id) ?? null;
    const rank_delta =
      rank != null && prevRank != null ? prevRank - rank : null;
    return {
      program_id: c.program_id,
      snapshot_date: snapshotDate,
      previous_day_view_count: c.previous_day_view_count,
      rank,
      rank_delta,
      recent_video_count: c.recent_video_count,
      recent_window_days: RECENT_WINDOW_DAYS,
      formula_version: FORMULA_VERSION,
      // 응답 표시용 메타 — DB 컬럼 아님 (apply 시 제외)
      _title: c.title,
      _titleFilter: c.title_filter,
    };
  });

  // 10) ranking upsert (apply)
  let rankingsUpserted = 0;
  if (mode === "apply" && programRankingRows.length > 0) {
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "admin client 생성 실패" },
        { status: 500 },
      );
    }
    const dbRows = programRankingRows.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ _title, _titleFilter, ...rest }) => rest,
    );
    const { error } = await admin
      .from("media_program_daily_rankings")
      .upsert(dbRows, { onConflict: "program_id,snapshot_date" });
    if (error) {
      return NextResponse.json(
        {
          mode,
          snapshotDate,
          error: `ranking upsert 실패: ${error.message}`,
          videosUpserted,
        },
        { status: 500 },
      );
    }
    rankingsUpserted = dbRows.length;
  }

  return NextResponse.json({
    mode,
    snapshotDate,
    yesterdayDate,
    formulaVersion: FORMULA_VERSION,
    recentWindowDays: RECENT_WINDOW_DAYS,
    durationMs: Date.now() - startedAt,
    counts: {
      programs: programs.length,
      uniqueChannels: uniqueChannelIds.length,
      videosFetched: videoSnapshotRows.length,
      videosUpserted,
      rankingsUpserted,
    },
    quotaSpent,
    channelErrors,
    rankings: programRankingRows.map((r) => ({
      rank: r.rank,
      title: r._title,
      title_filter: r._titleFilter,
      program_id: r.program_id,
      previous_day_view_count: r.previous_day_view_count,
      rank_delta: r.rank_delta,
      recent_video_count: r.recent_video_count,
    })),
    authSource: auth.source,
  });
}

export const GET = handle;
export const POST = handle;
