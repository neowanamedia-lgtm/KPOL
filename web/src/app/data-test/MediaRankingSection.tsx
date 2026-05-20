"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatKoreanCount } from "@/lib/rankings/media";

/**
 * /data-test admin 전용 media_rankings rebuild 섹션.
 *
 * - 현재 media_rankings (media_type='youtube_channel') 상위 100 표시 — 카드형
 * - preview / apply 2단계 (formula_version='media_v1')
 * - apply 는 SUPABASE_SERVICE_ROLE_KEY 미설정 시 자동 차단
 * - 최근 ranking_calculation_logs + stale 표시
 * - rank_change 는 placeholder (— 표시) — 추후 변동 계산 도입 시 활성
 *
 * 메인 UI 무관. Shell.tsx 등 손대지 않음.
 */

interface RankedRow {
  rank: number;
  previousRank: number | null;
  rankChange: number | null;
  scoreNormalized: number;
  channelId: string;
  name: string;
  customUrl: string | null;
  officialUrl: string;
  thumbnailUrl: string | null;
  score: number;
  evidence: {
    formula_version: string;
    weights: { subscriber: number; view: number; video: number };
    components: { subscriber_log: number; view_log: number; video_log: number };
    subscriber_count: number;
    view_count: number;
    video_count: number;
    subscribers_hidden: boolean;
    source_fetched_at: string;
  };
}

interface RebuildResponse {
  mode?: string;
  formulaVersion?: string;
  weights?: { subscriber: number; view: number; video: number };
  stats?: {
    rawRowCount: number;
    uniqueChannels: number;
    duplicatesSkipped: number;
    rowsWithoutChannelId: number;
  };
  ranked?: RankedRow[];
  rejected?: { sourceRowId?: string; reason: string }[];
  candidatesCount?: number;
  inserted?: number;
  logInserted?: number;
  logError?: string | null;
  durationMs?: number;
  serviceRoleAvailable?: boolean;
  note?: string;
  hint?: string;
  error?: string;
}

interface CurrentRankingRow {
  rank: number;
  name: string;
  score: number | null;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  updated_at: string;
}

interface LastLogRow {
  target_name: string;
  score: number | null;
  rank: number | null;
  formula_version: string | null;
  calculated_at: string;
  evidence: unknown;
}

const DISPLAY_LIMIT = 100;
const STALE_HOURS = 24; // 마지막 산정으로부터 N시간 초과 시 stale 표시

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

function relativeFromNow(iso: string | null): {
  text: string;
  hoursAgo: number;
} | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  const hoursAgo = secs / 3600;
  if (secs < 60) return { text: `${secs}초 전`, hoursAgo };
  if (secs < 3600) return { text: `${Math.floor(secs / 60)}분 전`, hoursAgo };
  const h = Math.floor(secs / 3600);
  if (h < 48) return { text: `${h}시간 전`, hoursAgo };
  return { text: `${Math.floor(h / 24)}일 전`, hoursAgo };
}

