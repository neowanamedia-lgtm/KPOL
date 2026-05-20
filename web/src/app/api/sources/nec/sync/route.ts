import { NextResponse } from "next/server";
import {
  fetchNecCandidateSearch,
  mapNecCandidateToRawRow,
  type NecCandidateSearchParams,
} from "@/lib/sources/nec";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// KPOL sync 보호 정책 — kpol-data-ingest-safety
const REQUIRED_YEAR = "2026";
const MAX_NUM_OF_ROWS = 10;
const MAX_INSERT_PER_CALL = 10;
const DEFAULT_PAGE_NO = 1;
const DEFAULT_NUM_OF_ROWS = 10;
const MAX_RAW_PAYLOAD_BYTES = 32 * 1024;

type Mode = "preview" | "insert";

/**
 * 2026 검증 — item 단위.
 * - paramsSgId 가 2026 으로 검증된 경우: item.sgId 와 충돌하면 reject, 없으면 통과
 * - paramsSgId 없는 경우(name 검색): item 이 sgId/sgDate 로 2026 을 독립 증명해야 통과
 */
function isItem2026(
  item: Record<string, unknown>,
  paramsSgId: string | null,
): { ok: boolean; reason?: string } {
  const itemSgId = item.sgId ?? item.SGID ?? null;
  const sgDate = item.sgDate ?? item.SGDATE ?? null;

  if (paramsSgId) {
    if (itemSgId != null && String(itemSgId) !== paramsSgId) {
      return {
        ok: false,
        reason: `item.sgId=${String(itemSgId)} != params.sgId=${paramsSgId}`,
      };
    }
    if (sgDate != null && !String(sgDate).startsWith(REQUIRED_YEAR)) {
      return {
        ok: false,
        reason: `item.sgDate=${String(sgDate)} (not ${REQUIRED_YEAR})`,
      };
    }
    return { ok: true };
  }

  if (itemSgId != null) {
    if (String(itemSgId).startsWith(REQUIRED_YEAR)) return { ok: true };
    return {
      ok: false,
      reason: `item.sgId=${String(itemSgId)} not ${REQUIRED_YEAR}`,
    };
  }
  if (sgDate != null) {
    if (String(sgDate).startsWith(REQUIRED_YEAR)) return { ok: true };
    return {
      ok: false,
      reason: `item.sgDate=${String(sgDate)} not ${REQUIRED_YEAR}`,
    };
  }
  return { ok: false, reason: "no verifiable 2026 marker in item" };
}

function isPayloadSafe(item: unknown): { ok: boolean; reason?: string } {
  let json: string;
  try {
    json = JSON.stringify(item);
  } catch {
    return { ok: false, reason: "raw_payload not JSON-serializable" };
  }
  if (json.length > MAX_RAW_PAYLOAD_BYTES) {
    return {
      ok: false,
      reason: `raw_payload too large (${json.length} > ${MAX_RAW_PAYLOAD_BYTES})`,
    };
  }
  if (/data:[^"']*;base64,/i.test(json)) {
    return { ok: false, reason: "raw_payload contains base64 data URI" };
  }
  if (/<\s*(html|body|!doctype|script|iframe)\b/i.test(json)) {
    return { ok: false, reason: "raw_payload contains HTML markup" };
  }
  return { ok: true };
}

/**
 * 선택된 인덱스만 insert 하기 위한 selectIdx 파싱.
 * - 빈 값/null: 모든 accepted 를 대상으로 함 (전체 동의)
 * - "0,2,5": 해당 인덱스만 대상
 */
function parseSelectIdx(raw: string | null): Set<number> | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const out = new Set<number>();
  for (const part of trimmed.split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n >= 0) out.add(n);
  }
  return out;
}

