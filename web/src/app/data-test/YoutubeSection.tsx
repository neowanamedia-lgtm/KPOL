"use client";

import { useMemo, useState } from "react";

/**
 * /data-test admin 전용 YouTube 채널 sync 섹션.
 *
 * 메인 UI 무관. NEC 섹션과 동일 톤(검색 → preview → insert) 구조.
 * 1회 호출 1채널만 처리. UC...id 또는 @handle 만 입력 허용.
 */

interface YoutubeSample {
  channel_id: string | null;
  title: string | null;
  custom_url: string | null;
  description: string | null;
  published_at: string | null;
  thumbnail_high: string | null;
  subscriber_count: string | null;
  hidden_subscriber_count?: boolean;
  video_count: string | null;
  view_count: string | null;
  country: string | null;
}

interface YoutubeRowPreview {
  source: string;
  media_name: string;
  media_type: string;
  official_url: string;
  youtube_channel_url: string;
}

interface YoutubeGuard {
  input?: string;
  lookupKind?: string;
  lookupValue?: string;
  maxChannelsPerCall?: number;
  maxRawPayloadBytes?: number;
  requestUrl?: string;
}

interface YoutubeResponse {
  mode?: string;
  fetched?: number;
  acceptedCount?: number;
  rejectedCount?: number;
  inserted?: number;
  sample?: YoutubeSample;
  rowPreview?: YoutubeRowPreview;
  rejectedReasons?: { reason: string }[];
  note?: string;
  guard?: YoutubeGuard;
  error?: string;
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

function formatNumber(s: string | null | undefined) {
  if (s == null) return "-";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString("ko-KR");
}

export function YoutubeSection({
  adminKey,
  onSaved,
}: {
  adminKey: string;
  onSaved: () => void;
}) {
  const [channelInput, setChannelInput] = useState("");
  const [previewResult, setPreviewResult] = useState<YoutubeResponse | null>(
    null,
  );
  const [previewFetchedAt, setPreviewFetchedAt] = useState<Date | null>(null);
  const [insertResult, setInsertResult] = useState<YoutubeResponse | null>(null);
  const [insertFetchedAt, setInsertFetchedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState<"preview" | "insert" | null>(null);

  const trimmed = channelInput.trim();

  // 입력 변경 감지는 previewResult.guard.input 과 비교 — state 파생
  const previewedFor = previewResult?.guard?.input ?? null;
  const snapshotMatches = previewedFor != null && previewedFor === trimmed;

  // 입력이 preview 와 달라지면 stale 한 preview/insert 결과는 렌더 시 숨김
  const displayedPreview = previewResult && snapshotMatches ? previewResult : null;
  const displayedInsert =
    insertResult && (insertResult.guard?.input === trimmed || !trimmed)
      ? insertResult
      : null;

  const previewBlockReason = useMemo(() => {
    if (!adminKey) return "admin key 필요";
    if (!trimmed) return "채널 입력 필요 (UCxxx 또는 @handle)";
    return null;
  }, [adminKey, trimmed]);

  const canPreview = !previewBlockReason && !busy;

  const insertBlockReason = useMemo(() => {
    if (previewBlockReason) return previewBlockReason;
    if (!previewResult) return "먼저 preview 실행";
    if (previewResult.error) return `preview 실패: ${previewResult.error}`;
    if ((previewResult.acceptedCount ?? 0) === 0)
      return "preview 결과 accepted = 0";
    if (!snapshotMatches) return "입력 변경됨 — preview 재실행 필요";
    return null;
  }, [previewBlockReason, previewResult, snapshotMatches]);

  const canInsert = !insertBlockReason && !busy;

  const runRequest = async (mode: "preview" | "insert") => {
    const qs = new URLSearchParams({
      key: adminKey,
      mode,
      channel: trimmed,
    });
    const res = await fetch(`/api/sources/youtube/sync?${qs.toString()}`, {
      method: "POST",
    });
    return (await res.json()) as YoutubeResponse;
  };

  const onPreview = async () => {
    if (!canPreview) return;
    setBusy("preview");
    setInsertResult(null);
    setInsertFetchedAt(null);
    try {
      const json = await runRequest("preview");
      // 응답에 input 필드가 보장되지 않으면 우리가 보낸 값으로 보강 — snapshotMatches 비교용
      if (!json.guard) json.guard = {};
      if (!json.guard.input) json.guard.input = trimmed;
      setPreviewResult(json);
      setPreviewFetchedAt(new Date());
    } catch (e) {
      setPreviewResult({
        error: e instanceof Error ? e.message : String(e),
        guard: { input: trimmed },
      });
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
      const json = await runRequest("insert");
      if (!json.guard) json.guard = {};
      if (!json.guard.input) json.guard.input = trimmed;
      setInsertResult(json);
      setInsertFetchedAt(new Date());
      onSaved();
      // insert 성공 후 preview 결과는 무효 — 다시 preview 부터 시작
      setPreviewResult(null);
      setPreviewFetchedAt(null);
    } catch (e) {
      setInsertResult({
        error: e instanceof Error ? e.message : String(e),
        guard: { input: trimmed },
      });
      setInsertFetchedAt(new Date());
    } finally {
      setBusy(null);
    }
  };

  const previewBusy = busy === "preview";
  const insertBusy = busy === "insert";

  return (
    <section className="mb-8 border-t border-border/40 pt-6">
      <h2 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
        YouTube 채널 sync (channels.list · 1 채널/호출)
      </h2>
      <p className="text-fg-dim text-[11px] mb-3">
        ⚠️ admin 도구. UC + 22자 channel ID 또는 @handle 만 입력. custom URL /
        단일 이름은 미지원. 1회 호출 = 1채널 (quota 1 unit). HTML / base64 /
        32KB 초과 payload reject.
      </p>

      <div className="flex flex-col gap-2 mb-3">
        <label className="text-fg-dim text-[10px] uppercase tracking-wider">
          채널 입력 (필수)
        </label>
        <input
          type="text"
          value={channelInput}
          onChange={(e) => setChannelInput(e.target.value)}
          placeholder="예: UCabc... 또는 @handle 또는 https://www.youtube.com/@handle"
          className="px-3 py-2 bg-elev border border-border-strong rounded text-fg text-[14px]"
        />

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button
            type="button"
            onClick={onPreview}
            disabled={!canPreview}
            className="px-3 py-1.5 bg-elev border border-border-strong rounded text-fg hover:text-brand text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {previewBusy ? "조회 중…" : "1. 채널 preview (DB 쓰기 없음)"}
          </button>
          <button
            type="button"
            onClick={onInsert}
            disabled={!canInsert}
            className="px-3 py-1.5 bg-elev border border-brand rounded text-brand hover:bg-brand/10 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed disabled:border-border-strong disabled:text-fg-dim disabled:hover:bg-transparent"
          >
            {insertBusy ? "저장 중…" : "2. media_sources_raw insert"}
          </button>
          <span className="text-fg-dim text-[11px]">· 1회 1채널</span>
        </div>

        <div className="text-[11px]">
          {previewBlockReason ? (
            <span className="text-signal-up">
              preview 차단: {previewBlockReason}
            </span>
          ) : (
            <span className="text-accent-green">
              preview 가능 · channel=&quot;{trimmed}&quot;
            </span>
          )}
          {!previewBlockReason && insertBlockReason ? (
            <span className="text-fg-dim ml-3">
              insert 차단: {insertBlockReason}
            </span>
          ) : null}
        </div>
      </div>

      {previewBusy ? (
        <div className="text-fg-dim text-[11px] py-4">조회 중…</div>
      ) : displayedPreview ? (
        <YoutubeResultPanel
          title="preview 결과"
          result={displayedPreview}
          fetchedAt={previewFetchedAt}
        />
      ) : (
        <div className="text-fg-dim text-[11px] py-2">
          채널을 입력하고 preview 를 실행하세요.
        </div>
      )}

      {insertBusy ? (
        <div className="text-fg-dim text-[11px] py-4">저장 중…</div>
      ) : displayedInsert ? (
        <YoutubeResultPanel
          title="insert 결과"
          result={displayedInsert}
          fetchedAt={insertFetchedAt}
        />
      ) : null}
    </section>
  );
}

function YoutubeResultPanel({
  title,
  result,
  fetchedAt,
}: {
  title: string;
  result: YoutubeResponse;
  fetchedAt: Date | null;
}) {
  if (result.error) {
    return (
      <div className="mb-3 border border-signal-up/30 rounded p-3 bg-elev/30">
        <h3 className="text-signal-up text-[11px] uppercase tracking-wider mb-1">
          {title} — 실패
        </h3>
        <p className="text-signal-up text-[12px] break-words">{result.error}</p>
        {fetchedAt ? (
          <p className="text-fg-dim text-[10px] mt-1">{formatTime(fetchedAt)}</p>
        ) : null}
      </div>
    );
  }

  const rejected =
    (result.rejectedCount ?? 0) > 0 &&
    (result.acceptedCount ?? 0) === 0 &&
    (result.inserted ?? 0) === 0;
  const inserted = (result.inserted ?? 0) > 0;
  const accentClass = rejected
    ? "border-signal-up/30"
    : inserted
      ? "border-brand/30"
      : "border-border/40";

  return (
    <div className={`mb-3 border ${accentClass} rounded p-3 bg-elev/20`}>
      <h3 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="text-[12px] mb-2 flex flex-wrap gap-x-3 gap-y-1">
        <span>mode={result.mode ?? "-"}</span>
        <span>fetched={result.fetched ?? 0}</span>
        {result.acceptedCount != null ? (
          <span className="text-accent-green">
            accepted={result.acceptedCount}
          </span>
        ) : null}
        {result.inserted != null ? (
          <span className="text-accent-green">inserted={result.inserted}</span>
        ) : null}
        {result.rejectedCount != null ? (
          <span className="text-signal-up">rejected={result.rejectedCount}</span>
        ) : null}
      </div>
      {result.note ? (
        <p className="text-fg-dim text-[11px] mb-2">{result.note}</p>
      ) : null}

      {result.sample ? (
        <div className="mb-2">
          <h4 className="text-fg text-[11px] mb-1">채널 정보</h4>
          <table className="w-full text-[11px]">
            <tbody>
              <Row k="title" v={result.sample.title} highlight />
              <Row k="channel_id" v={result.sample.channel_id} mono />
              <Row k="custom_url" v={result.sample.custom_url} mono />
              <Row k="country" v={result.sample.country} />
              <Row k="published_at" v={result.sample.published_at} mono />
              <Row
                k="subscribers"
                v={
                  result.sample.hidden_subscriber_count
                    ? "비공개"
                    : formatNumber(result.sample.subscriber_count)
                }
              />
              <Row k="videos" v={formatNumber(result.sample.video_count)} />
              <Row k="views" v={formatNumber(result.sample.view_count)} />
              {result.sample.thumbnail_high ? (
                <tr className="border-b border-border/30">
                  <td className="py-1 text-fg-dim w-32">thumbnail</td>
                  <td className="py-1 text-fg-muted break-all">
                    {result.sample.thumbnail_high}
                  </td>
                </tr>
              ) : null}
              {result.sample.description ? (
                <tr className="border-b border-border/30">
                  <td className="py-1 text-fg-dim w-32 align-top">
                    description
                  </td>
                  <td className="py-1 text-fg-muted whitespace-pre-wrap break-words">
                    {result.sample.description.slice(0, 300)}
                    {result.sample.description.length > 300 ? " …" : ""}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {result.rowPreview ? (
        <details className="mb-2">
          <summary className="text-fg text-[11px] cursor-pointer">
            저장될 row 미리보기 (media_sources_raw)
          </summary>
          <pre className="text-fg-muted text-[11px] overflow-x-auto bg-elev/40 p-2 rounded mt-1">
            {JSON.stringify(result.rowPreview, null, 2)}
          </pre>
        </details>
      ) : null}

      {result.rejectedReasons && result.rejectedReasons.length > 0 ? (
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
      ) : null}

      <div className="mt-2 pt-2 border-t border-border/30 text-[10px] text-fg-dim space-y-0.5">
        {fetchedAt ? <div>{formatTime(fetchedAt)}</div> : null}
        {result.guard?.requestUrl ? (
          <div className="break-all">
            source: <span className="text-fg-muted">{result.guard.requestUrl}</span>
          </div>
        ) : null}
        {result.guard ? (
          <div>
            guard: lookupKind={result.guard.lookupKind} · max=
            {result.guard.maxChannelsPerCall} ch · maxPayload=
            {result.guard.maxRawPayloadBytes}B
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  mono,
  highlight,
}: {
  k: string;
  v: string | null | undefined;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <tr className="border-b border-border/30">
      <td className="py-1 text-fg-dim w-32">{k}</td>
      <td
        className={`py-1 ${highlight ? "text-fg" : "text-fg-muted"} ${
          mono ? "tabular-nums" : ""
        } break-all`}
      >
        {v ?? "-"}
      </td>
    </tr>
  );
}
