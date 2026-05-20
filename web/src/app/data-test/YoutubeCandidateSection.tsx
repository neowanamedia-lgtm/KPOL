"use client";

import { useMemo, useState } from "react";
import { POLITICAL_KEYWORDS_DEFAULT } from "@/lib/sources/youtube";

/**
 * YouTube 정치·시사 채널 후보군 일괄 수집 admin 섹션.
 *
 * 흐름:
 *   1) 키워드 화이트리스트 + maxPerKeyword 입력
 *   2) "후보 검색" → search.list × N (quota 100×N) → dedup + 분류
 *   3) candidate / review_needed / rejected_anti 표시
 *   4) 사용자가 체크박스로 선택 → channels.list 1회 → media_sources_raw 저장
 *
 * 분류는 keyword string match 기반 (AI 판정 ✗).
 */

// lib 의 화이트리스트와 동기화 — UI 가 보여주는 preset 도 동일.
const KEYWORD_PRESET: readonly string[] = POLITICAL_KEYWORDS_DEFAULT;

const MAX_KEYWORDS = 5;
const MAX_PER_KEYWORD = 5;
const MAX_INSERT = 10;

type Category = "candidate" | "review_needed" | "rejected_anti";

interface CandidateRow {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  matchedKeywords: string[];
  matchedAntiKeywords: string[];
  matchedQueries: string[];
  category: Category;
}

interface PreviewResponse {
  mode?: string;
  keywordsUsed?: string[];
  antiKeywordsUsed?: string[];
  maxPerKeyword?: number;
  quotaEstimate?: number;
  totalUnique?: number;
  countByCategory?: Record<Category, number>;
  candidates?: CandidateRow[];
  reviewNeeded?: CandidateRow[];
  rejectedAnti?: CandidateRow[];
  errors?: { keyword: string; error: string }[];
  requestUrls?: string[];
  note?: string;
  error?: string;
  guard?: Record<string, unknown>;
}