/**
 * NEC 후보자 통합검색 sync — 2026 전용, 수동, 이름 우선.
 *
 * 모드:
 *   - mode=preview (기본) — fetch + 분류, DB 쓰기 없음
 *   - mode=insert         — accepted 중 selectIdx 만 insert (없으면 전체)
 *
 * 필터 (둘 중 하나 필수):
 *   - candidateName       — 후보자 통합검색 (KPOL 기본)
 *   - sgId + sgTypecode   — 선거 필터 (기본 UI 에서 숨김)
 *
 * 호출:
 *   POST /api/sources/nec/sync?key=...&candidateName=홍길동&mode=preview
 *   POST /api/sources/nec/sync?key=...&candidateName=홍길동&mode=insert&selectIdx=0,2
 */
async function handle(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expected = process.env.NEXT_PUBLIC_KPOL_ADMIN_KEY;

  if (!expected) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_KPOL_ADMIN_KEY not set" },
      { status: 500 },
    );
  }
  if (key !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase env not set" },
      { status: 500 },
    );
  }

  const modeParam = (url.searchParams.get("mode") ?? "preview").toLowerCase();
  if (modeParam !== "preview" && modeParam !== "insert") {
    return NextResponse.json(
      { error: `mode must be 'preview' or 'insert' (got: ${modeParam})` },
      { status: 400 },
    );
  }
  const mode: Mode = modeParam;

  const candidateName = (url.searchParams.get("candidateName") ?? "").trim();
  const sgId = (url.searchParams.get("sgId") ?? "").trim();
  const sgTypecode = (url.searchParams.get("sgTypecode") ?? "").trim();
  const jdName = (url.searchParams.get("jdName") ?? "").trim();
  const sdName = (url.searchParams.get("sdName") ?? "").trim();
  const wiwName = (url.searchParams.get("wiwName") ?? "").trim();
  const selectIdx = parseSelectIdx(url.searchParams.get("selectIdx"));

  const hasName = candidateName.length > 0;
  const hasRegistration = sgId.length > 0 && sgTypecode.length > 0;

  // GUARD — 필터 없는 전체 호출 차단
  if (!hasName && !hasRegistration) {
    return NextResponse.json(
      {
        error:
          "filter required — candidateName (권장) 또는 sgId+sgTypecode 중 하나 필수",
      },
      { status: 400 },
    );
  }

  // GUARD — sgId 가 있으면 2026
  if (sgId && !sgId.startsWith(REQUIRED_YEAR)) {
    return NextResponse.json(
      {
        error: `2026 sgId 만 허용 — sgId=${sgId}`,
        hint: `sgId 는 "${REQUIRED_YEAR}" 으로 시작해야 함`,
      },
      { status: 400 },
    );
  }
  if (!hasName && sgId && !sgTypecode) {
    return NextResponse.json(
      {
        error:
          "sgTypecode required when sgId is used without candidateName — bulk 차단",
      },
      { status: 400 },
    );
  }

  // GUARD — pageNo / numOfRows
  const pageNoParam = url.searchParams.get("pageNo");
  const numRowsParam = url.searchParams.get("numOfRows");
  const pageNo = pageNoParam
    ? Math.max(1, Number(pageNoParam) || DEFAULT_PAGE_NO)
    : DEFAULT_PAGE_NO;
  let numOfRows = numRowsParam
    ? Number(numRowsParam) || DEFAULT_NUM_OF_ROWS
    : DEFAULT_NUM_OF_ROWS;
  if (!Number.isFinite(numOfRows) || numOfRows < 1) {
    numOfRows = DEFAULT_NUM_OF_ROWS;
  }
  if (numOfRows > MAX_NUM_OF_ROWS) numOfRows = MAX_NUM_OF_ROWS;

  const paramsSgIdForCheck: string | null = sgId || null;

  try {
    const sp: NecCandidateSearchParams = {
      name: candidateName || undefined,
      sgId: sgId || undefined,
      sgTypecode: sgTypecode || undefined,
      jdName: jdName || undefined,
      sdName: sdName || undefined,
      wiwName: wiwName || undefined,
      numOfRows,
      pageNo,
    };
    const resp = await fetchNecCandidateSearch(sp);

    const acceptedRows: ReturnType<typeof mapNecCandidateToRawRow>[] = [];
    const acceptedSamples: Array<{
      idx: number;
      candidate_name: string | null;
      party_name: string | null;
      district_name: string | null;
      election_id: string | null;
    }> = [];
    const rejected: { reason: string; sample?: unknown }[] = [];

    for (const it of resp.items) {
      const itemObj = it as Record<string, unknown>;
      const yearCheck = isItem2026(itemObj, paramsSgIdForCheck);
      if (!yearCheck.ok) {
        rejected.push({ reason: yearCheck.reason ?? "not 2026", sample: it });
        continue;
      }
      const safeCheck = isPayloadSafe(it);
      if (!safeCheck.ok) {
        rejected.push({ reason: safeCheck.reason ?? "unsafe payload" });
        continue;
      }
      if (acceptedRows.length >= MAX_INSERT_PER_CALL) {
        rejected.push({
          reason: `over MAX_INSERT_PER_CALL=${MAX_INSERT_PER_CALL}`,
        });
        continue;
      }
      const row = mapNecCandidateToRawRow(it, {
        sgId: sgId || undefined,
        sgTypecode: sgTypecode || undefined,
      });
      const idx = acceptedRows.length;
      acceptedRows.push(row);
      acceptedSamples.push({
        idx,
        candidate_name: row.candidate_name,
        party_name: row.party_name,
        district_name: row.district_name,
        election_id: row.election_id,
      });
    }

    const guardInfo = {
      candidateName: candidateName || null,
      sgId: sgId || null,
      sgTypecode: sgTypecode || null,
      pageNo,
      numOfRows,
      maxInsertPerCall: MAX_INSERT_PER_CALL,
      maxRawPayloadBytes: MAX_RAW_PAYLOAD_BYTES,
      requiredYear: REQUIRED_YEAR,
      requestUrl: resp.requestUrl,
    };

    if (mode === "preview") {
      return NextResponse.json({
        mode,
        fetched: resp.items.length,
        acceptedCount: acceptedRows.length,
        rejectedCount: rejected.length,
        acceptedSamples,
        rejectedReasons: rejected.slice(0, 10),
        totalCount: resp.totalCount,
        pageNoEcho: resp.pageNo,
        guard: guardInfo,
        note:
          acceptedRows.length === 0
            ? resp.items.length === 0
              ? "응답 항목 없음. 검색어 / 필터 재확인."
              : "모든 항목이 가드에서 reject 됨 (insert 가능한 항목 없음)."
            : `${acceptedRows.length}건 insert 가능. 선택 후 mode=insert 로 재호출.`,
      });
    }

    // INSERT — selectIdx 가 있으면 해당만, 없으면 전체 accepted
    const toInsert = selectIdx
      ? acceptedRows.filter((_, i) => selectIdx.has(i))
      : acceptedRows;
    const skippedBySelect = selectIdx
      ? acceptedRows.length - toInsert.length
      : 0;

    if (toInsert.length === 0) {
      return NextResponse.json({
        mode,
        fetched: resp.items.length,
        inserted: 0,
        rejected: rejected.length,
        selected: selectIdx ? Array.from(selectIdx) : null,
        skippedBySelect,
        rejectedReasons: rejected.slice(0, 10),
        totalCount: resp.totalCount,
        note:
          acceptedRows.length === 0
            ? "insert 가능한 항목이 없습니다. 먼저 preview 로 확인하세요."
            : "selectIdx 가 비어 있어 insert 대상이 없습니다.",
      });
    }

    const { error } = await supabase
      .from("election_candidates_raw")
      .insert(toInsert);

    if (error) {
      return NextResponse.json(
        {
          mode,
          error: error.message,
          fetched: resp.items.length,
          inserted: 0,
          rejected: rejected.length,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      mode,
      fetched: resp.items.length,
      inserted: toInsert.length,
      rejected: rejected.length,
      selected: selectIdx ? Array.from(selectIdx) : null,
      skippedBySelect,
      rejectedReasons: rejected.slice(0, 10),
      totalCount: resp.totalCount,
      pageNoEcho: resp.pageNo,
      guard: guardInfo,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
