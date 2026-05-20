import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  MediaProgram,
  MediaProgramHost,
  MediaProgramPanelist,
  MediaProgramPersonLink,
  MediaProgramChannelStats,
  MediaProgramDailyRanking,
  MediaProgramRecentVideo,
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

    // 최신 일일 랭킹 (전날 조회수)
    let daily_ranking: MediaProgramDailyRanking | null = null;
    {
      const { data: drRows } = await supabase
        .from("media_program_daily_rankings")
        .select(
          "program_id, snapshot_date, previous_day_view_count, rank, rank_delta, recent_video_count, recent_window_days, formula_version",
        )
        .eq("program_id", id)
        .order("snapshot_date", { ascending: false })
        .limit(1);
      if (drRows && drRows.length > 0) {
        daily_ranking = drRows[0] as MediaProgramDailyRanking;
      }
    }

    // 최근 영상 리스트 (최신 snapshot_date 기준 channel 영상, 14일 이내)
    let recent_videos: MediaProgramRecentVideo[] | null = null;
    if (program.youtube_channel_id) {
      const { data: latestDateRow } = await supabase
        .from("youtube_video_daily_snapshots")
        .select("snapshot_date")
        .eq("channel_id", program.youtube_channel_id)
        .order("snapshot_date", { ascending: false })
        .limit(1);
      const latestSnapDate =
        latestDateRow && latestDateRow.length > 0
          ? (latestDateRow[0].snapshot_date as string)
          : null;
      if (latestSnapDate) {
        // 오늘 snapshot + 어제 snapshot 동시 로드
        const [todaySel, ydaySel] = await Promise.all([
          supabase
            .from("youtube_video_daily_snapshots")
            .select(
              "video_id, title, published_at, cumulative_view_count, cumulative_like_count, cumulative_comment_count, snapshot_date",
            )
            .eq("channel_id", program.youtube_channel_id)
            .eq("snapshot_date", latestSnapDate)
            .order("cumulative_view_count", {
              ascending: false,
              nullsFirst: false,
            })
            .limit(30),
          supabase
            .from("youtube_video_daily_snapshots")
            .select("video_id, cumulative_view_count")
            .eq("channel_id", program.youtube_channel_id)
            .lt("snapshot_date", latestSnapDate)
            .order("snapshot_date", { ascending: false })
            .limit(200),
        ]);
        const ydayMap = new Map<string, number>();
        for (const r of (ydaySel.data ?? []) as {
          video_id: string;
          cumulative_view_count: number | null;
        }[]) {
          if (r.cumulative_view_count != null && !ydayMap.has(r.video_id)) {
            ydayMap.set(r.video_id, r.cumulative_view_count);
          }
        }
        recent_videos = ((todaySel.data ?? []) as Array<{
          video_id: string;
          title: string | null;
          published_at: string | null;
          cumulative_view_count: number | null;
          cumulative_like_count: number | null;
          cumulative_comment_count: number | null;
          snapshot_date: string;
        }>).map((v) => {
          const today = v.cumulative_view_count;
          const yest = ydayMap.get(v.video_id) ?? null;
          const delta =
            today != null && yest != null ? Math.max(0, today - yest) : null;
          return {
            video_id: v.video_id,
            title: v.title,
            published_at: v.published_at,
            cumulative_view_count: today,
            cumulative_like_count: v.cumulative_like_count,
            cumulative_comment_count: v.cumulative_comment_count,
            yesterday_view_count: yest,
            daily_view_delta: delta,
            snapshot_date: v.snapshot_date,
          };
        });
      }
    }

    return NextResponse.json({
      ...program,
      hosts,
      panelists,
      person_links,
      channel,
      daily_ranking,
      recent_videos,
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
