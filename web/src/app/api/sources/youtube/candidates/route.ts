import { NextResponse } from "next/server";
import {
  searchYoutubeChannels,
  classifyChannelByKeywords,
  fetchYoutubeChannelsBatch,
  mapYoutubeChannelToRawRow,
  extractYoutubeChannelSample,
  POLITICAL_KEYWORDS_DEFAULT,
  ANTI_KEYWORDS,
  type ChannelClassification,
  type YoutubeSearchItem,
  type YoutubeChannelItem,
} from "@/lib/sources/youtube";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * YouTube 정치·시사 채널 후보군 배치 라우트.
 *
 * 두 단계:
 *   mode=preview — keywords[] × search.list (각 100 unit) → dedup + 키워드 분류
 *                  DB 쓰기 ✗
 *   mode=insert  — selectChannelIds[] → channels.list 1회 (1 unit) → media_sources_raw 저장
 *
 * quota:
 *   preview = keywordsCount × 100
 *   insert  = 1
 *
 * 가드:
 *   - admin key 필수
 *   - mode=preview: keywords 1~5개, maxPerKeyword 1~5 (총 search.list 최대 5회 = 500 unit)
 *   - mode=insert : selectChannelIds 1~10개. 각 ID는 UC+22자.
 *   - raw_payload 32KB / HTML / base64 동일 reject
 *   - AI 임의 분류 ✗ — keyword string match 만 (classifyChannelByKeywords)
 */

const MAX_KEYWORDS_PER_PREVIEW = 5;
const MAX_RESULTS_PER_KEYWORD = 5;
const MAX_CHANNELS_PER_INSERT = 10;
const MAX_RAW_PAYLOAD_BYTES = 32 * 1024;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

type Mode = "preview" | "insert";

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

function parseCommaList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface CandidateRow {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  matchedKeywords: string[];
  matchedAntiKeywords: string[];
  matchedQueries: string[]; // 어떤 검색 쿼리에서 잡혔는지
  category: ChannelClassification;
}

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
  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY not set (server env)" },
      { status: 500 },
    );
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

  if (mode === "preview") {
    return await runPreview(url);
  }
  return await runInsert(url);
}

