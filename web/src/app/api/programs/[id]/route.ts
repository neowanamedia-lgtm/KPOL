import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  MediaProgram,
  MediaProgramHost,
  MediaProgramPanelist,
  MediaProgramPersonLink,
  MediaProgramChannelStats,
} from "@/lib/programs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 프로그램 상세 (public read).
 *
 * GET /api/programs/{id}
 *
 * 응답 = program + hosts + panelists + person_links + channel(optional).
 *
 * channel:
 *   - program.youtube_channel_id 가 있으면 media_sources_raw 최신 1건 join
 *   - YouTube channels.list 의 snippet/statistics 에서 표시용 필드 추출
 *   - 누적 지표 — 1차 랭킹 기준은 추후 "최근 2주 영상" 으로 이동 (kpol-data-ingest-safety v2)
 *
 * person_links: 최신 50 (appearance_date desc, created_at desc).
 */

const PERSON_LINKS_LIMIT = 50;

interface ChannelRawPayload {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    publishedAt?: string;
    country?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
    };
  };
  statistics?: {
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    viewCount?: string;
    videoCount?: string;
  };
}

type ThumbnailMap = NonNullable<NonNullable<ChannelRawPayload["snippet"]>["thumbnails"]>;

function pickThumbUrl(thumbs?: ThumbnailMap | null): string | null {
  if (!thumbs) return null;
  const sources = [thumbs.high, thumbs.medium, thumbs.default];
  for (const s of sources) {
    if (s && typeof s.url === "string" && s.url.length > 0) return s.url;
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return null;
  return n;
}

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

    // YouTube channel 누적 지표 (보조 정보)
    let channel: MediaProgramChannelStats | null = null;
    if (program.youtube_channel_id) {
      const { data: chRows } = await supabase
        .from("media_sources_raw")
        .select("raw_payload, fetched_at, official_url, youtube_channel_url")
        .eq("source", "YOUTUBE_API")
        .eq("media_type", "youtube_channel")
        .eq("raw_payload->>id", program.youtube_channel_id)
        .order("fetched_at", { ascending: false })
        .limit(1);
      if (chRows && chRows.length > 0) {
        const row = chRows[0] as {
          raw_payload: ChannelRawPayload | null;
          fetched_at: string;
          official_url: string | null;
          youtube_channel_url: string | null;
        };
        const rp = row.raw_payload ?? {};
        channel = {
          channel_id: program.youtube_channel_id,
          channel_title: rp.snippet?.title ?? null,
          custom_url: rp.snippet?.customUrl ?? null,
          thumbnail_url: pickThumbUrl(rp.snippet?.thumbnails) ?? null,
          subscriber_count: toNumber(rp.statistics?.subscriberCount),
          hidden_subscriber_count:
            rp.statistics?.hiddenSubscriberCount === true,
          view_count: toNumber(rp.statistics?.viewCount),
          video_count: toNumber(rp.statistics?.videoCount),
          published_at: rp.snippet?.publishedAt ?? null,
          country: rp.snippet?.country ?? null,
          official_url:
            row.official_url ??
            `https://www.youtube.com/channel/${program.youtube_channel_id}`,
          channel_fetched_at: row.fetched_at,
        };
      }
    }

    return NextResponse.json({
      ...program,
      hosts,
      panelists,
      person_links,
      channel,
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
