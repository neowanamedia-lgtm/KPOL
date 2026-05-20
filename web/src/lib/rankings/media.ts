/**
 * KPOL 미디어 랭킹 스코어 산정 — YouTube 채널 메타데이터 기반.
 *
 * 정책 (kpol-data-ingest-safety, kpol-ranking-signals):
 *   - AI 임의 평가 ✗. 실제 지표(subscriber/view/video count)만 사용.
 *   - 결정적·재현 가능 공식. 동일 입력 → 동일 출력.
 *   - 가중치·공식 버전을 evidence 에 기록해 추후 변경 시 추적 가능.
 *
 * v1 공식 (formula_version = 'media_v1'):
 *   score = W_SUB  · log10(subscriber_count + 1)
 *         + W_VIEW · log10(view_count + 1)
 *         + W_VIDEO · log10(video_count + 1)
 *
 *   가중치:
 *     W_SUB   = 0.5  (구독자 수: 1차 audience 규모)
 *     W_VIEW  = 0.3  (조회수: 누적 도달)
 *     W_VIDEO = 0.2  (영상 수: 활동성)
 *
 *   특수 처리:
 *     - statistics.hiddenSubscriberCount === true ⇒ subscriber = 0,
 *       evidence.subscribers_hidden = true 로 기록
 *     - null / 비숫자 입력 ⇒ 0 으로 안전 강등
 */

export const FORMULA_VERSION = "media_v1";

export const WEIGHTS = {
  subscriber: 0.5,
  view: 0.3,
  video: 0.2,
} as const;

export interface MediaMetricsInput {
  channelId: string;
  mediaName: string;
  customUrl: string | null;
  officialUrl: string;
  thumbnailUrl: string | null;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  subscribersHidden: boolean;
  sourceFetchedAt: string;
}

export interface MediaScoreEvidence {
  formula_version: string;
  weights: typeof WEIGHTS;
  subscriber_count: number;
  view_count: number;
  video_count: number;
  subscribers_hidden: boolean;
  components: {
    subscriber_log: number;
    view_log: number;
    video_log: number;
  };
  source_fetched_at: string;
}

export interface MediaScoreOutput {
  channelId: string;
  mediaName: string;
  customUrl: string | null;
  officialUrl: string;
  thumbnailUrl: string | null;
  score: number;
  evidence: MediaScoreEvidence;
}

