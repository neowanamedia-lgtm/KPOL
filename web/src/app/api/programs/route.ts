import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  MediaProgram,
  MediaProgramHost,
  MediaProgramDailyRanking,
} from "@/lib/programs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 프로그램 목록 — 최신 일일 랭킹 (전날 조회수) 기준.
 *
 * GET /api/programs?broadcaster=MBC&active=active&q=뉴스&limit=50&includeInactive=0
 *
 * 응답:
 *   - 정렬: media_program_daily_rankings.rank ASC, null 은 마지막 (alphabetical fallback)
 *   - 각 program 에 daily_ranking 포함 (없으면 null)
 *   - hosts 동봉 (UI 는 카드에 사용 안 하지만 admin/디버깅용 유지)
 *
 * 기본 정렬은 "최신 snapshot_date 기준". snapshot 이 아직 없으면 title ASC fallback.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface ProgramListItem extends Partial<MediaProgram> {
  hosts?: Pick<MediaProgramHost, "person_name" | "role" | "active">[];
  daily_ranking?: MediaProgramDailyRanking | null;
  /** UI 호환 — daily_ranking.rank_delta 또는 null */
  rank_change?: number | null;
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase env not set", programs: [] },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const broadcaster = url.searchParams.get("broadcaster")?.trim() ?? "";
  const activeParam = url.searchParams.get("active")?.trim() ?? "";
  const includeInactive = url.searchParams.get("includeInactive") === "1";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";

  let limit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const effectiveActive = includeInactive ? "" : activeParam || "active";

  try {
    let query = supabase
      .from("media_programs")
      .select(
        "id,title,slug,broadcaster,channel_name,youtube_channel_id,thumbnail_url,category,description,upload_frequency,started_at,ended_at,active_status,political_alignment,average_views,influence_score,created_at,updated_at,hosts:media_program_hosts(person_name,role,active)",
      )
      .order("title", { ascending: true })
      .limit(limit);

    if (broadcaster) query = query.eq("broadcaster", broadcaster);
    if (effectiveActive) query = query.eq("active_status", effectiveActive);
    if (category) query = query.eq("category", category);
    if (q) {
      const pattern = `%${q.replace(/[%_]/g, "")}%`;
      query = query.ilike("title", pattern);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message, programs: [] },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as ProgramListItem[];

    // 최신 daily ranking 로드 — 최신 snapshot_date 한 batch.
    // (program 수가 많지 않으니 단일 쿼리로 충분)
    let latestSnapshotDate: string | null = null;
    if (rows.length > 0) {
      const { data: dateRow } = await supabase
        .from("media_program_daily_rankings")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1);
      latestSnapshotDate =
        dateRow && dateRow.length > 0
          ? (dateRow[0].snapshot_date as string)
          : null;
    }
    const rankingByProgram = new Map<string, MediaProgramDailyRanking>();
    if (latestSnapshotDate) {
      const programIds = rows
        .map((r) => r.id as string | undefined)
        .filter((id): id is string => !!id);
      const { data: rankRows } = await supabase
        .from("media_program_daily_rankings")
        .select(
          "program_id, snapshot_date, previous_day_view_count, rank, rank_delta, recent_video_count, recent_window_days, formula_version",
        )
        .eq("snapshot_date", latestSnapshotDate)
        .in("program_id", programIds);
      for (const r of (rankRows ?? []) as MediaProgramDailyRanking[]) {
        rankingByProgram.set(r.program_id, r);
      }
    }

    // hosts inactive 필터 + ranking 부착
    const programs: ProgramListItem[] = rows.map((row) => {
      const hosts = (row.hosts ?? []).filter((h) => h.active !== false);
      const ranking = row.id ? rankingByProgram.get(row.id) ?? null : null;
      return {
        ...row,
        hosts,
        daily_ranking: ranking,
        rank_change: ranking?.rank_delta ?? null,
      };
    });

    // ranking 있으면 rank ASC, 없으면 title ASC (이미 DB 정렬). ranking 있는 게 위.
    programs.sort((a, b) => {
      const ar = a.daily_ranking?.rank ?? null;
      const br = b.daily_ranking?.rank ?? null;
      if (ar != null && br != null) return ar - br;
      if (ar != null) return -1;
      if (br != null) return 1;
      return (a.title ?? "").localeCompare(b.title ?? "", "ko");
    });

    return NextResponse.json({
      count: programs.length,
      programs,
      latestSnapshotDate,
      filters: {
        broadcaster: broadcaster || null,
        active: effectiveActive || null,
        category: category || null,
        q: q || null,
        includeInactive,
        limit,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), programs: [] },
      { status: 500 },
    );
  }
}
