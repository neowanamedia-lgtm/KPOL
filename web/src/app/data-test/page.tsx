"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { YoutubeSection } from "./YoutubeSection";
import { YoutubeCandidateSection } from "./YoutubeCandidateSection";
import { MediaRankingSection } from "./MediaRankingSection";
import { ProgramsAdminSection } from "./ProgramsAdminSection";

/**
 * /data-test — KPOL 내부 데이터 연결 검증 페이지.
 *
 * 이 페이지는 메인 KPOL UX 와 무관한 admin 전용 화면이다.
 * 메인 Shell.tsx 의 색·간격·카드 톤을 강제 모방하지 않으며,
 * 데이터 흐름(검색→preview→선택→insert) 자체를 빠르게 확인하는 용도.
 *
 * TODO (사용자 검토 후 마이그레이션 필요):
 *  - duplicate insert 방지: election_candidates_raw 에 unique (source, candidate_id, election_id) 추가
 *  - upsert 전략: onConflict 로 latest 만 유지 + updated_at 컬럼
 *  - 오래된 raw row cleanup: 14d/30d 기준 삭제 job
 *  현재는 안전을 위해 그냥 insert 만 수행. 같은 후보를 두 번 insert 하면 중복 row 가 쌓일 수 있음.
 */

interface CountRow {
  table: string;
  count: number | null;
  error: string | null;
}

interface PreviewSample {
  idx: number;
  candidate_name: string | null;
  party_name: string | null;
  district_name: string | null;
  election_id: string | null;
}

interface RejectedReason {
  reason: string;
  sample?: unknown;
}

interface GuardInfo {
  candidateName?: string | null;
  sgId?: string | null;
  sgTypecode?: string | null;
  pageNo?: number;
  numOfRows?: number;
  maxInsertPerCall?: number;
  maxRawPayloadBytes?: number;
  requiredYear?: string;
  requestUrl?: string;
}

interface PreviewResponse {
  mode: string;
  fetched: number;
  acceptedCount: number;
  rejectedCount: number;
  acceptedSamples: PreviewSample[];
  rejectedReasons: RejectedReason[];
  totalCount: number;
  note?: string;
  guard?: GuardInfo;
  error?: string;
}

interface InsertResponse {
  mode?: string;
  fetched?: number;
  inserted?: number;
  rejected?: number;
  selected?: number[] | null;
  skippedBySelect?: number;
  rejectedReasons?: RejectedReason[];
  totalCount?: number;
  guard?: GuardInfo;
  note?: string;
  error?: string;
}

interface RecentRow {
  candidate_name: string | null;
  party_name: string | null;
  district_name: string | null;
  election_id: string | null;
  fetched_at: string | null;
  source: string | null;
}

const RAW_TABLES = [
  "election_candidates_raw",
  "election_candidate_sources",
  "media_sources_raw",
  "news_mentions_raw",
  "ranking_calculation_logs",
];

const REQUIRED_YEAR = "2026";
const MAX_PER_CALL = 10;

interface SearchParams {
  candidateName: string;
  sgId: string;
  sgTypecode: string;
  jdName: string;
  sdName: string;
}

function formatTime(d: Date | null) {
  if (!d) return "";
  return d.toLocaleTimeString("ko-KR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTimestamp(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function relativeTime(d: Date | null) {
  if (!d) return "";
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 5) return "방금 전";
  if (secs < 60) return `${secs}초 전`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  return `${h}시간 전`;
}

