import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";
import type { AddPersonLinkInput } from "@/lib/programs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 프로그램-인물 연결 추가 (admin only).
 *
 * POST /api/admin/programs/{programId}/person-links
 * Body: AddPersonLinkInput (person_name + link_type 필수)
 *
 * link_type:
 *   - guest_appearance  게스트 출연
 *   - mention           언급
 *   - clip_subject      클립 주제
 *   - interview         인터뷰
 *   - (그 외 문자열도 허용)
 */

const ALLOWED_LINK_TYPES = new Set([
  "guest_appearance",
  "mention",
  "clip_subject",
  "interview",
]);

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srk) return null;
  return createClient(url, srk, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(
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

  const { id: programId } = await ctx.params;
  if (!programId) {
    return NextResponse.json({ error: "programId required" }, { status: 400 });
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
  const b = body as AddPersonLinkInput;
  if (typeof b.person_name !== "string" || b.person_name.trim().length === 0) {
    return NextResponse.json({ error: "person_name 필수" }, { status: 400 });
  }
  if (typeof b.link_type !== "string" || b.link_type.trim().length === 0) {
    return NextResponse.json({ error: "link_type 필수" }, { status: 400 });
  }
  const linkType = b.link_type.trim();
  if (!ALLOWED_LINK_TYPES.has(linkType)) {
    // 미정의 타입도 허용하되 warning 표시
    // (DB 는 text 라 거부 안 함, 운영 시 약속된 타입 권장)
  }

  const row = {
    program_id: programId,
    person_name: b.person_name.trim(),
    person_id: b.person_id ?? null,
    link_type: linkType,
    appearance_date: b.appearance_date ?? null,
    context: b.context ?? null,
    source_url: b.source_url ?? null,
    source_video_id: b.source_video_id ?? null,
  };

  const { data, error } = await admin
    .from("media_program_person_links")
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
    person_link: data,
    warning: ALLOWED_LINK_TYPES.has(linkType)
      ? null
      : `link_type='${linkType}' 는 비표준 — 표준 4종 권장 (${Array.from(ALLOWED_LINK_TYPES).join("|")})`,
  });
}
