"use client";

import { useEffect, useState } from "react";
import type { MediaProgramFull } from "@/lib/programs";
import { CloseIcon, StarIcon, StarIconFilled } from "@/components/icons";

/**
 * KPOL 미디어 프로그램 간단 정보 모달 — 중앙 compact 카드.
 *
 * 디자인:
 *   - 화면 중앙 정렬 (fixed inset-0 + flex items-center)
 *   - max-w-xs 좁은 카드. 줄 간격/패딩 최소화
 *   - 한 화면에 모두 보이도록 스크롤 없음
 *   - 라벨:값 inline 형식 (예: "진행자: 김명준")
 *
 * 표시 항목 (사용자 spec):
 *   [프로그램명]   [★] [×]
 *   진행자: 김명준
 *   고정 패널: a, b
 *   구독자 수: 152만명
 *   어제 조회수: 84만회
 *   [채널 방문하기]
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

  // 진행자 / 패널 — 쉼표 join, active=true 만
  const hostNames = (program?.hosts ?? [])
    .filter((h) => h.active !== false)
    .map((h) => h.person_name)
    .join(", ");
  const panelistNames = (program?.panelists ?? [])
    .filter((p) => p.active !== false)
    .map((p) => p.person_name)
    .join(", ");

  // 구독자 수
  const subscriberLabel = program?.channel?.hidden_subscriber_count
    ? "비공개"
    : program?.channel?.subscriber_count != null
      ? `${formatViewsKo(program.channel.subscriber_count)}명`
      : null;

  // 어제 조회수
  const previousDayViewLabel =
    program?.daily_ranking?.previous_day_view_count != null
      ? `${formatViewsKo(program.daily_ranking.previous_day_view_count)}회`
      : null;

  // 채널 URL
  const visitUrl =
    program?.channel?.official_url ??
    program?.external_url ??
    (program?.youtube_channel_id
      ? `https://www.youtube.com/channel/${program.youtube_channel_id}`
      : null);

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
          className="bg-bg border border-border-strong rounded-lg w-full max-w-xs px-4 py-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
        >
          {loading || !program ? (
            <p className="kpol-text-detail text-fg-dim py-2 text-center">
              {error ? `불러오기 실패: ${error}` : "불러오는 중…"}
            </p>
          ) : (
            <>
              {/* 프로그램명 + 별 + 닫기 */}
              <div className="flex items-center gap-1 min-w-0 mb-3">
                <h2
                  className={`text-[16px] font-medium leading-tight truncate flex-1 ${
                    isInterested ? "text-accent-green" : "text-fg"
                  }`}
                >
                  {program.title}
                </h2>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={isInterested ? "관심 해제" : "관심 등록"}
                  aria-pressed={isInterested}
                  className={`w-7 h-7 flex items-center justify-center transition-colors cursor-pointer touch-manipulation shrink-0 ${
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
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="닫기"
                  className="w-7 h-7 flex items-center justify-center text-fg-muted hover:text-fg cursor-pointer touch-manipulation shrink-0"
                >
                  <CloseIcon className="w-4 h-4 pointer-events-none" />
                </button>
              </div>

              {/* 정보 라인 — 라벨:값 inline, 줄간격 최소 */}
              <div className="space-y-1 kpol-text-meta">
                {hostNames ? (
                  <div className="truncate">
                    <span className="text-fg-dim">진행자:</span>{" "}
                    <span className="text-fg">{hostNames}</span>
                  </div>
                ) : null}
                {panelistNames ? (
                  <div className="truncate">
                    <span className="text-fg-dim">고정 패널:</span>{" "}
                    <span className="text-fg">{panelistNames}</span>
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
                {previousDayViewLabel ? (
                  <div>
                    <span className="text-fg-dim">어제 조회수:</span>{" "}
                    <span className="text-fg tabular-nums">
                      {previousDayViewLabel}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* 채널 방문하기 CTA */}
              {visitUrl ? (
                <a
                  href={visitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block mt-4 px-3 py-2 rounded-md bg-accent-green/10 border border-accent-green/50 text-accent-green text-center kpol-text-meta font-medium active:opacity-70 transition-opacity touch-manipulation"
                >
                  채널 방문하기
                </a>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
