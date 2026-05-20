import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { MediaProgram } from "@/lib/programs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 미디어 TOP100 — media_sources_raw.raw_payload (= 이전 channels.list 응답) 기반.
 *
 * 핵심 룰:
 *   - 정렬: Number(subscriberCount) DESC. localeCompare/문자열/fallback 금지.
 *   - 필터: hidden=true / null / 비숫자 / 0 제외.
 *   - limit: 기본 50, max 200. MediaPane=100.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MIN_SUBSCRIBER = 1000;

interface ProgramListItem
  extends Pick<
    MediaProgram,
    "id" | "title" | "broadcaster" | "channel_name" | "active_status"
  > {
  youtube_channel_id: string | null;
  thumbnail_url: string | null;
  subscriber_count: number;
  rank_change: number | null;
}

interface RawRow {
  id: string;
  channel_id: string | null;
  media_name: string;
  raw_payload: unknown;
}

function extractSubscriberCount(rp: unknown): number | null {
  if (!rp || typeof rp !== "object") return null;
  const stats = (rp as { statistics?: Record<string, unknown> }).statistics;
  if (!stats) return null;
  if (stats.hiddenSubscriberCount === true) return null;
  const raw = stats.subscriberCount;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractThumbnail(rp: unknown): string | null {
  if (!rp || typeof rp !== "object") return null;
  const snippet = (rp as { snippet?: Record<string, unknown> }).snippet;
  const thumbs = (snippet?.thumbnails ?? {}) as Record<
    string,
    { url?: string } | undefined
  >;
  return (
    thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null
  );
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase env not set", programs: [] },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  let limit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const { data, error } = await supabase
    .from("media_sources_raw")
    .select("id, channel_id, media_name, raw_payload")
    .eq("source", "YOUTUBE_API")
    .in("status", ["candidate", "confirmed"]);

  if (error) {
    return NextResponse.json(
      { error: error.message, programs: [] },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as RawRow[];
  const candidates: ProgramListItem[] = [];
  for (const r of rows) {
    const sub = extractSubscriberCount(r.raw_payload);
    if (sub == null || sub < MIN_SUBSCRIBER) continue;
    candidates.push({
      id: r.id,
      title: r.media_name,
      broadcaster: null,
      channel_name: null,
      active_status: "active",
      youtube_channel_id: r.channel_id,
      thumbnail_url: extractThumbnail(r.raw_payload),
      subscriber_count: sub,
      rank_change: null,
    });
  }

  candidates.sort((a, b) => b.subscriber_count - a.subscriber_count);
  const programs = candidates.slice(0, limit);

  return NextResponse.json({ count: programs.length, programs });
}
