import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * media_sources_raw 단건/소수 삭제용 admin 라우트.
 *
 * 사용 사례:
 *   - 잘못 저장된 비정치 채널 정리 (예: YouTube Korea)
 *   - 테스트 데이터 정리
 *   - 채널이 더 이상 운영되지 않거나 정책상 제외해야 할 때
 *
 * 권한: admin auth + SUPABASE_SERVICE_ROLE_KEY 필수 (anon delete policy 없음).
 *
 * 호출:
 *   POST /api/admin/media-sources/delete?channelId=UC...
 *   POST /api/admin/media-sources/delete?id=<uuid>
 *   (둘 중 하나 필수. channelId 는 raw_payload.id 매칭)
 *
 * 가드:
 *   - 1회 호출 최대 MAX_DELETE 건 (안전망)
 *   - mode=preview 면 매칭만 보여주고 실제 삭제 ✗
 *   - mode=delete (default) 면 실제 삭제
 */

const MAX_DELETE = 10;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srk) return null;
  return createClient(url, srk, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const auth = checkAdminAuth(req, url);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY missing — delete 불가" },
      { status: 503 },
    );
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "admin client 생성 실패 (env 확인)" },
      { status: 500 },
    );
  }

  const mode = (url.searchParams.get("mode") ?? "delete").toLowerCase();
  const channelId = (url.searchParams.get("channelId") ?? "").trim();
  const rowId = (url.searchParams.get("id") ?? "").trim();

  if (!channelId && !rowId) {
    return NextResponse.json(
      { error: "channelId 또는 id 중 하나 필수" },
      { status: 400 },
    );
  }
  if (mode !== "preview" && mode !== "delete") {
    return NextResponse.json(
      { error: `mode must be 'preview' or 'delete' (got: ${mode})` },
      { status: 400 },
    );
  }

  // 매칭 row 조회
  let query = admin
    .from("media_sources_raw")
    .select("id, media_name, raw_payload, fetched_at")
    .limit(MAX_DELETE + 1);
  if (rowId) {
    query = query.eq("id", rowId);
  } else {
    // PostgREST jsonb 필터 — raw_payload->>id 매칭
    query = query.eq("raw_payload->>id", channelId);
  }
  const { data: matches, error: selErr } = await query;
  if (selErr) {
    return NextResponse.json(
      { error: `select 실패: ${selErr.message}` },
      { status: 500 },
    );
  }

  const matched = (matches ?? []) as Array<{
    id: string;
    media_name: string | null;
    raw_payload: unknown;
    fetched_at: string;
  }>;

  if (matched.length === 0) {
    return NextResponse.json({
      authSource: auth.source,
      mode,
      matched: 0,
      deleted: 0,
      note: "매칭되는 row 가 없습니다.",
    });
  }
  if (matched.length > MAX_DELETE) {
    return NextResponse.json(
      {
        error: `매칭 ${matched.length}건 > 상한 ${MAX_DELETE}건. 필터 더 좁혀서 재시도.`,
        sampleIds: matched.slice(0, 5).map((m) => m.id),
      },
      { status: 400 },
    );
  }

  const matchedSummary = matched.map((m) => ({
    id: m.id,
    media_name: m.media_name,
    channel_id: ((m.raw_payload as Record<string, unknown> | null)?.id ??
      null) as string | null,
    fetched_at: m.fetched_at,
  }));

  if (mode === "preview") {
    return NextResponse.json({
      authSource: auth.source,
      mode,
      matched: matched.length,
      matchedSummary,
      note: "preview only — 삭제 안 함. mode=delete 로 실제 삭제.",
    });
  }

  // 실제 삭제
  const ids = matched.map((m) => m.id);
  const { error: delErr } = await admin
    .from("media_sources_raw")
    .delete()
    .in("id", ids);
  if (delErr) {
    return NextResponse.json(
      {
        authSource: auth.source,
        mode,
        matched: matched.length,
        deleted: 0,
        error: `delete 실패: ${delErr.message}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    authSource: auth.source,
    mode,
    matched: matched.length,
    deleted: ids.length,
    matchedSummary,
    note: `${ids.length}건 삭제 완료.`,
  });
}

export const GET = handle;
export const POST = handle;
