import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkAdminAuth } from "@/lib/admin-auth";
import {
  FORMULA_VERSION,
  WEIGHTS,
  calculateMediaScore,
  extractMetricsFromRawPayload,
  assignRanks,
  describeMediaMetrics,
  type MediaScoreOutput,
} from "@/lib/rankings/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * KPOL media_rankings rebuild — YouTube 채널 한정.
 *
 * 흐름:
 *   media_sources_raw (source='YOUTUBE_API', media_type='youtube_channel')
 *     → dedup by raw_payload.id (최신 fetched_at)
 *     → extractMetricsFromRawPayload + calculateMediaScore (lib/rankings/media.ts)
 *     → assignRanks (desc by score, 1..N)
 *     → 이전 media_rankings snapshot 으로 rank movement 계산
 *     → mode=preview: 결과 반환
 *     → mode=apply : (service_role) media_rankings 안전 교체 + ranking_calculation_logs 적재
 *
 * 안전 교체:
 *   1) 기존 행 id 목록 확보
 *   2) 새 행 insert (이 시점에 잠시 old+new 공존)
 *   3) 기존 행을 id 로 정확 삭제 — insert 실패 시 old 유지 → 데이터 무손실
 *
 * 인증 (둘 다 허용):
 *   - Authorization: Bearer <CRON_SECRET>            ← Vercel Cron 자동 헤더
 *   - Authorization: Bearer <NEXT_PUBLIC_KPOL_ADMIN_KEY>  ← 수동 admin (Bearer)
 *   - ?key=<NEXT_PUBLIC_KPOL_ADMIN_KEY>              ← /data-test UI legacy
 *
 * 정책:
 *   - AI 임의 점수 ✗. formula_version='media_v1' 고정.
 *   - 영상/댓글/자막 수집 ✗.
 *   - 1회 호출 = 1 rebuild. loop ✗.
 *
 * env:
 *   NEXT_PUBLIC_KPOL_ADMIN_KEY            admin 식별 (UI 공유)
 *   CRON_SECRET                           Vercel Cron 전용 (server-only)
 *   NEXT_PUBLIC_SUPABASE_URL              supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY  (apply only)  media_rankings 쓰기 권한
 *
 * 호출:
 *   POST /api/rankings/media/rebuild?mode=preview   (Authorization: Bearer or ?key=)
 *   GET  /api/rankings/media/rebuild?mode=apply     (Vercel Cron 호출)
 */

const TARGET_MEDIA_TYPE = "youtube_channel";

type Mode = "preview" | "apply";

interface RawRow {
  id: string;
  media_name: string | null;
  official_url: string | null;
  youtube_channel_url: string | null;
  raw_payload: unknown;
  fetched_at: string;
}

interface RankedRow extends MediaScoreOutput {
  rank: number;
  scoreNormalized: number;
  sourceRowId: string;
  previousRank: number | null;
  /** previousRank - rank. positive=상승, negative=하락, 0=유지, null=신규 */
  rankChange: number | null;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srk) return null;
  return createClient(url, srk, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function describeChannel(r: RankedRow): string | null {
  return describeMediaMetrics(r.evidence);
}

function dedupByChannel(rows: RawRow[]): {
  kept: { row: RawRow; channelId: string }[];
  duplicatesSkipped: number;
  rowsWithoutChannelId: number;
} {
  const seen = new Map<string, RawRow>();
  let dupes = 0;
  let noId = 0;
  for (const row of rows) {
    const rp = row.raw_payload as Record<string, unknown> | null;
    const channelId =
      rp && (typeof rp.id === "string" || typeof rp.id === "number")
        ? String(rp.id)
        : null;
    if (!channelId) {
      noId++;
      continue;
    }
    if (seen.has(channelId)) {
      dupes++;
      continue;
    }
    seen.set(channelId, row);
  }
  return {
    kept: Array.from(seen.entries()).map(([channelId, row]) => ({
      row,
      channelId,
    })),
    duplicatesSkipped: dupes,
    rowsWithoutChannelId: noId,
  };
}

/** rank movement 계산용 — 직전 media_rankings snapshot 의 name→rank 맵 */
async function loadPrevRankMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data, error } = await supabase
    .from("media_rankings")
    .select("name, rank")
    .eq("media_type", TARGET_MEDIA_TYPE)
    .eq("is_active", true);
  if (error) return map;
  for (const r of (data ?? []) as { name: string; rank: number }[]) {
    if (typeof r.name === "string" && typeof r.rank === "number") {
      map.set(r.name, r.rank);
    }
  }
  return map;
}