interface InsertResponse {
  mode?: string;
  requested?: number;
  fetched?: number;
  inserted?: number;
  rejected?: { channelId?: string; reason: string }[];
  samples?: unknown[];
  requestUrl?: string;
  note?: string;
  error?: string;
  guard?: Record<string, unknown>;
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

export function YoutubeCandidateSection({
  adminKey,
  onSaved,
}: {
  adminKey: string;
  onSaved: () => void;
}) {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(
    KEYWORD_PRESET.slice(0, 3),
  );
  const [maxPerKeyword, setMaxPerKeyword] = useState(MAX_PER_KEYWORD);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewFetchedAt, setPreviewFetchedAt] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [insertResult, setInsertResult] = useState<InsertResponse | null>(null);
  const [insertFetchedAt, setInsertFetchedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState<"preview" | "insert" | null>(null);

  const toggleKeyword = (k: string) => {
    setSelectedKeywords((curr) => {
      if (curr.includes(k)) return curr.filter((x) => x !== k);
      if (curr.length >= MAX_KEYWORDS) return curr;
      return [...curr, k];
    });
  };

  const previewBlockReason = useMemo(() => {
    if (!adminKey) return "admin key 필요";
    if (selectedKeywords.length === 0) return "키워드 최소 1개 선택";
    if (selectedKeywords.length > MAX_KEYWORDS)
      return `키워드 ${MAX_KEYWORDS}개 초과`;
    return null;
  }, [adminKey, selectedKeywords]);

  const canPreview = !previewBlockReason && !busy;
  const canInsert =
    !busy &&
    !!preview &&
    !preview.error &&
    selectedIds.size > 0 &&
    selectedIds.size <= MAX_INSERT;

  const insertBlockReason = useMemo(() => {
    if (previewBlockReason) return previewBlockReason;
    if (!preview) return "먼저 후보 검색 (preview) 실행";
    if (preview.error) return `preview 실패: ${preview.error}`;
    if (selectedIds.size === 0) return "insert 할 채널 선택";
    if (selectedIds.size > MAX_INSERT)
      return `최대 ${MAX_INSERT}개 — 현재 ${selectedIds.size}개`;
    return null;
  }, [previewBlockReason, preview, selectedIds]);

  const onPreview = async () => {
    if (!canPreview) return;
    setBusy("preview");
    setInsertResult(null);
    setInsertFetchedAt(null);
    setSelectedIds(new Set());
    try {
      const qs = new URLSearchParams({
        key: adminKey,
        mode: "preview",
        keywords: selectedKeywords.join(","),
        maxPerKeyword: String(maxPerKeyword),
      });
      const res = await fetch(
        `/api/sources/youtube/candidates?${qs.toString()}`,
        { method: "POST" },
      );
      const json = (await res.json()) as PreviewResponse;
      setPreview(json);
      setPreviewFetchedAt(new Date());
      // 기본: candidate 카테고리만 전체 선택
      if (!json.error && Array.isArray(json.candidates)) {
        const first = json.candidates.slice(0, MAX_INSERT);
        setSelectedIds(new Set(first.map((c) => c.channelId)));
      }
    } catch (e) {
      setPreview({ error: e instanceof Error ? e.message : String(e) });
      setPreviewFetchedAt(new Date());
    } finally {
      setBusy(null);
    }
  };

  const onInsert = async () => {
    if (!canInsert) return;
    setBusy("insert");
    setInsertResult(null);
    try {
      const qs = new URLSearchParams({
        key: adminKey,
        mode: "insert",
        selectChannelIds: Array.from(selectedIds).join(","),
      });
      const res = await fetch(
        `/api/sources/youtube/candidates?${qs.toString()}`,
        { method: "POST" },
      );
      const json = (await res.json()) as InsertResponse;
      setInsertResult(json);
      setInsertFetchedAt(new Date());
      onSaved();
      // 성공 후 preview 무효화 — 재검색 강제
      setPreview(null);
      setSelectedIds(new Set());
    } catch (e) {
      setInsertResult({ error: e instanceof Error ? e.message : String(e) });
      setInsertFetchedAt(new Date());
    } finally {
      setBusy(null);
    }
  };

  const toggleId = (id: string) => {
    setSelectedIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_INSERT) next.add(id);
      return next;
    });
  };

  return (
    <section className="mb-8 border-t border-border/40 pt-6">
      <h2 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
        YouTube 정치·시사 채널 후보 검색 (search.list × N · 일괄)
      </h2>
      <p className="text-fg-dim text-[11px] mb-3">
        ⚠️ 정치·시사 한정. 키워드 string match 만 사용 (AI 판정 ✗).
        search.list 1회 = 100 quota unit · 최대 {MAX_KEYWORDS} 키워드 × {MAX_PER_KEYWORD} 결과 → 500 unit.
        선택된 채널만 channels.list 로 추가 조회 후 media_sources_raw 저장.
      </p>

      {/* 키워드 선택 */}
      <div className="mb-3">
        <label className="text-fg-dim text-[10px] uppercase tracking-wider">
          키워드 (최대 {MAX_KEYWORDS}개, 현재 {selectedKeywords.length})
        </label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {KEYWORD_PRESET.map((k) => {
            const on = selectedKeywords.includes(k);
            const disabled = !on && selectedKeywords.length >= MAX_KEYWORDS;
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKeyword(k)}
                disabled={disabled}
                className={`px-2 py-1 rounded border text-[11px] ${
                  on
                    ? "bg-brand/20 border-brand text-brand"
                    : "bg-elev border-border text-fg-muted hover:text-fg"
                } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {k}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="text-fg-dim text-[10px] uppercase tracking-wider">
            키워드당 결과 수
          </label>
          <input
            type="number"
            min={1}
            max={MAX_PER_KEYWORD}
            value={maxPerKeyword}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) {
                setMaxPerKeyword(Math.min(MAX_PER_KEYWORD, Math.max(1, n)));
              }
            }}
            className="w-16 px-2 py-1 bg-elev border border-border rounded text-fg text-[12px]"
          />
          <span className="text-fg-dim text-[11px]">
            예상 quota = {selectedKeywords.length * 100} unit
          </span>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          onClick={onPreview}
          disabled={!canPreview}
          className="px-3 py-1.5 bg-elev border border-border-strong rounded text-fg hover:text-brand text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy === "preview" ? "검색 중…" : "1. 후보 검색 (preview)"}
        </button>
        <button
          type="button"
          onClick={onInsert}
          disabled={!canInsert}
          className="px-3 py-1.5 bg-elev border border-brand rounded text-brand hover:bg-brand/10 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed disabled:border-border-strong disabled:text-fg-dim disabled:hover:bg-transparent"
        >
          {busy === "insert"
            ? "저장 중…"
            : `2. 선택 ${selectedIds.size}건 insert (channels.list)`}
        </button>
        <span className="text-fg-dim text-[11px]">
          · 최대 {MAX_INSERT}건
        </span>
      </div>
      <div className="text-[11px] mb-3">
        {previewBlockReason ? (
          <span className="text-signal-up">
            preview 차단: {previewBlockReason}
          </span>
        ) : (
          <span className="text-accent-green">
            preview 가능 · {selectedKeywords.length} 키워드
          </span>
        )}
        {!previewBlockReason && insertBlockReason ? (
          <span className="text-fg-dim ml-3">
            insert 차단: {insertBlockReason}
          </span>
        ) : null}
      </div>

      {/* preview 결과 */}
      {busy === "preview" ? (
        <div className="text-fg-dim text-[11px] py-4">검색 중…</div>
      ) : preview ? (
        <PreviewPanel
          preview={preview}
          fetchedAt={previewFetchedAt}
          selectedIds={selectedIds}
          onToggle={toggleId}
        />
      ) : (
        <div className="text-fg-dim text-[11px] py-2">
          키워드 선택 후 검색을 실행하세요.
        </div>
      )}

      {/* insert 결과 */}
      {busy === "insert" ? (
        <div className="text-fg-dim text-[11px] py-4">저장 중…</div>
      ) : insertResult ? (
        <InsertPanel result={insertResult} fetchedAt={insertFetchedAt} />
      ) : null}
    </section>
  );
}

function PreviewPanel({
  preview,
  fetchedAt,
  selectedIds,
  onToggle,
}: {
  preview: PreviewResponse;
  fetchedAt: Date | null;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (preview.error) {
    return (
      <div className="mb-3 border border-signal-up/30 rounded p-3 bg-elev/30">
        <h3 className="text-signal-up text-[11px] uppercase tracking-wider mb-1">
          preview 실패
        </h3>
        <p className="text-signal-up text-[12px] break-words">
          {preview.error}
        </p>
      </div>
    );
  }

  const c = preview.countByCategory ?? {
    candidate: 0,
    review_needed: 0,
    rejected_anti: 0,
  };

  return (
    <div className="mb-3 border border-border/40 rounded p-3 bg-elev/20">
      <h3 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
        preview 결과
      </h3>
      <div className="text-[12px] mb-2 flex flex-wrap gap-x-3 gap-y-1">
        <span>total={preview.totalUnique ?? 0}</span>
        <span className="text-accent-green">candidate={c.candidate}</span>
        <span className="text-fg-muted">review_needed={c.review_needed}</span>
        <span className="text-signal-up">rejected_anti={c.rejected_anti}</span>
        <span className="text-fg-dim">quota={preview.quotaEstimate} unit</span>
      </div>
      {preview.note ? (
        <p className="text-fg-dim text-[11px] mb-2">{preview.note}</p>
      ) : null}

      <CandidateGroup
        title="✓ candidate (insert 대상)"
        rows={preview.candidates ?? []}
        selectedIds={selectedIds}
        onToggle={onToggle}
        selectable
      />
      <CandidateGroup
        title="? review_needed (수동 확인 — 직접 체크해야 insert)"
        rows={preview.reviewNeeded ?? []}
        selectedIds={selectedIds}
        onToggle={onToggle}
        selectable
        collapsed
      />
      <CandidateGroup
        title="✗ rejected_anti (anti-keyword 매치)"
        rows={preview.rejectedAnti ?? []}
        selectedIds={selectedIds}
        onToggle={onToggle}
        selectable={false}
        collapsed
      />

      {preview.errors && preview.errors.length > 0 ? (
        <details className="mt-2">
          <summary className="text-signal-up text-[11px] cursor-pointer">
            errors ({preview.errors.length})
          </summary>
          <pre className="text-signal-up text-[11px] overflow-x-auto bg-elev/40 p-2 rounded mt-1">
            {JSON.stringify(preview.errors, null, 2)}
          </pre>
        </details>
      ) : null}

      <div className="mt-2 pt-2 border-t border-border/30 text-[10px] text-fg-dim space-y-0.5">
        {fetchedAt ? <div>preview at {formatTime(fetchedAt)}</div> : null}
        {preview.keywordsUsed ? (
          <div>keywords: {preview.keywordsUsed.join(", ")}</div>
        ) : null}
        {preview.antiKeywordsUsed ? (
          <div className="break-all">
            anti: {preview.antiKeywordsUsed.slice(0, 15).join(", ")}
            {preview.antiKeywordsUsed.length > 15 ? " …" : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CandidateGroup({
  title,
  rows,
  selectedIds,
  onToggle,
  selectable,
  collapsed,
}: {
  title: string;
  rows: CandidateRow[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  selectable: boolean;
  collapsed?: boolean;
}) {
  if (rows.length === 0) return null;
  const body = (
    <table className="w-full text-[11px] mt-1">
      <thead>
        <tr className="text-fg-dim text-left border-b border-border/40">
          <th className="py-1 w-6"></th>
          <th className="py-1">channel</th>
          <th className="py-1">매치 키워드</th>
          <th className="py-1">설명 (요약)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const checked = selectedIds.has(c.channelId);
          return (
            <tr key={c.channelId} className="border-b border-border/30 align-top">
              <td className="py-1">
                {selectable ? (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(c.channelId)}
                  />
                ) : (
                  <span className="text-fg-dim">-</span>
                )}
              </td>
              <td className="py-1">
                <div className="text-fg">{c.title || "(no title)"}</div>
                <div className="text-fg-dim text-[10px] tabular-nums break-all">
                  {c.channelId}
                </div>
              </td>
              <td className="py-1 text-fg-muted">
                {c.matchedKeywords.length > 0 ? (
                  <span className="text-accent-green">
                    +{c.matchedKeywords.join(", ")}
                  </span>
                ) : null}
                {c.matchedKeywords.length > 0 &&
                c.matchedAntiKeywords.length > 0 ? (
                  <br />
                ) : null}
                {c.matchedAntiKeywords.length > 0 ? (
                  <span className="text-signal-up">
                    −{c.matchedAntiKeywords.join(", ")}
                  </span>
                ) : null}
              </td>
              <td className="py-1 text-fg-muted whitespace-pre-wrap break-words">
                {(c.description ?? "").slice(0, 200)}
                {(c.description ?? "").length > 200 ? " …" : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <div className="mb-3">
      {collapsed ? (
        <details>
          <summary className="text-fg text-[11px] cursor-pointer">
            {title} ({rows.length})
          </summary>
          {body}
        </details>
      ) : (
        <>
          <div className="text-fg text-[11px]">
            {title} ({rows.length})
          </div>
          {body}
        </>
      )}
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
        <p className="text-signal-up text-[12px] break-words">{result.error}</p>
      </div>
    );
  }
  return (
    <div className="border border-brand/30 rounded p-3 bg-elev/20">
      <h3 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
        insert 결과
      </h3>
      <div className="text-[12px] mb-1 flex flex-wrap gap-x-3 gap-y-1">
        <span>requested={result.requested ?? 0}</span>
        <span>fetched={result.fetched ?? 0}</span>
        <span className="text-accent-green">inserted={result.inserted ?? 0}</span>
        <span className="text-signal-up">
          rejected={result.rejected?.length ?? 0}
        </span>
      </div>
      {result.note ? (
        <p className="text-fg-dim text-[11px] mb-1">{result.note}</p>
      ) : null}
      {result.rejected && result.rejected.length > 0 ? (
        <details className="mt-1">
          <summary className="text-fg text-[11px] cursor-pointer">
            rejected ({result.rejected.length})
          </summary>
          <ul className="mt-1 space-y-1">
            {result.rejected.map((r, i) => (
              <li
                key={i}
                className="text-signal-up text-[11px] flex gap-2 border-l-2 border-signal-up/40 pl-2"
              >
                <span className="text-fg-dim tabular-nums">#{i + 1}</span>
                <span>
                  {r.channelId ? `[${r.channelId}] ` : ""}
                  {r.reason}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="mt-2 pt-2 border-t border-border/30 text-[10px] text-fg-dim space-y-0.5">
        {fetchedAt ? <div>{formatTime(fetchedAt)}</div> : null}
        {result.requestUrl ? (
          <div className="break-all">
            source: <span className="text-fg-muted">{result.requestUrl}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
