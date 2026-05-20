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
 * 단일 지표: previous_day_view_count = 채널 최근 14일 영상의 (today_snapshot - yesterday_snapshot) 합.
 * 다른 지표 혼합 ✗ (kpol-data-ingest-safety 정정 지시).
 *
 * 흐름:
 *   1. media_programs 활성 + youtube_channel_id 있는 행 로드
 *   2. 채널별 unique 그룹 → playlistItems.list 로 최근 14일 영상 추출
 *   3. videos.list 로 영상 통계 (viewCount/likeCount/commentCount)
 *   4. youtube_video_daily_snapshots upsert (snapshot_date=today, video_id+date unique)
 *   5. 어제 snapshot 조회 → 영상별 delta = today.view - yesterday.view
 *   6. 프로그램별 previous_day_view_count = sum(delta over 14d videos of program's channel)
 *   7. 프로그램 어제 ranking → rank_delta = yesterday_rank - today_rank
 *   8. media_program_daily_rankings upsert
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
const FORMULA_VERSION = "media_programs_v1_prev_day_views";

interface ProgramRow {
  id: string;
  title: string;
  youtube_channel_id: string;
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
    .select("id, title, youtube_channel_id, active_status")
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

  // 5) 어제 snapshot 조회 (channel_id 별 video_id → view_count map)
  const { data: ydayRowsRaw } = await supabase
    .from("youtube_video_daily_snapshots")
    .select("video_id, channel_id, cumulative_view_count")
    .eq("snapshot_date", yesterdayDate)
    .in("channel_id", uniqueChannelIds);
  const ydayMap = new Map<string, number>(); // video_id → yesterday cumulative
  for (const r of (ydayRowsRaw ?? []) as {
    video_id: string;
    cumulative_view_count: number | null;
  }[]) {
    if (r.cumulative_view_count != null) {
      ydayMap.set(r.video_id, r.cumulative_view_count);
    }
  }

  // 6) 오늘 snapshot map (실제 메모리 데이터 사용)
  const todayMap = new Map<string, number>(); // video_id → today cumulative
  const videosByChannel = new Map<string, VideoSnapshotRow[]>();
  for (const v of videoSnapshotRows) {
    if (v.cumulative_view_count != null) {
      todayMap.set(v.video_id, v.cumulative_view_count);
    }
    const arr = videosByChannel.get(v.channel_id) ?? [];
    arr.push(v);
    videosByChannel.set(v.channel_id, arr);
  }

  // 7) 프로그램별 previous_day_view_count 계산
  interface ComputedProgramRow {
    program_id: string;
    title: string;
    channel_id: string;
    previous_day_view_count: number | null; // null = 어제 snapshot 부재 또는 영상 0
    recent_video_count: number;
    has_yesterday_baseline: boolean;
  }
  const computed: ComputedProgramRow[] = programs.map((p) => {
    const vids = videosByChannel.get(p.youtube_channel_id) ?? [];
    let sumDelta = 0;
    let hasYesterday = false;
    for (const v of vids) {
      const today = todayMap.get(v.video_id);
      const yesterday = ydayMap.get(v.video_id);
      if (today == null) continue;
      if (yesterday != null) {
        const delta = Math.max(0, today - yesterday); // 음수 방지 (view count 감소는 비정상)
        sumDelta += delta;
        hasYesterday = true;
      }
    }
    return {
      program_id: p.id,
      title: p.title,
      channel_id: p.youtube_channel_id,
      previous_day_view_count: hasYesterday ? sumDelta : null,
      recent_video_count: vids.length,
      has_yesterday_baseline: hasYesterday,
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
      ({ _title, ...rest }) => rest,
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