async function loadAndScore(): Promise<{
  ranked: RankedRow[];
  rejected: { sourceRowId?: string; reason: string }[];
  stats: {
    rawRowCount: number;
    uniqueChannels: number;
    duplicatesSkipped: number;
    rowsWithoutChannelId: number;
    previousRankedCount: number;
  };
}> {
  const [rawSel, prevMap] = await Promise.all([
    supabase
      .from("media_sources_raw")
      .select(
        "id, media_name, official_url, youtube_channel_url, raw_payload, fetched_at",
      )
      .eq("source", "YOUTUBE_API")
      .eq("media_type", TARGET_MEDIA_TYPE)
      .order("fetched_at", { ascending: false }),
    loadPrevRankMap(),
  ]);

  if (rawSel.error) {
    throw new Error(`media_sources_raw select 실패: ${rawSel.error.message}`);
  }
  const rows = (rawSel.data ?? []) as RawRow[];
  const dedup = dedupByChannel(rows);

  const scored: MediaScoreOutput[] = [];
  const rejected: { sourceRowId?: string; reason: string }[] = [];
  const sourceRowIdByChannel = new Map<string, string>();

  for (const { row, channelId } of dedup.kept) {
    const mediaName = row.media_name ?? "";
    if (!mediaName) {
      rejected.push({
        sourceRowId: row.id,
        reason: `media_name 누락 — channelId=${channelId}`,
      });
      continue;
    }
    const metrics = extractMetricsFromRawPayload(row.raw_payload, {
      mediaName,
      officialUrl: row.official_url,
      youtubeChannelUrl: row.youtube_channel_url,
      fetchedAt: row.fetched_at,
    });
    if ("error" in metrics) {
      rejected.push({ sourceRowId: row.id, reason: metrics.error });
      continue;
    }
    sourceRowIdByChannel.set(channelId, row.id);
    scored.push(calculateMediaScore(metrics));
  }

  const ranked = assignRanks(scored).map<RankedRow>((s) => {
    const previousRank = prevMap.get(s.mediaName) ?? null;
    return {
      ...s,
      sourceRowId: sourceRowIdByChannel.get(s.channelId) ?? "",
      previousRank,
      rankChange: previousRank != null ? previousRank - s.rank : null,
    };
  });

  return {
    ranked,
    rejected,
    stats: {
      rawRowCount: rows.length,
      uniqueChannels: dedup.kept.length,
      duplicatesSkipped: dedup.duplicatesSkipped,
      rowsWithoutChannelId: dedup.rowsWithoutChannelId,
      previousRankedCount: prevMap.size,
    },
  };
}

