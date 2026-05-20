/**
 * 중앙선거관리위원회 후보자 통합검색 OpenAPI 클라이언트.
 *
 * KPOL 정책 (kpol-data-ingest-safety):
 *   - "필요한 인물만 검색 기반으로 조회" — 후보자 통합검색이 유일한 entry point
 *   - bulk 수집·과거 데이터 유입 금지 — 가드는 route 레이어가 담당
 *
 * 확정 endpoint (2026-05 사용자 확인):
 *   BASE_URL  = https://apis.data.go.kr/9760000/CndaSrchService
 *   OPERATION = getCndaSrchInqire
 *
 * env (서버 전용 — NEXT_PUBLIC_ ✗):
 *   NEC_API_KEY          공공데이터포털 serviceKey
 *   NEC_BASE_URL         (선택) base path 오버라이드
 *   NEC_SEARCH_OPERATION (선택) operation 이름 오버라이드
 */

const BASE_URL =
  process.env.NEC_BASE_URL ?? "https://apis.data.go.kr/9760000/CndaSrchService";
const SEARCH_OPERATION =
  process.env.NEC_SEARCH_OPERATION ?? "getCndaSrchInqire";

/** 후보자 통합검색 파라미터 — name 이 기본, 나머지는 추가 필터. */
export interface NecCandidateSearchParams {
  /** 후보자명 (KPOL 기본 검색 기준) */
  name?: string;
  /** 선거 ID (선택 추가 필터) */
  sgId?: string;
  /** 선거 종류 코드 (선택 추가 필터) */
  sgTypecode?: string;
  /** 정당명 (선택) */
  jdName?: string;
  /** 시도명 (선택) */
  sdName?: string;
  /** 구시군명 (선택) */
  wiwName?: string;
  /** 페이지 크기 — route 가드에서 기본 10, 상한 10 */
  numOfRows?: number;
  /** 페이지 번호 */
  pageNo?: number;
}

export interface NecRawCandidate {
  [key: string]: unknown;
}

export interface NecRawResponse {
  items: NecRawCandidate[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
  raw: unknown;
  /** 호출에 사용된 URL (source_url 저장 / 디버깅) — serviceKey 는 마스킹 */
  requestUrl: string;
}

function maskUrl(u: URL): string {
  const clone = new URL(u.toString());
  if (clone.searchParams.has("serviceKey")) {
    clone.searchParams.set("serviceKey", "***");
  }
  return clone.toString();
}

function parseNecResponse(
  json: Record<string, unknown>,
  params: { pageNo?: number; numOfRows?: number },
  requestUrl: string,
): NecRawResponse {
  const body = ((json?.response as Record<string, unknown>)?.body ?? {}) as Record<
    string,
    unknown
  >;
  const itemsContainer = body?.items as Record<string, unknown> | undefined;
  const rawItems = (itemsContainer?.item ?? []) as
    | NecRawCandidate
    | NecRawCandidate[];
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return {
    items,
    totalCount: Number(body?.totalCount ?? items.length),
    pageNo: Number(body?.pageNo ?? params.pageNo ?? 1),
    numOfRows: Number(body?.numOfRows ?? params.numOfRows ?? 10),
    raw: json,
    requestUrl,
  };
}

/**
 * 후보자 통합검색 — getCndaSrchInqire.
 * KPOL 유일한 NEC entry point. 이름 기반이 기본, sgId/jdName 등은 추가 필터.
 */
export async function fetchNecCandidateSearch(
  params: NecCandidateSearchParams = {},
): Promise<NecRawResponse> {
  const apiKey = process.env.NEC_API_KEY;
  if (!apiKey) {
    throw new Error("NEC_API_KEY 환경 변수가 설정되어 있지 않습니다.");
  }

  const url = new URL(`${BASE_URL}/${SEARCH_OPERATION}`);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("numOfRows", String(params.numOfRows ?? 10));
  url.searchParams.set("pageNo", String(params.pageNo ?? 1));
  url.searchParams.set("_type", "json");
  if (params.name) url.searchParams.set("name", params.name);
  if (params.sgId) url.searchParams.set("sgId", params.sgId);
  if (params.sgTypecode) url.searchParams.set("sgTypecode", params.sgTypecode);
  if (params.jdName) url.searchParams.set("jdName", params.jdName);
  if (params.sdName) url.searchParams.set("sdName", params.sdName);
  if (params.wiwName) url.searchParams.set("wiwName", params.wiwName);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `NEC search HTTP ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  const json = (await res.json()) as Record<string, unknown>;
  return parseNecResponse(json, params, maskUrl(url));
}

/**
 * NEC 응답 1건 → election_candidates_raw row.
 * context.sgId/sgTypecode 가 없으면 item 자체에서 추출 시도.
 */
export function mapNecCandidateToRawRow(
  item: NecRawCandidate,
  context: { sgId?: string; sgTypecode?: string } = {},
) {
  const itemSgId =
    typeof item.sgId === "string" || typeof item.sgId === "number"
      ? String(item.sgId)
      : null;
  const itemSgTypecode =
    typeof item.sgTypecode === "string" || typeof item.sgTypecode === "number"
      ? String(item.sgTypecode)
      : null;
  return {
    source: "NEC",
    election_id: context.sgId ?? itemSgId ?? null,
    election_type_code: context.sgTypecode ?? itemSgTypecode ?? null,
    candidate_id: (item.huboid ?? item.candidateId ?? null) as string | null,
    candidate_name: (item.name ?? item.candidateName ?? null) as string | null,
    party_name: (item.jdName ?? item.partyName ?? null) as string | null,
    district_name: (item.sggName ?? item.districtName ?? null) as
      | string
      | null,
    city_name: (item.sdName ?? item.cityName ?? null) as string | null,
    career: (item.career ?? null) as string | null,
    education: (item.edu ?? item.education ?? null) as string | null,
    registration_status: (item.status ?? null) as string | null,
    raw_payload: item,
  };
}
