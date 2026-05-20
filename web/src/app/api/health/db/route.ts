import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * KPOL DB/테이블 상태 진단 — admin 전용.
 *
 * 호출:
 *   GET /api/health/db  (Authorization: Bearer or ?key=)
 *
 * 반환:
 *   - supabase connection (count 호출 성공 여부)
 *   - 각 raw/ranking 테이블 row count
 *   - 최근 ranking_calculation_logs (media_rankings) 1건 시각
 *   - media_rankings 의 youtube_channel 활성 row 수
 */

const TABLES = [
  "election_candidates_raw",
  "election_candidate_sources",
  "media_sources_raw",
  "news_mentions_raw",
  "ranking_calculation_logs",
  "people_rankings",
  "by_election_rankings",
  "local_election_rankings",
  "media_rankings",
];

interface TableStat {
  table: string;
  count: number | null;
  error: string | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = checkAdminAuth(req, url);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      {
        authSource: auth.source,
        supabase: { reachable: false, error: "env not set" },
        tables: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }

  const startedAt = Date.now();
  const tables: TableStat[] = [];
  let reachable = true;
  let firstError: string | null = null;

  for (const t of TABLES) {
    try {
      const { count, error } = await supabase
        .from(t)
        .select("*", { count: "exact", head: true });
      if (error) {
        reachable = false;
        firstError ??= error.message;
        tables.push({ table: t, count: null, error: error.message });
      } else {
        tables.push({ table: t, count: count ?? 0, error: null });
      }
    } catch (e) {
      reachable = false;
      const msg = e instanceof Error ? e.message : String(e);
      firstError ??= msg;
      tables.push({ table: t, count: null, error: msg });
    }
  }

  // youtube_channel 활성 ranking row 수 — 따로 측정 (필터 적용)
  let youtubeRankingsActive: number | null = null;
  try {
    const { count } = await supabase
      .from("media_rankings")
      .select("*", { count: "exact", head: true })
      .eq("media_type", "youtube_channel")
      .eq("is_active", true);
    youtubeRankingsActive = count ?? 0;
  } catch {
    youtubeRankingsActive = null;
  }

  // 최근 media_rankings calculation log
  let lastMediaLog: {
    calculated_at: string;
    formula_version: string | null;
    rows: number;
  } | null = null;
  try {
    // 최신 batch 의 calculated_at 만 알면 됨 — head 만으로는 timestamp 못 받음
    const { data, error } = await supabase
      .from("ranking_calculation_logs")
      .select("calculated_at, formula_version")
      .eq("ranking_table", "media_rankings")
      .order("calculated_at", { ascending: false })
      .limit(1);
    if (!error && data && data.length > 0) {
      const latestAt = data[0].calculated_at as string;
      const formulaVersion =
        (data[0].formula_version as string | null) ?? null;
      const { count: batchCount } = await supabase
        .from("ranking_calculation_logs")
        .select("*", { count: "exact", head: true })
        .eq("ranking_table", "media_rankings")
        .eq("calculated_at", latestAt);
      lastMediaLog = {
        calculated_at: latestAt,
        formula_version: formulaVersion,
        rows: batchCount ?? 0,
      };
    }
  } catch {
    // ignore — 진단용
  }

  return NextResponse.json({
    authSource: auth.source,
    supabase: { reachable, error: firstError },
    tables,
    mediaRankings: {
      youtubeChannelActive: youtubeRankingsActive,
      lastCalculationLog: lastMediaLog,
    },
    durationMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
}