async function runPreview(url: URL): Promise<NextResponse> {
  // keywords: comma-separated. 비어있으면 default whitelist 사용.
  const kwParam = url.searchParams.get("keywords");
  const keywordsRaw = parseCommaList(kwParam);
  const keywords =
    keywordsRaw.length > 0 ? keywordsRaw : [...POLITICAL_KEYWORDS_DEFAULT];

  if (keywords.length === 0) {
    return NextResponse.json(
      { error: "keywords 가 비어있고 default 도 없음" },
      { status: 400 },
    );
  }
  if (keywords.length > MAX_KEYWORDS_PER_PREVIEW) {
    return NextResponse.json(
      {
        error: `keywords 최대 ${MAX_KEYWORDS_PER_PREVIEW}개 (quota 보호). 받은 갯수: ${keywords.length}`,
      },
      { status: 400 },
    );
  }

  let maxPerKeyword = Number(
    url.searchParams.get("maxPerKeyword") ?? MAX_RESULTS_PER_KEYWORD,
  );
  if (!Number.isFinite(maxPerKeyword) || maxPerKeyword < 1) {
    maxPerKeyword = MAX_RESULTS_PER_KEYWORD;
  }
  if (maxPerKeyword > MAX_RESULTS_PER_KEYWORD) {
    maxPerKeyword = MAX_RESULTS_PER_KEYWORD;
  }

  // anti-keyword override (optional) — 빈 값이면 기본 ANTI_KEYWORDS
  const antiParam = url.searchParams.get("antiKeywords");
  const antiKeywords =
    antiParam != null && parseCommaList(antiParam).length > 0
      ? parseCommaList(antiParam)
      : [...ANTI_KEYWORDS];

  const quotaEstimate = keywords.length * 100;

  const dedup = new Map<string, CandidateRow>();
  const errors: { keyword: string; error: string }[] = [];
  const requestUrls: string[] = [];

  for (const kw of keywords) {
    try {
      const r = await searchYoutubeChannels({
        q: kw,
        maxResults: maxPerKeyword,
      });
      requestUrls.push(r.requestUrl);
      for (const it of r.items as YoutubeSearchItem[]) {
        const existing = dedup.get(it.channelId);
        if (existing) {
          if (!existing.matchedQueries.includes(kw)) {
            existing.matchedQueries.push(kw);
          }
          continue;
        }
        const cls = classifyChannelByKeywords(
          { title: it.title, description: it.description },
          keywords,
          antiKeywords,
        );
        dedup.set(it.channelId, {
          channelId: it.channelId,
          title: it.title,
          description: it.description,
          thumbnailUrl: it.thumbnailUrl,
          publishedAt: it.publishedAt,
          matchedKeywords: cls.matchedKeywords,
          matchedAntiKeywords: cls.matchedAntiKeywords,
          matchedQueries: [kw],
          category: cls.category,
        });
      }
    } catch (e) {
      errors.push({
        keyword: kw,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const all = Array.from(dedup.values());
  const candidates = all.filter((c) => c.category === "candidate");
  const reviewNeeded = all.filter((c) => c.category === "review_needed");
  const rejectedAnti = all.filter((c) => c.category === "rejected_anti");

  return NextResponse.json({
    mode: "preview",
    keywordsUsed: keywords,
    antiKeywordsUsed: antiKeywords,
    maxPerKeyword,
    quotaEstimate,
    quotaUnit: "unit",
    totalUnique: all.length,
    countByCategory: {
      candidate: candidates.length,
      review_needed: reviewNeeded.length,
      rejected_anti: rejectedAnti.length,
    },
    candidates,
    reviewNeeded,
    rejectedAnti,
    errors,
    requestUrls,
    note:
      candidates.length === 0
        ? "candidate 0건. 키워드/필터 재검토 또는 review_needed 에서 수동 picking."
        : `${candidates.length}건 candidate. mode=insert + selectChannelIds 로 저장.`,
    guard: {
      maxKeywordsPerPreview: MAX_KEYWORDS_PER_PREVIEW,
      maxResultsPerKeyword: MAX_RESULTS_PER_KEYWORD,
      maxRawPayloadBytes: MAX_RAW_PAYLOAD_BYTES,
    },
  });
}

async function runInsert(url: URL): Promise<NextResponse> {
  const ids = parseCommaList(url.searchParams.get("selectChannelIds"));
  if (ids.length === 0) {
    return NextResponse.json(
      {
        error:
          "selectChannelIds 필수 — comma-separated channel ID 목록 (UC+22자)",
      },
      { status: 400 },
    );
  }
  if (ids.length > MAX_CHANNELS_PER_INSERT) {
    return NextResponse.json(
      {
        error: `selectChannelIds 최대 ${MAX_CHANNELS_PER_INSERT}개. 받은 갯수: ${ids.length}`,
      },
      { status: 400 },
    );
  }
  const invalid = ids.filter((id) => !CHANNEL_ID_RE.test(id));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `잘못된 channel ID 형식: ${invalid.join(", ")}` },
      { status: 400 },
    );
  }

  let batch;
  try {
    batch = await fetchYoutubeChannelsBatch(ids);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  const rows: ReturnType<typeof mapYoutubeChannelToRawRow>[] = [];
  const samples: ReturnType<typeof extractYoutubeChannelSample>[] = [];
  const rejected: { channelId?: string; reason: string }[] = [];
  const foundIds = new Set<string>();

  for (const item of batch.items as YoutubeChannelItem[]) {
    const channelId = item.id ?? "";
    foundIds.add(channelId);
    const safe = isPayloadSafe(item);
    if (!safe.ok) {
      rejected.push({
        channelId,
        reason: safe.reason ?? "unsafe payload",
      });
      continue;
    }
    try {
      const row = mapYoutubeChannelToRawRow(item);
      rows.push(row);
      samples.push(extractYoutubeChannelSample(item));
    } catch (mapErr) {
      rejected.push({
        channelId,
        reason: mapErr instanceof Error ? mapErr.message : String(mapErr),
      });
    }
  }

  // 요청 ID 중 응답에 안 들어온 것 — not found 로 기록
  for (const id of ids) {
    if (!foundIds.has(id)) {
      rejected.push({
        channelId: id,
        reason: "channels.list 응답에 없음 (삭제/비공개/잘못된 ID)",
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({
      mode: "insert",
      requested: ids.length,
      fetched: batch.items.length,
      inserted: 0,
      rejected,
      requestUrl: batch.requestUrl,
      note: "insert 가능한 row 없음 — 모두 reject 또는 not found.",
    });
  }

  const { error } = await supabase.from("media_sources_raw").insert(rows);
  if (error) {
    return NextResponse.json(
      {
        mode: "insert",
        requested: ids.length,
        fetched: batch.items.length,
        inserted: 0,
        error: error.message,
        rejected,
        requestUrl: batch.requestUrl,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    mode: "insert",
    requested: ids.length,
    fetched: batch.items.length,
    inserted: rows.length,
    rejected,
    samples,
    requestUrl: batch.requestUrl,
    note: `${rows.length}건 media_sources_raw 저장 완료.`,
    guard: {
      maxChannelsPerInsert: MAX_CHANNELS_PER_INSERT,
      maxRawPayloadBytes: MAX_RAW_PAYLOAD_BYTES,
    },
  });
}

export const GET = handle;
export const POST = handle;