function safeNumber(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function log10Plus1(n: number): number {
  // log10(n + 1) — 0 입력에서 0 반환, 음수/NaN 방어
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.log10(n + 1);
}

/** 단일 채널 메트릭을 score 로 환산. evidence 동봉. */
export function calculateMediaScore(input: MediaMetricsInput): MediaScoreOutput {
  const sub = safeNumber(input.subscribersHidden ? 0 : input.subscriberCount);
  const view = safeNumber(input.viewCount);
  const video = safeNumber(input.videoCount);

  const subLog = log10Plus1(sub);
  const viewLog = log10Plus1(view);
  const videoLog = log10Plus1(video);

  const score =
    WEIGHTS.subscriber * subLog +
    WEIGHTS.view * viewLog +
    WEIGHTS.video * videoLog;

  return {
    channelId: input.channelId,
    mediaName: input.mediaName,
    customUrl: input.customUrl,
    officialUrl: input.officialUrl,
    thumbnailUrl: input.thumbnailUrl,
    score: Number(score.toFixed(6)),
    evidence: {
      formula_version: FORMULA_VERSION,
      weights: WEIGHTS,
      subscriber_count: sub,
      view_count: view,
      video_count: video,
      subscribers_hidden: input.subscribersHidden,
      components: {
        subscriber_log: Number(subLog.toFixed(6)),
        view_log: Number(viewLog.toFixed(6)),
        video_log: Number(videoLog.toFixed(6)),
      },
      source_fetched_at: input.sourceFetchedAt,
    },
  };
}

/** media_sources_raw row 의 raw_payload (YouTube channels.list items[0]) 에서 메트릭 추출. */
export function extractMetricsFromRawPayload(
  rawPayload: unknown,
  fallback: {
    mediaName: string;
    officialUrl: string | null;
    youtubeChannelUrl: string | null;
    fetchedAt: string;
  },
): MediaMetricsInput | { error: string } {
  if (!rawPayload || typeof rawPayload !== "object") {
    return { error: "raw_payload 가 비어있거나 객체가 아님" };
  }
  const item = rawPayload as Record<string, unknown>;
  const channelId =
    typeof item.id === "string" || typeof item.id === "number"
      ? String(item.id)
      : null;
  if (!channelId) {
    return { error: "raw_payload.id (channel_id) 누락" };
  }

  const snippet = (item.snippet ?? {}) as Record<string, unknown>;
  const statistics = (item.statistics ?? {}) as Record<string, unknown>;

  const customUrl =
    typeof snippet.customUrl === "string" ? snippet.customUrl : null;
  const thumbs = (snippet.thumbnails ?? {}) as Record<string, unknown>;
  // high → medium → default 순으로 url 이 실제 있는 첫 항목 사용 (object 만 있고 url 빈 케이스 fall-through).
  const pickThumbUrl = (t: unknown): string | null => {
    if (!t || typeof t !== "object") return null;
    const url = (t as { url?: unknown }).url;
    return typeof url === "string" && url.length > 0 ? url : null;
  };
  const thumbnailUrl =
    pickThumbUrl(thumbs.high) ??
    pickThumbUrl(thumbs.medium) ??
    pickThumbUrl(thumbs.default) ??
    null;

  return {
    channelId,
    mediaName: fallback.mediaName,
    customUrl,
    officialUrl:
      fallback.officialUrl ?? `https://www.youtube.com/channel/${channelId}`,
    thumbnailUrl,
    subscriberCount: safeNumber(statistics.subscriberCount),
    viewCount: safeNumber(statistics.viewCount),
    videoCount: safeNumber(statistics.videoCount),
    subscribersHidden:
      statistics.hiddenSubscriberCount === true,
    sourceFetchedAt: fallback.fetchedAt,
  };
}

/**
 * 여러 score 결과를 desc 정렬해 rank(1..N) + scoreNormalized(0..100) 부여.
 * scoreNormalized 는 현재 배치 내 max score 대비 상대값 (top = 100).
 * 동점은 입력 순.
 */
export function assignRanks(
  scores: MediaScoreOutput[],
): (MediaScoreOutput & { rank: number; scoreNormalized: number })[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const maxScore = sorted[0]?.score ?? 0;
  return sorted.map((s, i) => ({
    ...s,
    rank: i + 1,
    scoreNormalized:
      maxScore > 0 ? Number(((s.score / maxScore) * 100).toFixed(2)) : 0,
  }));
}

/**
 * 한국 큰 숫자 포맷 — 1.2만 / 250.3만 / 1.5억.
 * - opts.hidden=true → '비공개'
 * - 음수/NaN → '-'
 * - 0 → '0'
 */
export function formatKoreanCount(
  n: number,
  opts: { hidden?: boolean } = {},
): string {
  if (opts.hidden) return "비공개";
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n === 0) return "0";
  if (n >= 100000000) {
    const v = n / 100000000;
    return `${v >= 100 ? Math.floor(v) : v >= 10 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/\.?0+$/, "")}억`;
  }
  if (n >= 10000) {
    const v = n / 10000;
    return `${v >= 100 ? Math.floor(v) : v >= 10 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/\.?0+$/, "")}만`;
  }
  return n.toLocaleString("ko-KR");
}

/**
 * 채널 metrics 를 1줄 description 으로. 누락 필드는 생략 — 깔끔한 표시.
 */
export function describeMediaMetrics(evidence: MediaScoreEvidence): string | null {
  const parts: string[] = [];
  if (evidence.subscribers_hidden || evidence.subscriber_count > 0) {
    parts.push(
      `구독자 ${formatKoreanCount(evidence.subscriber_count, { hidden: evidence.subscribers_hidden })}`,
    );
  }
  if (evidence.video_count > 0) {
    parts.push(`영상 ${formatKoreanCount(evidence.video_count)}`);
  }
  if (evidence.view_count > 0) {
    parts.push(`누적조회 ${formatKoreanCount(evidence.view_count)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
