import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { MediaProgram } from "@/lib/programs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 프로그램 목록 (public read).
 *
 * GET /api/programs?broadcaster=MBC&active=active&q=뉴스&limit=50
 *
 * 필터:
 *   - broadcaster (exact match)
 *   - active=active|ended|on_hiatus (active_status)
 *   - category (exact match)
 *   - q (title ilike)
 *   - limit (1..200, default 50)
 *
 * 정렬: influence_score DESC NULLS LAST, title ASC.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase env not set", programs: [] },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const broadcaster = url.searchParams.get("broadcaster")?.trim() ?? "";
  const active = url.searchParams.get("active")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";

  let limit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  try {
    let query = supabase
      .from("media_programs")
      .select(
        "id,title,slug,broadcaster,channel_name,youtube_channel_id,thumbnail_url,category,description,upload_frequency,started_at,ended_at,active_status,political_alignment,average_views,influence_score,created_at,updated_at",
      )
      .order("influence_score", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true })
      .limit(limit);

    if (broadcaster) query = query.eq("broadcaster", broadcaster);
    if (active) query = query.eq("active_status", active);
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

    return NextResponse.json({
      count: (data ?? []).length,
      programs: (data ?? []) as Partial<MediaProgram>[],
      filters: {
        broadcaster: broadcaster || null,
        active: active || null,
        category: category || null,
        q: q || null,
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
