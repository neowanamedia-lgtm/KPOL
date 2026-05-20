import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";
import type { ProgramActiveStatus } from "@/lib/programs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 프로그램 부분 업데이트 (admin only).
 *
 * PATCH /api/admin/programs/{id}
 * Body: { title?, broadcaster?, channel_name?, youtube_channel_id?, ... }
 *
 * 허용 필드만 통과. updated_at 은 DB 트리거로 자동 갱신.
 * service_role 필수.
 */

const ALLOWED_FIELDS = [
  "title",
  "slug",
  "broadcaster",
  "channel_name",
  "youtube_channel_id",
  "external_url",
  "thumbnail_url",
  "category",
  "description",
  "upload_frequency",
  "started_at",
  "ended_at",
  "active_status",
  "political_alignment",
  "average_views",
  "influence_score",
] as const;

const ALLOWED_STATUS: ProgramActiveStatus[] = ["active", "ended", "on_hiatus"];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srk) return null;
  return createClient(url, srk, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body 필요" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "body 가 object 아님" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in input) {
      update[k] = input[k];
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "업데이트할 필드가 없습니다." },
      { status: 400 },
    );
  }
  if (
    update.active_status != null &&
    !ALLOWED_STATUS.includes(update.active_status as ProgramActiveStatus)
  ) {
    return NextResponse.json(
      { error: `active_status 는 ${ALLOWED_STATUS.join("|")} 중 하나` },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("media_programs")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `update 실패: ${error.message}` },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "program not found", id },
      { status: 404 },
    );
  }

  return NextResponse.json({
    authSource: auth.source,
    updated: Object.keys(update),
    program: data,
  });
}