export default function DataTestPage() {
  const [counts, setCounts] = useState<CountRow[] | null>(null);
  const [latestEcr, setLatestEcr] = useState<RecentRow[] | null>(null);
  const [latestLoading, setLatestLoading] = useState(false);
  const [adminKey, setAdminKey] = useState("");

  const [candidateName, setCandidateName] = useState("");
  const [sgId, setSgId] = useState("");
  const [sgTypecode, setSgTypecode] = useState("");
  const [jdName, setJdName] = useState("");
  const [sdName, setSdName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(
    null,
  );
  const [previewFetchedAt, setPreviewFetchedAt] = useState<Date | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<SearchParams | null>(
    null,
  );
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [insertResult, setInsertResult] = useState<InsertResponse | null>(null);
  const [insertFetchedAt, setInsertFetchedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState<"preview" | "insert" | null>(null);

  // relative-time tick — 매 15s 리렌더 (cache 비우기 없이)
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => (n + 1) % 100000), 15000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLatestLoading(true);
    const results: CountRow[] = [];
    for (const t of RAW_TABLES) {
      try {
        const { count, error } = await supabase
          .from(t)
          .select("*", { count: "exact", head: true });
        results.push({
          table: t,
          count: error ? null : count ?? 0,
          error: error?.message ?? null,
        });
      } catch (e) {
        results.push({
          table: t,
          count: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    setCounts(results);

    try {
      const { data, error } = await supabase
        .from("election_candidates_raw")
        .select(
          "candidate_name,party_name,district_name,election_id,fetched_at,source",
        )
        .order("fetched_at", { ascending: false })
        .limit(5);
      if (!error) setLatestEcr((data as RecentRow[]) ?? []);
      else setLatestEcr([]);
    } catch {
      setLatestEcr([]);
    } finally {
      setLatestLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trimmed: SearchParams = useMemo(
    () => ({
      candidateName: candidateName.trim(),
      sgId: sgId.trim(),
      sgTypecode: sgTypecode.trim(),
      jdName: jdName.trim(),
      sdName: sdName.trim(),
    }),
    [candidateName, sgId, sgTypecode, jdName, sdName],
  );

  const hasName = trimmed.candidateName.length > 0;
  const hasRegistration =
    trimmed.sgId.length > 0 && trimmed.sgTypecode.length > 0;
  const sgIdValid = !trimmed.sgId || trimmed.sgId.startsWith(REQUIRED_YEAR);

  useEffect(() => {
    if (
      previewSnapshot &&
      (previewSnapshot.candidateName !== trimmed.candidateName ||
        previewSnapshot.sgId !== trimmed.sgId ||
        previewSnapshot.sgTypecode !== trimmed.sgTypecode ||
        previewSnapshot.jdName !== trimmed.jdName ||
        previewSnapshot.sdName !== trimmed.sdName)
    ) {
      setPreviewResult(null);
      setPreviewSnapshot(null);
      setPreviewFetchedAt(null);
      setSelectedIdx(new Set());
      setInsertResult(null);
      setInsertFetchedAt(null);
    }
  }, [trimmed, previewSnapshot]);

  const previewBlockReason = useMemo(() => {
    if (!adminKey) return "admin key 필요";
    if (!hasName && !hasRegistration) {
      return "candidateName 입력 필요";
    }
    if (!sgIdValid) return `sgId 는 ${REQUIRED_YEAR} 으로 시작해야 함`;
    if (hasRegistration && !trimmed.sgTypecode) return "sgTypecode 필요";
    return null;
  }, [adminKey, hasName, hasRegistration, sgIdValid, trimmed.sgTypecode]);

  const canPreview = !previewBlockReason && !busy;

  const snapshotMatches =
    previewSnapshot &&
    previewSnapshot.candidateName === trimmed.candidateName &&
    previewSnapshot.sgId === trimmed.sgId &&
    previewSnapshot.sgTypecode === trimmed.sgTypecode &&
    previewSnapshot.jdName === trimmed.jdName &&
    previewSnapshot.sdName === trimmed.sdName;

  const insertBlockReason = useMemo(() => {
    if (previewBlockReason) return previewBlockReason;
    if (!previewResult) return "먼저 후보자 검색 (preview) 실행";
    if (previewResult.error) return `preview 실패: ${previewResult.error}`;
    if (previewResult.acceptedCount === 0) return "preview 결과 accepted = 0";
    if (!snapshotMatches) return "입력 변경됨 — preview 재실행 필요";
    if (selectedIdx.size === 0) return "insert 할 행을 선택하세요";
    return null;
  }, [previewBlockReason, previewResult, snapshotMatches, selectedIdx]);

  const canInsert = !insertBlockReason && !busy;

  const runRequest = async <T,>(
    mode: "preview" | "insert",
    extra?: { selectIdx?: number[] },
  ): Promise<T> => {
    const qs = new URLSearchParams({
      key: adminKey,
      mode,
      pageNo: "1",
      numOfRows: String(MAX_PER_CALL),
    });
    if (trimmed.candidateName) qs.set("candidateName", trimmed.candidateName);
    if (trimmed.sgId) qs.set("sgId", trimmed.sgId);
    if (trimmed.sgTypecode) qs.set("sgTypecode", trimmed.sgTypecode);
    if (trimmed.jdName) qs.set("jdName", trimmed.jdName);
    if (trimmed.sdName) qs.set("sdName", trimmed.sdName);
    if (extra?.selectIdx && extra.selectIdx.length > 0) {
      qs.set("selectIdx", extra.selectIdx.join(","));
    }

    const res = await fetch(`/api/sources/nec/sync?${qs.toString()}`, {
      method: "POST",
    });
    return (await res.json()) as T;
  };

  const onSearch = async () => {
    if (!canPreview) return;
    setBusy("preview");
    setInsertResult(null);
    setInsertFetchedAt(null);
    try {
      const json = await runRequest<PreviewResponse>("preview");
      setPreviewResult(json);
      setPreviewSnapshot(trimmed);
      setPreviewFetchedAt(new Date());
      if (json.acceptedSamples && json.acceptedSamples.length > 0) {
        setSelectedIdx(new Set(json.acceptedSamples.map((s) => s.idx)));
      } else {
        setSelectedIdx(new Set());
      }
    } catch (e) {
      setPreviewResult({
        mode: "preview",
        fetched: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        acceptedSamples: [],
        rejectedReasons: [],
        totalCount: 0,
        error: e instanceof Error ? e.message : String(e),
      });
      setPreviewFetchedAt(new Date());
      setSelectedIdx(new Set());
    } finally {
      setBusy(null);
    }
  };

  const onInsert = async () => {
    if (!canInsert) return;
    setBusy("insert");
    setInsertResult(null);
    try {
      const json = await runRequest<InsertResponse>("insert", {
        selectIdx: Array.from(selectedIdx).sort((a, b) => a - b),
      });
      setInsertResult(json);
      setInsertFetchedAt(new Date());
      // count + 최근 5건 즉시 갱신
      load();
      setPreviewResult(null);
      setPreviewSnapshot(null);
      setPreviewFetchedAt(null);
      setSelectedIdx(new Set());
    } catch (e) {
      setInsertResult({
        error: e instanceof Error ? e.message : String(e),
      });
      setInsertFetchedAt(new Date());
    } finally {
      setBusy(null);
    }
  };

  const toggleIdx = (idx: number) => {
    setSelectedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const allSamples = previewResult?.acceptedSamples ?? [];
  const allChecked =
    allSamples.length > 0 && allSamples.every((s) => selectedIdx.has(s.idx));
  const toggleAll = () => {
    if (allChecked) setSelectedIdx(new Set());
    else setSelectedIdx(new Set(allSamples.map((s) => s.idx)));
  };

  const previewBusy = busy === "preview";
  const insertBusy = busy === "insert";

  return (
    <main className="min-h-dvh bg-bg text-fg p-6 font-mono text-[13px] leading-relaxed">
      <h1 className="text-[18px] font-medium mb-4">Data Source Test</h1>

      {!isSupabaseConfigured ? (
        <p className="text-signal-up">Supabase env not set.</p>
      ) : null}

      {/* ── raw 테이블 count ── */}
      <section className="mb-8">
        <h2 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
          raw 테이블 row count
        </h2>
        {counts ? (
          <table className="w-full">
            <tbody>
              {counts.map((r) => (
                <tr key={r.table} className="border-b border-border/40">
                  <td className="py-2 text-fg">{r.table}</td>
                  <td className="py-2 text-right tabular-nums">
                    {r.error ? (
                      <span className="text-signal-up">FAIL · {r.error}</span>
                    ) : (
                      <span className="text-accent-green">{r.count ?? 0}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-fg-dim">불러오는 중…</p>
        )}
      </section>

      {/* ── 최근 저장 5건 ── */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-fg-dim text-[11px] uppercase tracking-wider">
            election_candidates_raw · 최근 저장 5건
          </h2>
          <button
            type="button"
            onClick={load}
            disabled={latestLoading}
            className="text-fg-dim hover:text-fg text-[11px] disabled:opacity-40"
          >
            {latestLoading ? "갱신 중…" : "↻ 새로고침"}
          </button>
        </div>
        {latestLoading && !latestEcr ? (
          <p className="text-fg-dim text-[11px]">불러오는 중…</p>
        ) : latestEcr && latestEcr.length > 0 ? (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-fg-dim text-left border-b border-border/40">
                <th className="py-1">이름</th>
                <th className="py-1">정당</th>
                <th className="py-1">선거구</th>
                <th className="py-1">election_id</th>
                <th className="py-1">source</th>
                <th className="py-1 text-right">fetched_at</th>
              </tr>
            </thead>
            <tbody>
              {latestEcr.map((r, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-1 text-fg">{r.candidate_name ?? "-"}</td>
                  <td className="py-1 text-fg-muted">{r.party_name ?? "-"}</td>
                  <td className="py-1 text-fg-muted">
                    {r.district_name ?? "-"}
                  </td>
                  <td className="py-1 text-fg-dim tabular-nums">
                    {r.election_id ?? "-"}
                  </td>
                  <td className="py-1 text-fg-dim">{r.source ?? "-"}</td>
                  <td className="py-1 text-fg-dim text-right tabular-nums">
                    {formatTimestamp(r.fetched_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-fg-dim text-[11px]">
            데이터 없음 — 아래에서 검색 후 insert 하세요.
          </p>
        )}
      </section>

      {/* ── 검색 입력 + 결과 ── */}
      <section className="mb-8 border-t border-border/40 pt-6">
        <h2 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
          후보자 통합검색 (CndaSrchService · 2026 · 최대 {MAX_PER_CALL}건)
        </h2>
        <p className="text-fg-dim text-[11px] mb-3">
          ⚠️ KPOL 은 최신 정치 데이터 플랫폼. 필요한 인물만 이름으로 조회 →
          선택 → 저장. 전체 sync · 과거 데이터 · HTML/base64 payload 자동
          reject.
        </p>

        <div className="flex flex-col gap-2 mb-3">
          <input
            type="text"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="NEXT_PUBLIC_KPOL_ADMIN_KEY"
            className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
          />

          <label className="text-fg-dim text-[10px] uppercase tracking-wider mt-1">
            후보자명 (필수)
          </label>
          <input
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            placeholder="예: 홍길동"
            className="px-3 py-2 bg-elev border border-border-strong rounded text-fg text-[14px]"
          />

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="self-start text-fg-dim hover:text-fg text-[11px] mt-1"
          >
            {showAdvanced
              ? "− 고급 필터 닫기"
              : "+ 고급 필터 (sgId · 정당 · 시도)"}
          </button>

          {showAdvanced ? (
            <div className="flex flex-col gap-2 pl-3 border-l border-border/40">
              <input
                type="text"
                value={sgId}
                onChange={(e) => setSgId(e.target.value)}
                placeholder={`sgId (${REQUIRED_YEAR} 으로 시작 필수)`}
                className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
              />
              <input
                type="text"
                value={sgTypecode}
                onChange={(e) => setSgTypecode(e.target.value)}
                placeholder="sgTypecode (선거 종류 코드)"
                className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
              />
              <input
                type="text"
                value={jdName}
                onChange={(e) => setJdName(e.target.value)}
                placeholder="정당명 (선택)"
                className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
              />
              <input
                type="text"
                value={sdName}
                onChange={(e) => setSdName(e.target.value)}
                placeholder="시도명 (선택)"
                className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              type="button"
              onClick={onSearch}
              disabled={!canPreview}
              className="px-3 py-1.5 bg-elev border border-border-strong rounded text-fg hover:text-brand text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {previewBusy ? "검색 중…" : "1. 후보자 검색 (preview · DB 쓰기 없음)"}
            </button>
            <button
              type="button"
              onClick={onInsert}
              disabled={!canInsert}
              className="px-3 py-1.5 bg-elev border border-brand rounded text-brand hover:bg-brand/10 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed disabled:border-border-strong disabled:text-fg-dim disabled:hover:bg-transparent"
            >
              {insertBusy
                ? "저장 중…"
                : `2. 선택 항목 insert (${selectedIdx.size}건)`}
            </button>
            <span className="text-fg-dim text-[11px]">
              · 최대 {MAX_PER_CALL}건
            </span>
          </div>

          <div className="text-[11px]">
            {previewBlockReason ? (
              <span className="text-signal-up">
                preview 차단: {previewBlockReason}
              </span>
            ) : (
              <span className="text-accent-green">
                preview 가능 · name=&quot;{trimmed.candidateName || "(빈)"}&quot;
              </span>
            )}
            {!previewBlockReason && insertBlockReason ? (
              <span className="text-fg-dim ml-3">
                insert 차단: {insertBlockReason}
              </span>
            ) : null}
          </div>
        </div>

        {/* ── preview 결과 영역 ── */}
        {previewBusy ? (
          <div className="text-fg-dim text-[11px] py-4">검색 중…</div>
        ) : previewResult ? (
          <PreviewPanel
            result={previewResult}
            fetchedAt={previewFetchedAt}
            allSamples={allSamples}
            selectedIdx={selectedIdx}
            allChecked={allChecked}
            toggleIdx={toggleIdx}
            toggleAll={toggleAll}
          />
        ) : (
          <div className="text-fg-dim text-[11px] py-2">
            검색을 실행하면 결과가 여기에 표시됩니다.
          </div>
        )}

        {/* ── insert 결과 영역 ── */}
        {insertBusy ? (
          <div className="text-fg-dim text-[11px] py-4">저장 중…</div>
        ) : insertResult ? (
          <InsertPanel result={insertResult} fetchedAt={insertFetchedAt} />
        ) : null}
      </section>

      <YoutubeCandidateSection adminKey={adminKey} onSaved={load} />
      <YoutubeSection adminKey={adminKey} onSaved={load} />
      <MediaRankingSection adminKey={adminKey} />
      <ProgramsAdminSection adminKey={adminKey} />
    </main>
  );

  function PreviewPanel(props: {
    result: PreviewResponse;
    fetchedAt: Date | null;
    allSamples: PreviewSample[];
    selectedIdx: Set<number>;
    allChecked: boolean;
    toggleIdx: (idx: number) => void;
    toggleAll: () => void;
  }) {
    const r = props.result;
    if (r.error) {
      return (
        <div className="mb-3 border border-signal-up/30 rounded p-3 bg-elev/30">
          <h3 className="text-signal-up text-[11px] uppercase tracking-wider mb-1">
            preview 실패
          </h3>
          <p className="text-signal-up text-[12px] break-words">{r.error}</p>
          {props.fetchedAt ? (
            <p className="text-fg-dim text-[10px] mt-1">
              {formatTime(props.fetchedAt)} · {relativeTime(props.fetchedAt)}
            </p>
          ) : null}
        </div>
      );
    }

    if (r.fetched === 0) {
      return (
        <div className="mb-3 border border-border/40 rounded p-3 bg-elev/20">
          <h3 className="text-fg-dim text-[11px] uppercase tracking-wider mb-1">
            preview 결과 — 응답 없음
          </h3>
          <p className="text-fg-dim text-[12px]">
            검색어 / 필터 조건에 맞는 후보가 없습니다.
          </p>
          {r.note ? (
            <p className="text-fg-dim text-[11px] mt-1">{r.note}</p>
          ) : null}
          <PreviewMeta result={r} fetchedAt={props.fetchedAt} />
        </div>
      );
    }

    return (
      <div className="mb-3 border border-border/40 rounded p-3 bg-elev/20">
        <h3 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
          preview 결과
        </h3>
        <div className="text-[12px] mb-2 flex flex-wrap gap-x-3 gap-y-1">
          <span>fetched={r.fetched}</span>
          <span className="text-accent-green">
            accepted={r.acceptedCount}
          </span>
          <span className="text-signal-up">rejected={r.rejectedCount}</span>
          <span className="text-fg-dim">total={r.totalCount}</span>
          <span className="text-fg-dim">selected={props.selectedIdx.size}</span>
        </div>
        {r.note ? (
          <p className="text-fg-dim text-[11px] mb-2">{r.note}</p>
        ) : null}

        {props.allSamples.length > 0 ? (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <label className="text-fg text-[11px] flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={props.allChecked}
                  onChange={props.toggleAll}
                />
                전체 선택 / 해제
              </label>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-fg-dim text-left border-b border-border/40">
                  <th className="py-1 w-6"></th>
                  <th className="py-1">이름</th>
                  <th className="py-1">정당</th>
                  <th className="py-1">선거구</th>
                  <th className="py-1">election_id</th>
                </tr>
              </thead>
              <tbody>
                {props.allSamples.map((s) => {
                  const checked = props.selectedIdx.has(s.idx);
                  return (
                    <tr key={s.idx} className="border-b border-border/30">
                      <td className="py-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => props.toggleIdx(s.idx)}
                        />
                      </td>
                      <td className="py-1 text-fg">
                        {s.candidate_name ?? "(없음)"}
                      </td>
                      <td className="py-1 text-fg-muted">
                        {s.party_name ?? "-"}
                      </td>
                      <td className="py-1 text-fg-muted">
                        {s.district_name ?? "-"}
                      </td>
                      <td className="py-1 text-fg-dim tabular-nums">
                        {s.election_id ?? "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {r.rejectedReasons.length > 0 ? (
          <details className="mt-2">
            <summary className="text-fg text-[11px] cursor-pointer">
              rejected reasons ({r.rejectedReasons.length})
            </summary>
            <ul className="mt-1 space-y-1">
              {r.rejectedReasons.map((rr, i) => (
                <li
                  key={i}
                  className="text-signal-up text-[11px] flex gap-2 border-l-2 border-signal-up/40 pl-2"
                >
                  <span className="text-fg-dim tabular-nums">#{i + 1}</span>
                  <span>{rr.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <PreviewMeta result={r} fetchedAt={props.fetchedAt} />
      </div>
    );
  }

  function PreviewMeta({
    result,
    fetchedAt,
  }: {
    result: PreviewResponse;
    fetchedAt: Date | null;
  }) {
    const g = result.guard;
    return (
      <div className="mt-2 pt-2 border-t border-border/30 text-[10px] text-fg-dim space-y-0.5">
        {fetchedAt ? (
          <div>
            preview at {formatTime(fetchedAt)} · {relativeTime(fetchedAt)}
          </div>
        ) : null}
        {g?.requestUrl ? (
          <div className="break-all">
            source: <span className="text-fg-muted">{g.requestUrl}</span>
          </div>
        ) : null}
        {g ? (
          <div>
            guard: requiredYear={g.requiredYear} · numOfRows={g.numOfRows} ·
            maxInsert={g.maxInsertPerCall} · maxPayload={g.maxRawPayloadBytes}B
          </div>
        ) : null}
      </div>
    );
  }

  function InsertPanel({
    result,
    fetchedAt,
  }: {
    result: InsertResponse;
    fetchedAt: Date | null;
  }) {
    if (result.error) {
      return (
        <div className="border border-signal-up/30 rounded p-3 bg-elev/30">
          <h3 className="text-signal-up text-[11px] uppercase tracking-wider mb-1">
            insert 실패
          </h3>
          <p className="text-signal-up text-[12px] break-words">
            {result.error}
          </p>
          {fetchedAt ? (
            <p className="text-fg-dim text-[10px] mt-1">
              {formatTime(fetchedAt)} · {relativeTime(fetchedAt)}
            </p>
          ) : null}
        </div>
      );
    }
    return (
      <div className="border border-brand/30 rounded p-3 bg-elev/20">
        <h3 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
          insert 결과
        </h3>
        <div className="text-[12px] mb-1 flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-accent-green">
            inserted={result.inserted ?? 0}
          </span>
          <span className="text-fg-dim">fetched={result.fetched ?? 0}</span>
          <span className="text-signal-up">rejected={result.rejected ?? 0}</span>
          {result.skippedBySelect ? (
            <span className="text-fg-dim">
              skippedBySelect={result.skippedBySelect}
            </span>
          ) : null}
          {result.selected ? (
            <span className="text-fg-dim">
              selected=[{result.selected.join(",")}]
            </span>
          ) : null}
        </div>
        {result.note ? (
          <p className="text-fg-dim text-[11px] mb-1">{result.note}</p>
        ) : null}
        {result.rejectedReasons && result.rejectedReasons.length > 0 ? (
          <details className="mt-1">
            <summary className="text-fg text-[11px] cursor-pointer">
              rejected reasons ({result.rejectedReasons.length})
            </summary>
            <ul className="mt-1 space-y-1">
              {result.rejectedReasons.map((rr, i) => (
                <li
                  key={i}
                  className="text-signal-up text-[11px] flex gap-2 border-l-2 border-signal-up/40 pl-2"
                >
                  <span className="text-fg-dim tabular-nums">#{i + 1}</span>
                  <span>{rr.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {fetchedAt ? (
          <div className="text-[10px] text-fg-dim mt-2">
            insert at {formatTime(fetchedAt)} · {relativeTime(fetchedAt)}
          </div>
        ) : null}
      </div>
    );
  }
}
