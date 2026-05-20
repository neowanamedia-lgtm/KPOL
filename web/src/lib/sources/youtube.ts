/**
 * YouTube Data API v3 client.
 *
 * KPOL 정책 (kpol-data-ingest-safety, kpol-search-internal-only):
 *   - 관리자 /data-test 도구 전용. 메인 UI 노출 ✗.
 *   - 개별 채널 lookup (channels.list, 1 unit) + 정치·시사 후보군 검색 (search.list, 100 unit).
 *   - search.list 는 비싸므로 1회 호출 keyword 수·결과 수 모두 가드로 제한 (route 레이어).
 *   - 정치·시사 한정. AI 임의 판정 ✗ — title/description 의 keyword string match 만.
 *
 * env (서버 전용 — NEXT_PUBLIC_ ✗):
 *   YOUTUBE_API_KEY=AIzaSy...  (Google Cloud Console 발급)
 *   YOUTUBE_BASE_URL=...       (선택, 기본 https://www.googleapis.com/youtube/v3)
 *
 * quota:
 *   - channels.list = 1 unit/call (parts 다중·id 다중에도 1 unit)
 *   - search.list   = 100 units/call → 일일 10,000 ⇒ 사실상 ~100회 한도
 */

const BASE_URL =
  process.env.YOUTUBE_BASE_URL ?? "https://www.googleapis.com/youtube/v3";

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

export type YoutubeLookupKind = "channelId" | "handle";

export interface YoutubeChannelLookup {
  channelId?: string;
  handle?: string;
}

export interface YoutubeThumbnail {
  url?: string;
  width?: number;
  height?: number;
}

export interface YoutubeChannelItem {
  id?: string;
  etag?: string;
  kind?: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    publishedAt?: string;
    thumbnails?: {
      default?: YoutubeThumbnail;
      medium?: YoutubeThumbnail;
      high?: YoutubeThumbnail;
    };
    country?: string;
    [key: string]: unknown;
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
    [key: string]: unknown;
  };
  brandingSettings?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface YoutubeChannelResponse {
  /** items[0] — channels.list 의 첫 채널. 조회 실패 시 null */
  item: YoutubeChannelItem | null;
  /** 사용된 input 형태 */
  lookupKind: YoutubeLookupKind;
  /** key 마스킹된 요청 URL */
  requestUrl: string;
  /** 원본 응답 JSON */
  raw: unknown;
  /** 디버깅용 — 응답 items 길이 */
  itemCount: number;
}

function maskUrl(u: URL): string {
  const clone = new URL(u.toString());
  if (clone.searchParams.has("key")) clone.searchParams.set("key", "***");
  return clone.toString();
}

/**
 * 입력 문자열을 channelId / handle 로 정규화.
 * - "UC" + 22자 → channelId
 * - "@xxx" 또는 "https://www.youtube.com/@xxx" → handle (앞에 @ 보존)
 * - 그 외 → 미지원 (custom URL / 모호한 입력)
 */
