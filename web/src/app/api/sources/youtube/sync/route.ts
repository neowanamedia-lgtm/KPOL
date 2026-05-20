import { NextResponse } from "next/server";
import {
  fetchYoutubeChannel,
  mapYoutubeChannelToRawRow,
  extractYoutubeChannelSample,
  parseYoutubeChannelInput,
} from "@/lib/sources/youtube";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// KPOL sync 보호 정책 — kpol-data-ingest-safety
const MAX_RAW_PAYLOAD_BYTES = 32 * 1024;
const MAX_CHANNELS_PER_CALL = 1;

type Mode = "preview" | "insert";

/** raw_payload 안전성 — NEC 와 동일 가드 */
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
  // YouTube 응답 내 description 에 사용자 입력 HTML / base64 가 들어올 가능성 차단
  if (/data:[^"']*;base64,/i.test(json)) {
    return { ok: false, reason: "raw_payload contains base64 data URI" };
  }
  if (/<\s*(html|body|!doctype|script|iframe)\b/i.test(json)) {
    return { ok: false, reason: "raw_payload contains HTML markup" };
  }
  return { ok: true };
}

/**
 * YouTube channel sync — 1회 호출 1채널, 수동 admin.
 *
 * 호출:
 *   POST /api/sources/youtube/sync?key=ADMIN&channel=UCxxx&mode=preview
 *   POST /api/sources/youtube/sync?key=ADMIN&channel=@handle&mode=insert
 *
 * 입력 (channel 파라미터):
 *   - UCxxxxx (24자 channel ID)
 *   - @handle
 *   - https://www.youtube.com/channel/UCxxx 또는 .../@handle (URL 자동 파싱)
 *   - custom URL / 단일 이름은 미지원
 *
 * 가드:
 *   - admin key 필수
 *   - channel 입력 필수, 형식 검증
 *   - 1회 1채널 (MAX_CHANNELS_PER_CALL=1, channels.list?maxResults=1)
 *   - raw_payload 32KB / HTML / base64 reject
 *   - preview → insert 2단계 (mode=preview 가 기본)
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

  const channelInput = (url.searchParams.get("channel") ?? "").trim();
  if (!channelInput) {
    return NextResponse.json(
      {
        error:
          "channel 입력 필수 — UCxxx 형 channel ID 또는 @handle 또는 youtube.com URL",
      },
      { status: 400 },
    );
  }

  const parsed = parseYoutubeChannelInput(channelInput);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const guardInfo = {
    input: channelInput,
    lookupKind: parsed.kind,
    lookupValue: parsed.value,
    maxChannelsPerCall: MAX_CHANNELS_PER_CALL,
    maxRawPayloadBytes: MAX_RAW_PAYLOAD_BYTES,
  };

  try {
    const resp = await fetchYoutubeChannel(
      parsed.kind === "channelId"
        ? { channelId: parsed.value }
        : { handle: parsed.value },
    );

    if (!resp.item) {
      return NextResponse.json({
        mode,
        fetched: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        note: `채널을 찾을 수 없음 — ${parsed.kind}=${parsed.value}`,
        guard: { ...guardInfo, requestUrl: resp.requestUrl },
      });
    }

    const safe = isPayloadSafe(resp.item);
    if (!safe.ok) {
      return NextResponse.json({
        mode,
        fetched: 1,
        acceptedCount: 0,
        rejectedCount: 1,
        rejectedReasons: [{ reason: safe.reason ?? "unsafe payload" }],
        guard: { ...guardInfo, requestUrl: resp.requestUrl },
        note: "payload 가드 reject — insert 차단",
      });
    }

    // map 시 NOT NULL 검증 — title 누락 등은 throw → catch 에서 400
    let row: ReturnType<typeof mapYoutubeChannelToRawRow>;
    try {
      row = mapYoutubeChannelToRawRow(resp.item);
    } catch (mapErr) {
      return NextResponse.json({
        mode,
        fetched: 1,
        acceptedCount: 0,
        rejectedCount: 1,
        rejectedReasons: [
          {
            reason: mapErr instanceof Error ? mapErr.message : String(mapErr),
          },
        ],
        guard: { ...guardInfo, requestUrl: resp.requestUrl },
      });
    }

    const sample = extractYoutubeChannelSample(resp.item);

    if (mode === "preview") {
      return NextResponse.json({
        mode,
        fetched: 1,
        acceptedCount: 1,
        rejectedCount: 0,
        sample,
        rowPreview: {
          source: row.source,
          media_name: row.media_name,
          media_type: row.media_type,
          official_url: row.official_url,
          youtube_channel_url: row.youtube_channel_url,
        },
        guard: { ...guardInfo, requestUrl: resp.requestUrl },
        note: "preview OK. 확인 후 mode=insert 로 저장.",
      });
    }

    // INSERT
    const { error } = await supabase
      .from("media_sources_raw")
      .insert([row]);
    if (error) {
      return NextResponse.json(
        {
          mode,
          fetched: 1,
          inserted: 0,
          error: error.message,
          guard: { ...guardInfo, requestUrl: resp.requestUrl },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      mode,
      fetched: 1,
      inserted: 1,
      sample,
      rowPreview: {
        source: row.source,
        media_name: row.media_name,
        media_type: row.media_type,
        official_url: row.official_url,
        youtube_channel_url: row.youtube_channel_url,
      },
      guard: { ...guardInfo, requestUrl: resp.requestUrl },
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
