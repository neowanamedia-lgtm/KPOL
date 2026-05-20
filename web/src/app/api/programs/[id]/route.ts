import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  MediaProgram,
  MediaProgramHost,
  MediaProgramPanelist,
  MediaProgramPersonLink,
} from "@/lib/programs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 프로그램 상세 (public read).
 *
 * GET /api/programs/{id}
 *
 * 응답: MediaProgramFull = program + hosts + panelists + person_links.
 *   - hosts/panelists: active=true 기본
 *   - person_links: 최신 50건 (appearance_date desc, created_at desc)
 *
 * id 형식:
 *   - uuid (정규 식별자)
 *   - 'slug:{slug}' 형태도 추후 지원 가능 (현재는 uuid 만)
 */

const PERSON_LINKS_LIMIT = 50;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase env not set" },
      { status: 500 },
    );
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const [progSel, hostsSel, panelistsSel, linksSel] = await Promise.all([
      supabase
        .from("media_programs")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("media_program_hosts")
        .select("*")
        .eq("program_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("media_program_panelists")
        .select("*")
        .eq("program_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("media_program_person_links")
        .select("*")
        .eq("program_id", id)
        .order("appearance_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(PERSON_LINKS_LIMIT),
    ]);

    if (progSel.error) {
      return NextResponse.json(
        { error: `program select 실패: ${progSel.error.message}` },
        { status: 500 },
      );
    }
    if (!progSel.data) {
      return NextResponse.json(
        { error: "program not found", id },
        { status: 404 },
      );
    }

    const program = progSel.data as MediaProgram;
    const hosts = (hostsSel.data ?? []) as MediaProgramHost[];
    const panelists = (panelistsSel.data ?? []) as MediaProgramPanelist[];
    const person_links = (linksSel.data ?? []) as MediaProgramPersonLink[];

    return NextResponse.json({
      ...program,
      hosts,
      panelists,
      person_links,
      errors: {
        hosts: hostsSel.error?.message ?? null,
        panelists: panelistsSel.error?.message ?? null,
        person_links: linksSel.error?.message ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