export function parseYoutubeChannelInput(
  raw: string,
): { kind: YoutubeLookupKind; value: string } | { error: string } {
  const s = raw.trim();
  if (!s) return { error: "입력이 비어있습니다." };

  // URL 형태에서 핵심부 추출
  let core = s;
  const urlMatch = s.match(
    /^https?:\/\/(?:www\.)?youtube\.com\/(?:(channel\/[A-Za-z0-9_-]+)|(@[^/?#]+))/i,
  );
  if (urlMatch) {
    core = urlMatch[1]
      ? urlMatch[1].replace(/^channel\//, "")
      : urlMatch[2];
  }

  if (CHANNEL_ID_RE.test(core)) {
    return { kind: "channelId", value: core };
  }
  if (core.startsWith("@") && core.length >= 2) {
    return { kind: "handle", value: core };
  }
  if (/^[A-Za-z0-9._-]+$/.test(core) && !core.startsWith("UC")) {
    return {
      error:
        "custom URL / 단일 이름은 1차 미지원 — channel ID (UCxxx) 또는 @handle 만 입력하세요.",
    };
  }
  return { error: `인식 불가 입력: ${s}` };
}

/**
 * YouTube channels.list 호출 — 1개 채널.
 * part=snippet,statistics,brandingSettings (1 unit).
 */
export async function fetchYoutubeChannel(
  lookup: YoutubeChannelLookup,
): Promise<YoutubeChannelResponse> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY 환경 변수가 설정되어 있지 않습니다.");
  }

  let lookupKind: YoutubeLookupKind;
  const url = new URL(`${BASE_URL}/channels`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet,statistics,brandingSettings");
  url.searchParams.set("maxResults", "1");

  if (lookup.channelId) {
    if (!CHANNEL_ID_RE.test(lookup.channelId)) {
      throw new Error(
        `channelId 형식 오류: ${lookup.channelId} (UC + 22자 alnum/_/- 필요)`,
      );
    }
    url.searchParams.set("id", lookup.channelId);
    lookupKind = "channelId";
  } else if (lookup.handle) {
    const h = lookup.handle.startsWith("@")
      ? lookup.handle
      : `@${lookup.handle}`;
    url.searchParams.set("forHandle", h);
    lookupKind = "handle";
  } else {
    throw new Error("channelId 또는 handle 중 하나 필수.");
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `YouTube API HTTP ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  const json = (await res.json()) as Record<string, unknown>;
  const itemsRaw = json.items as unknown[] | undefined;
  const items = Array.isArray(itemsRaw) ? (itemsRaw as YoutubeChannelItem[]) : [];

  return {
    item: items[0] ?? null,
    lookupKind,
    requestUrl: maskUrl(url),
    raw: json,
    itemCount: items.length,
  };
}

/**
 * channels.list items[0] → media_sources_raw row.
 * - media_name 은 snippet.title (없으면 throw — NOT NULL 제약).
 * - raw_payload 는 item 전체 (snippet+statistics+brandingSettings).
 */
export function mapYoutubeChannelToRawRow(item: YoutubeChannelItem) {
  const id = item.id;
  if (!id) {
    throw new Error("YouTube response items[0].id 누락 — insert 차단");
  }
  const title = item.snippet?.title?.trim();
  if (!title) {
    throw new Error("YouTube response items[0].snippet.title 누락 — insert 차단");
  }
  const customUrl = item.snippet?.customUrl ?? null;
  const officialUrl = `https://www.youtube.com/channel/${id}`;
  const ytChannelUrl =
    customUrl && customUrl.length > 0
      ? `https://www.youtube.com/${customUrl.replace(/^\/+/, "")}`
      : officialUrl;

  return {
    source: "YOUTUBE_API",
    media_name: title,
    media_type: "youtube_channel",
    official_url: officialUrl,
    youtube_channel_url: ytChannelUrl,
    raw_payload: item,
  };
}

/**
 * 1차 수집 대상 필드를 raw_payload 에서 뽑아 preview 표시용 sample 로 정리.
 * 저장은 raw_payload 통째로 됨 — sample 은 UI 가독성 전용.
 */
export function extractYoutubeChannelSample(item: YoutubeChannelItem) {
  const t = item.snippet?.thumbnails;
  const thumbnail =
    (t?.high?.url && t.high.url.length > 0 ? t.high.url : null) ??
    (t?.medium?.url && t.medium.url.length > 0 ? t.medium.url : null) ??
    (t?.default?.url && t.default.url.length > 0 ? t.default.url : null) ??
    null;
  return {
    channel_id: item.id ?? null,
    title: item.snippet?.title ?? null,
    custom_url: item.snippet?.customUrl ?? null,
    description: item.snippet?.description ?? null,
    published_at: item.snippet?.publishedAt ?? null,
    thumbnail_high: thumbnail,
    subscriber_count: item.statistics?.subscriberCount ?? null,
    hidden_subscriber_count: item.statistics?.hiddenSubscriberCount ?? false,
    video_count: item.statistics?.videoCount ?? null,
    view_count: item.statistics?.viewCount ?? null,
    country: item.snippet?.country ?? null,
  };
}

// ──────────────────────────────────────────────────────────────────────
// 정치·시사 후보군 검색 (search.list)
// ──────────────────────────────────────────────────────────────────────

/** 1차 정치·시사 키워드 화이트리스트. route 에서 사용자가 일부 선택해 호출. */
export const POLITICAL_KEYWORDS_DEFAULT: readonly string[] = [
  "정치",
  "시사",
  "국회",
  "선거",
  "정당",
  "대통령",
  "보수",
  "진보",
  "뉴스 정치",
  "정치 유튜브",
  "의원",
  "의회",
  "정책",
  "시국",
  "외교",
  "안보",
  "토론",
  "여당",
  "야당",
  "정부",
];

/** 명백히 정치·시사 외 분야로 분류하는 anti-keyword 리스트. */
export const ANTI_KEYWORDS: readonly string[] = [
  // 엔터테인먼트
  "예능",
  "음악",
  "노래",
  "케이팝",
  "K-POP",
  "kpop",
  "K팝",
  "댄스",
  "아이돌",
  "연예",
  "드라마",
  "영화",
  "웹툰",
  "만화",
  "애니메이션",
  "애니",
  // 게임 / 키즈
  "게임",
  "롤플레잉",
  "롤 ",
  "키즈",
  "어린이",
  "장난감",
  // 음식 / 일상
  "먹방",
  "요리",
  "레시피",
  "분식",
  "맛집",
  "vlog",
  "Vlog",
  "VLOG",
  "브이로그",
  "일상",
  "데일리",
  "ASMR",
  "asmr",
  // 스포츠
  "스포츠",
  "축구",
  "야구",
  "농구",
  "골프",
  "헬스",
  "다이어트",
  "운동",
  // 종교 / 쇼핑 / 라이프
  "종교",
  "교회",
  "찬양",
  "설교",
  "기도",
  "쇼핑",
  "리뷰",
  "언박싱",
  "패션",
  "뷰티",
  "메이크업",
  "룩북",
  "헤어",
  // 여행 / 차
  "여행",
  "자동차",
  "차박",
  "낚시",
  "캠핑",
  // 자기계발 / 잡담
  "꿀팁",
  "자기계발",
];

export interface YoutubeSearchItem {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  channelTitle: string;
  /** 원본 snippet 그대로 (저장 ✗, route 응답엔 미포함) */
  rawSnippet: Record<string, unknown>;
}

export interface YoutubeSearchResponse {
  query: string;
  items: YoutubeSearchItem[];
  totalResults: number;
  requestUrl: string;
  raw: unknown;
}

/**
 * search.list — 단일 키워드 검색. type=channel, regionCode=KR, relevanceLanguage=ko.
 * 1 호출 = 100 quota units. route 에서 keyword 수 가드 필수.
 */
export async function searchYoutubeChannels(params: {
  q: string;
  maxResults?: number; // default 5, 안전 상한 10
}): Promise<YoutubeSearchResponse> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY 환경 변수가 설정되어 있지 않습니다.");
  }
  const q = params.q.trim();
  if (!q) throw new Error("검색 키워드(q) 가 비어있습니다.");

  let maxResults = params.maxResults ?? 5;
  if (!Number.isFinite(maxResults) || maxResults < 1) maxResults = 5;
  if (maxResults > 10) maxResults = 10;

  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "channel");
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("regionCode", "KR");
  url.searchParams.set("relevanceLanguage", "ko");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `YouTube search HTTP ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  const json = (await res.json()) as Record<string, unknown>;
  const itemsRaw = (json.items as unknown[] | undefined) ?? [];
  const items: YoutubeSearchItem[] = [];
  for (const raw of itemsRaw) {
    const it = raw as Record<string, unknown>;
    const idObj = it.id as Record<string, unknown> | undefined;
    const snippet = it.snippet as Record<string, unknown> | undefined;
    const channelId =
      (typeof idObj?.channelId === "string" ? idObj.channelId : null) ??
      (typeof snippet?.channelId === "string" ? snippet.channelId : null);
    if (!channelId || !CHANNEL_ID_RE.test(channelId)) continue;
    const title =
      (typeof snippet?.title === "string" ? snippet.title : null) ?? "";
    const description =
      (typeof snippet?.description === "string" ? snippet.description : "") ??
      "";
    const thumbs = (snippet?.thumbnails ?? {}) as Record<string, unknown>;
    const high = thumbs.high as { url?: string } | undefined;
    const med = thumbs.medium as { url?: string } | undefined;
    const def = thumbs.default as { url?: string } | undefined;
    const thumbnailUrl = high?.url ?? med?.url ?? def?.url ?? null;
    const publishedAt =
      typeof snippet?.publishedAt === "string" ? snippet.publishedAt : null;
    const channelTitle =
      (typeof snippet?.channelTitle === "string"
        ? snippet.channelTitle
        : null) ?? title;
    items.push({
      channelId,
      title,
      description,
      thumbnailUrl,
      publishedAt,
      channelTitle,
      rawSnippet: snippet ?? {},
    });
  }

  const pageInfo = json.pageInfo as Record<string, unknown> | undefined;
  return {
    query: q,
    items,
    totalResults: Number(pageInfo?.totalResults ?? items.length),
    requestUrl: maskUrl(url),
    raw: json,
  };
}

export type ChannelClassification =
  | "candidate"
  | "review_needed"
  | "rejected_anti";

export interface ClassifiedChannel {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  matchedKeywords: string[];
  matchedAntiKeywords: string[];
  category: ChannelClassification;
  /** 매치 정보를 evidence 로 보존 — log/save 용 */
  matchEvidence: {
    title_lc: string;
    description_lc: string;
  };
}

/**
 * 키워드 string match 기반 분류. AI 판정 ✗.
 *
 * rule:
 *   1) anti-keyword 가 title 또는 description 에 1개 이상 매치 → rejected_anti
 *   2) positive keyword 가 1개 이상 매치 AND anti 없음 → candidate
 *   3) 그 외 (positive/anti 모두 없음) → review_needed
 *
 * 대소문자 무시 (toLowerCase). 한글은 영향 없고 영문 anti (예: K-POP) 만 효과.
 */
export function classifyChannelByKeywords(
  ch: { title: string; description: string },
  positiveKeywords: readonly string[],
  antiKeywords: readonly string[] = ANTI_KEYWORDS,
): {
  category: ChannelClassification;
  matchedKeywords: string[];
  matchedAntiKeywords: string[];
} {
  const titleLc = (ch.title ?? "").toLowerCase();
  const descLc = (ch.description ?? "").toLowerCase();
  const corpus = `${titleLc}\n${descLc}`;

  const matchedAnti: string[] = [];
  for (const k of antiKeywords) {
    if (!k) continue;
    if (corpus.includes(k.toLowerCase())) matchedAnti.push(k);
  }
  const matched: string[] = [];
  for (const k of positiveKeywords) {
    if (!k) continue;
    if (corpus.includes(k.toLowerCase())) matched.push(k);
  }

  let category: ChannelClassification;
  if (matchedAnti.length > 0) {
    category = "rejected_anti";
  } else if (matched.length > 0) {
    category = "candidate";
  } else {
    category = "review_needed";
  }
  return {
    category,
    matchedKeywords: matched,
    matchedAntiKeywords: matchedAnti,
  };
}

// ──────────────────────────────────────────────────────────────────────
// channels.list batch (id 다중 — 1 unit 총합)
// ──────────────────────────────────────────────────────────────────────

export interface YoutubeChannelsBatchResponse {
  items: YoutubeChannelItem[];
  requestUrl: string;
  raw: unknown;
}

/**
 * channels.list with id=a,b,c — 최대 50개까지 1 unit. route 는 가드로 더 좁힘.
 */
export async function fetchYoutubeChannelsBatch(
  channelIds: string[],
): Promise<YoutubeChannelsBatchResponse> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY 환경 변수가 설정되어 있지 않습니다.");
  }
  const cleaned: string[] = [];
  for (const id of channelIds) {
    const t = id?.trim();
    if (t && CHANNEL_ID_RE.test(t) && !cleaned.includes(t)) cleaned.push(t);
  }
  if (cleaned.length === 0) {
    throw new Error("유효한 channel ID 가 하나도 없습니다.");
  }
  if (cleaned.length > 50) {
    throw new Error("channels.list 1회 호출 50개 초과 — route 가드 위반");
  }

  const url = new URL(`${BASE_URL}/channels`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet,statistics,brandingSettings");
  url.searchParams.set("id", cleaned.join(","));
  url.searchParams.set("maxResults", String(cleaned.length));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `YouTube channels.list HTTP ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  const json = (await res.json()) as Record<string, unknown>;
  const itemsRaw = (json.items as unknown[] | undefined) ?? [];
  const items = itemsRaw.filter(
    (it): it is YoutubeChannelItem =>
      typeof it === "object" && it != null && "id" in (it as object),
  ) as YoutubeChannelItem[];
  return { items, requestUrl: maskUrl(url), raw: json };
}
