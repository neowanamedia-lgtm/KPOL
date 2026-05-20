"use client";

import { useEffect, useState } from "react";
import type { MediaProgramFull } from "@/lib/programs";
import { CloseIcon, StarIcon, StarIconFilled } from "@/components/icons";

/**
 * KPOL 미디어 프로그램 간단 정보 모달 — 중앙 compact 카드.
 *
 * 랭킹 기준 = "최근 24시간 총조회수" (backend: previous_day_view_count).
 *
 * 표시 (값 없는 행은 자동 숨김):
 *   - 진행자: (hosts + panelists 병렬 표시)
 *   - 구독자 수
 *   - 최근 24시간 총조회수
 *   - 영상당 평균 조회수      (channel.view_count / channel.video_count)
 *   - 조회수 대비 구독자 비율  (channel.subscriber_count / channel.view_count, %)
 *   - 최근 업로드 영상 목록 (최대 3건, 클릭 시 YouTube 새 탭)
 *
 * 제거된 항목: "채널 방문하기" CTA.
 */

interface Props {
  id: string | null;
  isInterested: boolean;
  onToggleInterest: (id: string) => void;
  onClose: () => void;
}

function formatViewsKo(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (n >= 100000000)
    return `${(n / 100000000).toFixed(1).replace(/\.0$/, "")}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
}

/**
 * 영상 제목 앞의 대괄호 메타 라벨 strip — [LIVE]/[라이브]/[2026-05-20]/[코너명] 등.
 * 연속된 대괄호도 모두 제거. 본문만 남김.
 */
function stripBracketPrefix(title: string | null | undefined): string {
  if (!title) return "";
  return title.replace(/^(?:\s*\[[^\]]*\]\s*)+/, "").trim();
}

/**
 * 구독자 대비 조회수 비율 — (영상당 평균 조회수 ÷ 구독자 수) × 100%.
 * 두 값 모두 > 0 일 때만 계산. 최대 1자리 소수.
 */
function formatAvgPerSubPercent(
  avgViewsPerVideo: number | null | undefined,
  subscriber: number | null | undefined,
): string | null {
  if (avgViewsPerVideo == null || !Number.isFinite(avgViewsPerVideo))
    return null;
  if (avgViewsPerVideo <= 0) return null; // > 0 만 표시
  if (subscriber == null || !Number.isFinite(subscriber) || subscriber <= 0)
    return null;
  const pct = (avgViewsPerVideo / subscriber) * 100;
  if (!Number.isFinite(pct) || pct <= 0) return null;
  // 1자리 소수까지, 정수면 ".0" 트림
  return `${pct.toFixed(1).replace(/\.0$/, "")}%`;
}

export function MediaInfoModal({
  id,
  isInterested,
  onToggleInterest,
  onClose,
}: Props) {
  const [program, setProgram] = useState<MediaProgramFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgram(null);
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/programs/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? `HTTP ${res.status}`);
          return;
        }
        setProgram(json as MediaProgramFull);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) return null;

  // 진행자 + 고정 패널 병렬 — 단일 "진행자:" 행에 함께 표시
  const peopleNames = [
    ...(program?.hosts ?? [])
      .filter((h) => h.active !== false)
      .map((h) => h.person_name),
    ...(program?.panelists ?? [])
      .filter((p) => p.active !== false)
      .map((p) => p.person_name),
  ].join(", ");

  // 구독자 수 — subscriber_count > 0 일 때만 (0/null 은 숨김, 비공개는 라벨 표시)
  const subscriberCount = program?.channel?.subscriber_count ?? null;
  const subscriberHidden = program?.channel?.hidden_subscriber_count === true;
  const subscriberLabel = subscriberHidden
    ? "비공개"
    : subscriberCount != null && subscriberCount > 0
      ? `${formatViewsKo(subscriberCount)}명`
      : null;

  // 최근 24시간 총조회수 (= snapshot 의 previous_day_view_count, 24h 업로드 영상 누적 합)
  const view24h = program?.daily_ranking?.previous_day_view_count ?? null;
  const view24hLabel = view24h != null ? `${formatViewsKo(view24h)}회` : null;

  // 24h 영상 수 — recent_video_count 가 24h 윈도우 수
  const recent24hVideoCount =
    program?.daily_ranking?.recent_video_count ?? null;

  // 영상당 평균 조회수 — UI 노출 ✗. 단 ratio 계산용으로 내부 유지.
  const avg24h =
    view24h != null &&
    recent24hVideoCount != null &&
    recent24hVideoCount > 0
      ? view24h / recent24hVideoCount
      : null;

  // 구독자 대비 조회수 비율 = 영상당 평균(24h) ÷ 구독자 수 × 100 %
  const viewSubRatioLabel = subscriberHidden
    ? null
    : formatAvgPerSubPercent(avg24h, subscriberCount);

  // 최근 업로드 영상 — published_at desc 로 정렬, 상위 3건
  const recentVideos = (program?.recent_videos ?? [])
    .slice()
    .sort((a, b) => {
      const at = a.published_at ? Date.parse(a.published_at) : 0;
      const bt = b.published_at ? Date.parse(b.published_at) : 0;
      return bt - at;
    })
    .slice(0, 3);
  const showRecentVideos = recentVideos.length > 0;

  const toggle = () => {
    if (program) onToggleInterest(program.id);
  };

  return (
    <>
      {/* Backdrop — 탭 시 닫기 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="fixed inset-0 z-40 bg-black/60 cursor-pointer"
      />
      {/* Compact center modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pointer-events-none">
        <div
          className="bg-elev border border-border-strong rounded-lg w-full max-w-xs px-4 py-4 pointer-events-auto shadow-xl"
          role="dialog"
          aria-modal="true"
        >
          {loading || !program ? (
            <p className="kpol-text-detail text-fg-dim py-2 text-center">
              {error ? `불러오기 실패: ${error}` : "불러오는 중…"}
            </p>
          ) : (
            <>
              {/* 헤더 행 — [타이틀 ★]   [×] */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-baseline min-w-0">
                  <h2 className="text-[16px] font-medium leading-tight text-accent-green">
                    {program.title}
                  </h2>
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={isInterested ? "관심 해제" : "관심 등록"}
                    aria-pressed={isInterested}
                    className={`ml-1 w-5 h-5 inline-flex items-center justify-center self-center transition-colors cursor-pointer touch-manipulation shrink-0 ${
                      isInterested
                        ? "text-accent-green"
                        : "text-fg-dim hover:text-fg-muted"
                    }`}
                  >
                    {isInterested ? (
                      <StarIconFilled className="w-4 h-4 pointer-events-none" />
                    ) : (
                      <StarIcon className="w-4 h-4 pointer-events-none" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="닫기"
                  className="w-7 h-7 flex items-center justify-center text-fg-muted hover:text-fg cursor-pointer touch-manipulation shrink-0"
                >
                  <CloseIcon className="w-4 h-4 pointer-events-none" />
                </button>
              </div>

              {/* 정보 라인 — 라벨:값 inline, wrap 허용 */}
              <div className="space-y-1 kpol-text-meta">
                {peopleNames ? (
                  <div>
                    <span className="text-fg-dim">진행자:</span>{" "}
                    <span className="text-fg">{peopleNames}</span>
                  </div>
                ) : null}
                {subscriberLabel ? (
                  <div>
                    <span className="text-fg-dim">구독자 수:</span>{" "}
                    <span className="text-fg tabular-nums">
                      {subscriberLabel}
                    </span>
                  </div>
                ) : null}
                {view24hLabel ? (
                  <div>
                    <span className="text-fg-dim">최근 24시간 총조회수:</span>{" "}
                    <span className="text-fg tabular-nums">{view24hLabel}</span>
                  </div>
                ) : null}
                {viewSubRatioLabel ? (
                  <div>
                    <span className="text-fg-dim">
                      구독자 대비 조회수 비율:
                    </span>{" "}
                    <span className="text-fg tabular-nums">
                      {viewSubRatioLabel}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* 최근 업로드 영상 목록 — snapshot 있을 때만 */}
              {showRecentVideos ? (
                <div className="mt-4">
                  <div className="text-fg-dim kpol-text-list-xs mb-1">
                    최근 업로드 영상 목록
                  </div>
                  <ul className="space-y-1">
                    {recentVideos.map((v) => {
                      const cleanTitle = stripBracketPrefix(v.title) || "(제목 없음)";
                      return (
                        <li key={v.video_id} className="leading-snug">
                          <a
                            href={`https://www.youtube.com/watch?v=${v.video_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-fg kpol-text-meta hover:text-fg-muted active:opacity-70 touch-manipulation block truncate"
                          >
                            {cleanTitle}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
