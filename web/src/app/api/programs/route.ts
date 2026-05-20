import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { MediaProgram, MediaProgramHost } from "@/lib/programs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 프로그램 목록 (public read).
 *
 * GET /api/programs?broadcaster=MBC&active=active&q=뉴스&limit=50&includeInactive=0
 *
 * 필터:
 *   - broadcaster (exact)
 *   - active=active|ended|on_hiatus (default: 'active' 만 — 메인 list 용)
 *   - includeInactive=1 → active 필터 제거 (admin/모든 상태)
 *   - category (exact)
 *   - q (title ilike)
 *   - limit (1..200, default 50)
 *
 * hosts 는 nested select 로 함께 반환 (행 카드 표시용).
 * 정렬: influence_score DESC NULLS LAST, title ASC.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface ProgramListItem extends Partial<MediaProgram> {
  hosts?: Pick<MediaProgramHost, "person_name" | "role" | "active">[];
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

  // 기본은 active 만 (메인 list 용). admin 등 전체 조회 시 includeInactive=1.
  const effectiveActive = includeInactive ? "" : activeParam || "active";

  try {
    let query = supabase
      .from("media_programs")
      .select(
        // nested: hosts (active 만 클라이언트에서 필터)
        "id,title,slug,broadcaster,channel_name,youtube_channel_id,thumbnail_url,category,description,upload_frequency,started_at,ended_at,active_status,political_alignment,average_views,influence_score,created_at,updated_at,hosts:media_program_hosts(person_name,role,active)",
      )
      .order("influence_score", { ascending: false, nullsFirst: false })
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

    // hosts: active 만 — 클라이언트 측 필터 (PostgREST nested 의 inner-filter 는
    // 버전·이름 의존이 있어 응답 가공으로 단순화)
    const programs: ProgramListItem[] = (data ?? []).map((row) => {
      const r = row as ProgramListItem & {
        hosts?: Pick<MediaProgramHost, "person_name" | "role" | "active">[];
      };
      const hosts = (r.hosts ?? []).filter((h) => h.active !== false);
      return { ...r, hosts };
    });

    return NextResponse.json({
      count: programs.length,
      programs,
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
