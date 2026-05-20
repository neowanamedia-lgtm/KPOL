import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";
import type { AddPanelistInput } from "@/lib/programs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 프로그램 고정 패널 추가 (admin only).
 *
 * POST /api/admin/programs/{programId}/panelists
 * Body: AddPanelistInput (person_name 필수)
 */

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
  const b = body as AddPanelistInput;
  if (typeof b.person_name !== "string" || b.person_name.trim().length === 0) {
    return NextResponse.json(
      { error: "person_name 필수" },
      { status: 400 },
    );
  }

  const row = {
    program_id: programId,
    person_name: b.person_name.trim(),
    person_id: b.person_id ?? null,
    panel_role: b.panel_role ?? null,
    cadence: b.cadence ?? null,
    active: b.active ?? true,
    notes: b.notes ?? null,
  };

  const { data, error } = await admin
    .from("media_program_panelists")
    .insert(row)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `insert 실패: ${error.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ authSource: auth.source, panelist: data });
}
