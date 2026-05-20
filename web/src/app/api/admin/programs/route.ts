import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";
import { validateCreateProgram, type CreateProgramInput } from "@/lib/programs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 프로그램 생성 (admin only).
 *
 * POST /api/admin/programs
 * Body: CreateProgramInput (title 필수)
 *
 * 요구:
 *   - admin auth (Bearer/query)
 *   - SUPABASE_SERVICE_ROLE_KEY (media_programs 쓰기 정책 service_role)
 */

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srk) return null;
  return createClient(url, srk, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const auth = checkAdminAuth(req, url);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY missing — write 불가" },
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body 필요" }, { status: 400 });
  }
  const v = validateCreateProgram(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const input: CreateProgramInput = v.value;
  const row = {
    title: input.title.trim(),
    slug: input.slug ?? null,
    broadcaster: input.broadcaster ?? null,
    channel_name: input.channel_name ?? null,
    youtube_channel_id: input.youtube_channel_id ?? null,
    external_url: input.external_url ?? null,
    thumbnail_url: input.thumbnail_url ?? null,
    category: input.category ?? null,
    description: input.description ?? null,
    upload_frequency: input.upload_frequency ?? null,
    started_at: input.started_at ?? null,
    ended_at: input.ended_at ?? null,
    active_status: input.active_status ?? "active",
    political_alignment: input.political_alignment ?? null,
    average_views: input.average_views ?? null,
    influence_score: input.influence_score ?? null,
  };

  const { data, error } = await admin
    .from("media_programs")
    .insert(row)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `insert 실패: ${error.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({
    authSource: auth.source,
    program: data,
    note: "프로그램 생성 완료. 진행자/패널/연결은 /hosts /panelists /person-links 라우트로 추가.",
  });
}