export function MediaRankingSection({ adminKey }: { adminKey: string }) {
  const [current, setCurrent] = useState<CurrentRankingRow[] | null>(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [lastLog, setLastLog] = useState<LastLogRow | null>(null);
  // 직전 batch 의 evidence.previous_rank 를 name 으로 색인 — 현재 ranking 의 Δ 표시용
  const [prevRankByName, setPrevRankByName] = useState<Map<string, number | null>>(
    () => new Map(),
  );
  const [preview, setPreview] = useState<RebuildResponse | null>(null);
  const [previewFetchedAt, setPreviewFetchedAt] = useState<Date | null>(null);
  const [applyResult, setApplyResult] = useState<RebuildResponse | null>(null);
  const [applyFetchedAt, setApplyFetchedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

  // relative time 갱신 — 1분마다 리렌더
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => (n + 1) % 100000), 60000);
    return () => clearInterval(id);
  }, []);

  const loadCurrent = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setCurrentLoading(true);
    try {
      const { data, error } = await supabase
        .from("media_rankings")
        .select("rank,name,score,description,image_url,source_url,updated_at")
        .eq("media_type", "youtube_channel")
        .eq("is_active", true)
        .order("rank", { ascending: true })
        .limit(DISPLAY_LIMIT);
      if (!error)
        setCurrent((data as CurrentRankingRow[] | null) ?? []);
      else setCurrent([]);
    } catch {
      setCurrent([]);
    } finally {
      setCurrentLoading(false);
    }

    try {
      // 최근 200건 → 최신 batch (calculated_at 동일) 만 사용 → prevRank map 빌드
      const { data, error } = await supabase
        .from("ranking_calculation_logs")
        .select("target_name,score,rank,formula_version,calculated_at,evidence")
        .eq("ranking_table", "media_rankings")
        .order("calculated_at", { ascending: false })
        .limit(200);
      if (!error && data && data.length > 0) {
        setLastLog(data[0] as LastLogRow);
        const latestAt = (data[0] as LastLogRow).calculated_at;
        const map = new Map<string, number | null>();
        for (const row of data as LastLogRow[]) {
          if (row.calculated_at !== latestAt) break; // 같은 batch 만
          const ev = row.evidence as
            | { previous_rank?: number | null }
            | null
            | undefined;
          const prev =
            ev && typeof ev.previous_rank === "number"
              ? ev.previous_rank
              : null;
          if (!map.has(row.target_name)) map.set(row.target_name, prev);
        }
        setPrevRankByName(map);
      } else {
        setLastLog(null);
        setPrevRankByName(new Map());
      }
    } catch {
      setLastLog(null);
      setPrevRankByName(new Map());
    }
  }, []);

  useEffect(() => {
    // mount 시 1회 + loadCurrent identity 변경 시
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCurrent();
  }, [loadCurrent]);

  const previewBlockReason = useMemo(() => {
    if (!adminKey) return "admin key 필요";
    return null;
  }, [adminKey]);

  const serviceRoleAvailable =
    preview?.serviceRoleAvailable ?? applyResult?.serviceRoleAvailable ?? null;

  const applyBlockReason = useMemo(() => {
    if (previewBlockReason) return previewBlockReason;
    if (!preview) return "먼저 preview 실행";
    if (preview.error) return `preview 실패: ${preview.error}`;
    if ((preview.candidatesCount ?? 0) === 0) return "산정 대상 0건";
    if (serviceRoleAvailable === false)
      return "SUPABASE_SERVICE_ROLE_KEY 미설정";
    return null;
  }, [previewBlockReason, preview, serviceRoleAvailable]);

  const canPreview = !previewBlockReason && !busy;
  const canApply = !applyBlockReason && !busy;

  const runRebuild = async (mode: "preview" | "apply") => {
    const qs = new URLSearchParams({ key: adminKey, mode });
    const res = await fetch(`/api/rankings/media/rebuild?${qs.toString()}`, {
      method: "POST",
    });
    return (await res.json()) as RebuildResponse;
  };

  const onPreview = async () => {
    if (!canPreview) return;
    setBusy("preview");
    setApplyResult(null);
    setApplyFetchedAt(null);
    try {
      const json = await runRebuild("preview");
      setPreview(json);
      setPreviewFetchedAt(new Date());
    } catch (e) {
      setPreview({ error: e instanceof Error ? e.message : String(e) });
      setPreviewFetchedAt(new Date());
    } finally {
      setBusy(null);
    }
  };

  const onApply = async () => {
    if (!canApply) return;
    setBusy("apply");
    setApplyResult(null);
    try {
      const json = await runRebuild("apply");
      setApplyResult(json);
      setApplyFetchedAt(new Date());
      loadCurrent();
      setPreview(null);
      setPreviewFetchedAt(null);
    } catch (e) {
      setApplyResult({ error: e instanceof Error ? e.message : String(e) });
      setApplyFetchedAt(new Date());
    } finally {
      setBusy(null);
    }
  };

  const previewBusy = busy === "preview";
  const applyBusy = busy === "apply";

  const lastRel = relativeFromNow(lastLog?.calculated_at ?? null);
  const isStale = lastRel ? lastRel.hoursAgo > STALE_HOURS : false;

  return (
    <section className="mb-8 border-t border-border/40 pt-6">
      <h2 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
        media_rankings · 정치·시사 YouTube TOP{DISPLAY_LIMIT} (formula media_v1)
      </h2>
      <p className="text-fg-dim text-[11px] mb-3">
        ⚠️ 실제 지표(subscriber/view/video) log10 가중합. AI 임의 점수 ✗.
        preview 는 항상 가능, apply 는 SUPABASE_SERVICE_ROLE_KEY 필요.
      </p>

      {/* 상태 라인 */}
      <div className="mb-3 text-[11px] flex flex-wrap gap-x-3 gap-y-1 items-center">
        <span className="text-fg-dim">formula:</span>
        <span className="text-fg">media_v1</span>
        <span className="text-fg-dim">· service_role:</span>
        <span
          className={
            serviceRoleAvailable == null
              ? "text-fg-dim"
              : serviceRoleAvailable
                ? "text-accent-green"
                : "text-signal-up"
          }
        >
          {serviceRoleAvailable == null
            ? "unknown"
            : serviceRoleAvailable
              ? "OK"
              : "missing"}
        </span>
        {lastRel ? (
          <>
            <span className="text-fg-dim">· last rebuild:</span>
            <span className={isStale ? "text-signal-up" : "text-accent-green"}>
              {lastRel.text}
              {isStale ? ` (stale, ${STALE_HOURS}h+)` : ""}
            </span>
          </>
        ) : (
          <>
            <span className="text-fg-dim">· last rebuild:</span>
            <span className="text-fg-dim">없음</span>
          </>
        )}
      </div>

      {/* 현재 랭킹 카드 표 */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-fg-dim text-[11px] uppercase tracking-wider">
            현재 media_rankings (youtube_channel, top {DISPLAY_LIMIT})
          </h3>
          <button
            type="button"
            onClick={loadCurrent}
            disabled={currentLoading}
            className="text-fg-dim hover:text-fg text-[11px] disabled:opacity-40"
          >
            {currentLoading ? "갱신 중…" : "↻ 새로고침"}
          </button>
        </div>
        {currentLoading && !current ? (
          <p className="text-fg-dim text-[11px]">불러오는 중…</p>
        ) : current && current.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-fg-dim text-left border-b border-border/40">
                  <th className="py-1 w-10 text-right">rank</th>
                  <th
                    className="py-1 w-10 text-center"
                    title="순위 변동 (직전 산정 대비)"
                  >
                    Δ
                  </th>
                  <th className="py-1 w-10"></th>
                  <th className="py-1">name</th>
                  <th className="py-1 w-20 text-right">score</th>
                  <th className="py-1">description</th>
                  <th className="py-1 w-36 text-right">updated_at</th>
                </tr>
              </thead>
              <tbody>
                {current.map((r, i) => {
                  const prev = prevRankByName.get(r.name) ?? null;
                  const change = prev != null ? prev - r.rank : null;
                  // prev == null 인 경우 진짜 신규일 수도, log 가 매칭 안 된 경우일 수도 있음.
                  // log 가 비어 있으면 모두 NEW 로 보일 수 있는데 의도된 표시.
                  return (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-1 text-fg-dim text-right tabular-nums">
                        {r.rank}
                      </td>
                      <td className="py-1 text-center">
                        <RankChangeBadge change={change} previousRank={prev} />
                      </td>
                    <td className="py-1">
                      <ChannelThumb url={r.image_url} alt={r.name} size={32} />
                    </td>
                    <td className="py-1">
                      <a
                        href={r.source_url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-fg hover:text-brand"
                      >
                        {r.name}
                      </a>
                    </td>
                    <td className="py-1 text-fg-muted text-right tabular-nums">
                      {r.score != null ? r.score.toFixed(3) : "-"}
                    </td>
                    <td className="py-1 text-fg-muted">
                      {r.description ?? "-"}
                    </td>
                    <td className="py-1 text-fg-dim text-right tabular-nums">
                      {formatTimestamp(r.updated_at)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-fg-dim text-[11px]">
            아직 랭킹 없음. 아래에서 preview → apply 실행하세요.
          </p>
        )}
      </div>

      {/* rebuild 버튼 */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          onClick={onPreview}
          disabled={!canPreview}
          className="px-3 py-1.5 bg-elev border border-border-strong rounded text-fg hover:text-brand text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {previewBusy ? "산정 중…" : "1. rebuild preview"}
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!canApply}
          className="px-3 py-1.5 bg-elev border border-brand rounded text-brand hover:bg-brand/10 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed disabled:border-border-strong disabled:text-fg-dim disabled:hover:bg-transparent"
        >
          {applyBusy ? "적용 중…" : "2. apply (media_rankings 교체)"}
        </button>
      </div>
      <div className="text-[11px] mb-3">
        {previewBlockReason ? (
          <span className="text-signal-up">
            preview 차단: {previewBlockReason}
          </span>
        ) : (
          <span className="text-accent-green">preview 가능</span>
        )}
        {!previewBlockReason && applyBlockReason ? (
          <span className="text-fg-dim ml-3">
            apply 차단: {applyBlockReason}
          </span>
        ) : null}
      </div>

      {/* preview 결과 */}
      {previewBusy ? (
        <div className="text-fg-dim text-[11px] py-4">산정 중…</div>
      ) : preview ? (
        <RebuildPanel
          title="preview 결과"
          result={preview}
          fetchedAt={previewFetchedAt}
        />
      ) : (
        <div className="text-fg-dim text-[11px] py-2">
          preview 를 실행하면 산정 결과가 여기에 표시됩니다.
        </div>
      )}

      {/* apply 결과 */}
      {applyBusy ? (
        <div className="text-fg-dim text-[11px] py-4">적용 중…</div>
      ) : applyResult ? (
        <RebuildPanel
          title="apply 결과"
          result={applyResult}
          fetchedAt={applyFetchedAt}
        />
      ) : null}

      {/* 마지막 calculation log */}
      {lastLog ? (
        <div className="mt-4 border-t border-border/30 pt-2 text-[11px]">
          <h3 className="text-fg-dim uppercase tracking-wider mb-1">
            마지막 ranking_calculation_logs (media_rankings)
          </h3>
          <div className="text-fg-muted">
            target=<span className="text-fg">{lastLog.target_name}</span> · rank=
            {lastLog.rank} · score={lastLog.score?.toFixed(3) ?? "-"} ·
            formula={lastLog.formula_version} ·{" "}
            {formatTimestamp(lastLog.calculated_at)}
          </div>
          <details className="mt-1">
            <summary className="text-fg cursor-pointer">evidence</summary>
            <pre className="text-fg-muted overflow-x-auto bg-elev/40 p-2 rounded mt-1 text-[10px]">
              {JSON.stringify(lastLog.evidence, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}

function RankChangeBadge({
  change,
  previousRank,
}: {
  change: number | null;
  previousRank: number | null;
}) {
  if (change == null) {
    // 신규 진입 (previous 없음)
    return (
      <span
        className="text-accent-green text-[10px] font-medium"
        title="신규 진입"
      >
        NEW
      </span>
    );
  }
  if (change === 0) {
    return (
      <span className="text-fg-dim" title="순위 유지">
        —
      </span>
    );
  }
  if (change > 0) {
    return (
      <span
        className="text-accent-green tabular-nums"
        title={`이전 ${previousRank}위 → ${change}계단 상승`}
      >
        ↑{change}
      </span>
    );
  }
  return (
    <span
      className="text-signal-up tabular-nums"
      title={`이전 ${previousRank}위 → ${-change}계단 하락`}
    >
      ↓{-change}
    </span>
  );
}

function ChannelThumb({
  url,
  alt,
  size,
}: {
  url: string | null;
  alt: string;
  size: number;
}) {
  if (!url) {
    return (
      <div
        className="rounded-full bg-elev border border-border flex items-center justify-center text-fg-dim text-[10px]"
        style={{ width: size, height: size }}
        aria-label="no thumbnail"
      >
        ▢
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full object-cover border border-border"
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function RebuildPanel({
  title,
  result,
  fetchedAt,
}: {
  title: string;
  result: RebuildResponse;
  fetchedAt: Date | null;
}) {
  if (result.error) {
    return (
      <div className="mb-3 border border-signal-up/30 rounded p-3 bg-elev/30">
        <h3 className="text-signal-up text-[11px] uppercase tracking-wider mb-1">
          {title} — 실패
        </h3>
        <p className="text-signal-up text-[12px] break-words">{result.error}</p>
        {result.hint ? (
          <p className="text-fg-dim text-[11px] mt-1">{result.hint}</p>
        ) : null}
        {fetchedAt ? (
          <p className="text-fg-dim text-[10px] mt-1">{formatTime(fetchedAt)}</p>
        ) : null}
      </div>
    );
  }

  const stats = result.stats;
  const ranked = result.ranked ?? [];
  const rejected = result.rejected ?? [];
  const isApply = result.mode === "apply";

  return (
    <div className="mb-3 border border-border/40 rounded p-3 bg-elev/20">
      <h3 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="text-[12px] mb-2 flex flex-wrap gap-x-3 gap-y-1">
        <span>mode={result.mode}</span>
        <span>formula={result.formulaVersion}</span>
        {stats ? (
          <>
            <span>raw rows={stats.rawRowCount}</span>
            <span>unique={stats.uniqueChannels}</span>
            <span className="text-fg-dim">
              dupes skipped={stats.duplicatesSkipped}
            </span>
            {stats.rowsWithoutChannelId > 0 ? (
              <span className="text-signal-up">
                no-id={stats.rowsWithoutChannelId}
              </span>
            ) : null}
          </>
        ) : null}
        <span className="text-accent-green">
          ranked={result.candidatesCount ?? ranked.length}
        </span>
        {isApply ? (
          <>
            <span className="text-accent-green">
              inserted={result.inserted ?? 0}
            </span>
            {result.logInserted != null ? (
              <span className="text-fg-dim">log={result.logInserted}</span>
            ) : null}
          </>
        ) : null}
        {result.durationMs != null ? (
          <span className="text-fg-dim">duration={result.durationMs}ms</span>
        ) : null}
      </div>
      {result.note ? (
        <p className="text-fg-dim text-[11px] mb-2">{result.note}</p>
      ) : null}
      {result.logError ? (
        <p className="text-signal-up text-[11px] mb-2">
          log insert 실패: {result.logError}
        </p>
      ) : null}

      {ranked.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] mb-2">
            <thead>
              <tr className="text-fg-dim text-left border-b border-border/40">
                <th className="py-1 w-8 text-right">rank</th>
                <th className="py-1 w-10 text-center" title="직전 산정 대비 변동">
                  Δ
                </th>
                <th className="py-1 w-10"></th>
                <th className="py-1">channel</th>
                <th className="py-1 w-16 text-right">score</th>
                <th className="py-1 w-14 text-right" title="normalized 0-100 (max=top)">
                  norm
                </th>
                <th className="py-1 w-16 text-right">sub</th>
                <th className="py-1 w-16 text-right">view</th>
                <th className="py-1 w-14 text-right">video</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.channelId} className="border-b border-border/30">
                  <td className="py-1 text-fg-dim text-right tabular-nums">
                    {r.rank}
                  </td>
                  <td className="py-1 text-center">
                    <RankChangeBadge
                      change={r.rankChange}
                      previousRank={r.previousRank}
                    />
                  </td>
                  <td className="py-1">
                    <ChannelThumb url={r.thumbnailUrl} alt={r.name} size={28} />
                  </td>
                  <td className="py-1">
                    <a
                      href={r.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-fg hover:text-brand"
                    >
                      {r.name}
                    </a>
                    <div className="text-fg-dim text-[10px] break-all">
                      {r.customUrl ?? r.channelId}
                    </div>
                  </td>
                  <td className="py-1 text-fg-muted text-right tabular-nums">
                    {r.score.toFixed(3)}
                  </td>
                  <td className="py-1 text-fg-muted text-right tabular-nums">
                    {r.scoreNormalized.toFixed(1)}
                  </td>
                  <td className="py-1 text-fg-muted text-right tabular-nums">
                    {formatKoreanCount(r.evidence.subscriber_count, {
                      hidden: r.evidence.subscribers_hidden,
                    })}
                  </td>
                  <td className="py-1 text-fg-muted text-right tabular-nums">
                    {formatKoreanCount(r.evidence.view_count)}
                  </td>
                  <td className="py-1 text-fg-muted text-right tabular-nums">
                    {formatKoreanCount(r.evidence.video_count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {rejected.length > 0 ? (
        <details className="mb-2">
          <summary className="text-fg text-[11px] cursor-pointer">
            rejected ({rejected.length})
          </summary>
          <ul className="mt-1 space-y-1">
            {rejected.map((r, i) => (
              <li
                key={i}
                className="text-signal-up text-[11px] flex gap-2 border-l-2 border-signal-up/40 pl-2"
              >
                <span className="text-fg-dim tabular-nums">#{i + 1}</span>
                <span>
                  {r.sourceRowId ? `[${r.sourceRowId}] ` : ""}
                  {r.reason}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-2 pt-2 border-t border-border/30 text-[10px] text-fg-dim space-y-0.5">
        {fetchedAt ? <div>{formatTime(fetchedAt)}</div> : null}
        {result.weights ? (
          <div>
            weights: sub={result.weights.subscriber} · view={result.weights.view}
            · video={result.weights.video}
          </div>
        ) : null}
      </div>
    </div>
  );
}