async function handle(req: Request) {
  const url = new URL(req.url);

  const auth = checkAdminAuth(req, url);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
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

  const serviceRoleAvailable = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();

  try {
    const { ranked, rejected, stats } = await loadAndScore();

    const baseResponse = {
      mode,
      authSource: auth.source,
      formulaVersion: FORMULA_VERSION,
      weights: WEIGHTS,
      stats,
      rejected,
      candidatesCount: ranked.length,
      ranked: ranked.map((r) => ({
        rank: r.rank,
        previousRank: r.previousRank,
        rankChange: r.rankChange,
        scoreNormalized: r.scoreNormalized,
        channelId: r.channelId,
        name: r.mediaName,
        customUrl: r.customUrl,
        officialUrl: r.officialUrl,
        thumbnailUrl: r.thumbnailUrl,
        score: r.score,
        evidence: r.evidence,
      })),
      serviceRoleAvailable,
    };

    if (mode === "preview") {
      return NextResponse.json({
        ...baseResponse,
        durationMs: Date.now() - startedAt,
        note:
          ranked.length === 0
            ? "산정 대상 0건. /data-test 후보 검색으로 채널을 먼저 저장하세요."
            : `${ranked.length}건 산정 완료 (preview). apply 모드로 실제 반영 가능.`,
      });
    }

    // APPLY
    if (ranked.length === 0) {
      return NextResponse.json(
        {
          ...baseResponse,
          durationMs: Date.now() - startedAt,
          error: "산정 대상 0건 — apply 거부. 먼저 채널을 저장하세요.",
        },
        { status: 400 },
      );
    }
    if (!serviceRoleAvailable) {
      return NextResponse.json(
        {
          ...baseResponse,
          durationMs: Date.now() - startedAt,
          error: "SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않음.",
          hint:
            "media_rankings 쓰기는 service_role 필요. .env.local 에 SUPABASE_SERVICE_ROLE_KEY 추가 후 재시도.",
        },
        { status: 503 },
      );
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "admin client 생성 실패 — env 확인" },
        { status: 500 },
      );
    }

    // 안전 교체 — insert before delete (실패 시 old 유지)
    // 1) 기존 행 id 목록 확보
    const { data: prevRowsRaw, error: prevErr } = await admin
      .from("media_rankings")
      .select("id")
      .eq("media_type", TARGET_MEDIA_TYPE);
    if (prevErr) {
      return NextResponse.json(
        {
          ...baseResponse,
          durationMs: Date.now() - startedAt,
          error: `media_rankings 기존 행 조회 실패: ${prevErr.message}`,
        },
        { status: 500 },
      );
    }
    const prevIds = ((prevRowsRaw ?? []) as { id: string }[]).map((r) => r.id);

    // 2) 새 행 insert (old + new 잠시 공존)
    const insertRows = ranked.map((r) => ({
      rank: r.rank,
      name: r.mediaName,
      media_type: TARGET_MEDIA_TYPE,
      category: null,
      score: r.score,
      description: describeChannel(r),
      image_url: r.thumbnailUrl,
      source_url: r.officialUrl,
      is_active: true,
    }));
    const { error: insError } = await admin
      .from("media_rankings")
      .insert(insertRows);
    if (insError) {
      // old 유지 — 데이터 무손실
      return NextResponse.json(
        {
          ...baseResponse,
          durationMs: Date.now() - startedAt,
          error: `media_rankings insert 실패: ${insError.message}`,
          preservedCount: prevIds.length,
          hint: "기존 media_rankings 유지됨 — 안전 교체 가드 작동.",
        },
        { status: 500 },
      );
    }

    // 3) 기존 행을 id 로 정확 삭제 (insert 된 new 는 다른 id 라 영향 없음)
    let deletedCount = 0;
    let delErrorMsg: string | null = null;
    if (prevIds.length > 0) {
      const { error: delError } = await admin
        .from("media_rankings")
        .delete()
        .in("id", prevIds);
      if (delError) {
        delErrorMsg = delError.message;
        // 부분 상태 — new 살아있음, old 도 살아있음. 응답엔 표기하되 5xx 는 아님.
      } else {
        deletedCount = prevIds.length;
      }
    }

    // 4) ranking_calculation_logs 적재 (anon insert OK)
    const logRows = ranked.map((r) => ({
      ranking_table: "media_rankings",
      target_name: r.mediaName,
      score: r.score,
      rank: r.rank,
      formula_version: FORMULA_VERSION,
      evidence: {
        channel_id: r.channelId,
        source_row_id: r.sourceRowId,
        weights: r.evidence.weights,
        components: r.evidence.components,
        subscriber_count: r.evidence.subscriber_count,
        view_count: r.evidence.view_count,
        video_count: r.evidence.video_count,
        subscribers_hidden: r.evidence.subscribers_hidden,
        source_fetched_at: r.evidence.source_fetched_at,
        previous_rank: r.previousRank,
        rank_change: r.rankChange,
        score_normalized: r.scoreNormalized,
      },
    }));
    const { error: logError } = await supabase
      .from("ranking_calculation_logs")
      .insert(logRows);

    return NextResponse.json({
      ...baseResponse,
      durationMs: Date.now() - startedAt,
      inserted: insertRows.length,
      deletedOld: deletedCount,
      partialDelete: delErrorMsg ? true : false,
      delError: delErrorMsg,
      logInserted: logError ? 0 : logRows.length,
      logError: logError?.message ?? null,
      note: delErrorMsg
        ? `${insertRows.length}건 insert 완료. 기존 ${prevIds.length}건 삭제 일부 실패 (UI 에 잠시 중복 보일 수 있음).`
        : `${insertRows.length}건 media_rankings 교체 완료. (이전 ${deletedCount}건 정리)`,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
