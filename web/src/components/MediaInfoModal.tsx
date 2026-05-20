"use client";

import { useEffect, useState } from "react";
import type { MediaProgramFull } from "@/lib/programs";
import { CloseIcon, StarIcon, StarIconFilled } from "@/components/icons";

/**
 * KPOL 미디어 프로그램 간단 정보 모달 — 바텀시트.
 *
 * 풀스크린 ProgramDetail (immersive) 을 대체. 리스트 중심 UX 유지하면서
 * "빠르게 확인하고 닫는 구조" 로 단순화.
 *
 * 표시 항목 (정보 밀도 최소):
 *   - 타이틀 + 별 + 닫기
 *   - 진행자 (있으면)
 *   - 고정 패널 (있으면)
 *   - 구독자 수 (channel 데이터 있을 때)
 *   - 어제 조회수 (daily_ranking 있을 때)
 *   - "채널 방문하기" CTA (channel.official_url > external_url > /channel/{id})
 *
 * 제거된 영역:
 *   - 상세 설명, ProfileRow, sparkline, recent videos, person_links 전부 미표시
 *   - 페이지 전환 ✗, fixed bottom 바텀시트 만
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

  const hostNames = (program?.hosts ?? [])
    .filter((h) => h.active !== false)
    .map((h) => h.person_name)
    .join(" · ");
  const panelistNames = (program?.panelists ?? [])
    .filter((p) => p.active !== false)
    .map((p) => p.person_name)
    .join(" · ");

  const subscriberLabel = program?.channel?.hidden_subscriber_count
    ? "비공개"
    : formatViewsKo(program?.channel?.subscriber_count);
  const showSubscriber =
    program?.channel != null &&
    (program.channel.hidden_subscriber_count ||
      program.channel.subscriber_count != null);

  const previousDayView = formatViewsKo(
    program?.daily_ranking?.previous_day_view_count,
  );
  const showPreviousDayView =
    program?.daily_ranking?.previous_day_view_count != null;

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
      {/* Bottom sheet */}
      <div
        className="fixed left-0 right-0 bottom-0 z-50 bg-bg border-t border-border-strong rounded-t-xl flex flex-col max-h-[80dvh]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="overflow-y-auto px-6 pt-5 pb-6">
          {loading || !program ? (
            <p className="kpol-text-detail text-fg-dim py-8 text-center">
              {error ? `불러오기 실패: ${error}` : "불러오는 중…"}
            </p>
          ) : (
            <>
              {/* 타이틀 + 별 + 닫기 */}
              <div className="flex items-center gap-1 min-w-0 mb-4">
                <h2
                  className={`text-[18px] font-medium leading-tight truncate flex-1 ${
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
                  className={`w-8 h-8 flex items-center justify-center transition-colors cursor-pointer touch-manipulation shrink-0 ${
                    isInterested
                      ? "text-accent-green"
                      : "text-fg-dim hover:text-fg-muted"
                  }`}
                >
                  {isInterested ? (
                    <StarIconFilled className="w-[18px] h-[18px] pointer-events-none" />
                  ) : (
                    <StarIcon className="w-[18px] h-[18px] pointer-events-none" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="닫기"
                  className="w-10 h-10 flex items-center justify-center text-fg-muted hover:text-fg cursor-pointer touch-manipulation shrink-0"
                >
                  <CloseIcon className="w-5 h-5 pointer-events-none" />
                </button>
              </div>

              {/* 진행자 / 고정 패널 */}
              <div className="space-y-3">
                {hostNames ? (
                  <div>
                    <div className="text-fg-dim kpol-text-list-xs mb-0.5">
                      진행자
                    </div>
                    <div className="text-fg kpol-text-meta">{hostNames}</div>
                  </div>
                ) : null}
                {panelistNames ? (
                  <div>
                    <div className="text-fg-dim kpol-text-list-xs mb-0.5">
                      고정 패널
                    </div>
                    <div className="text-fg kpol-text-meta">{panelistNames}</div>
                  </div>
                ) : null}
              </div>

              {/* 구독자 수 / 어제 조회수 */}
              {showSubscriber || showPreviousDayView ? (
                <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5">
                  {showSubscriber ? (
                    <div>
                      <div className="text-fg-dim kpol-text-list-xs mb-0.5">
                        구독자 수
                      </div>
                      <div className="text-fg kpol-text-meta font-medium tabular-nums">
                        {subscriberLabel}
                      </div>
                    </div>
                  ) : null}
                  {showPreviousDayView ? (
                    <div>
                      <div className="text-fg-dim kpol-text-list-xs mb-0.5">
                        어제 조회수
                      </div>
                      <div className="text-fg kpol-text-meta font-medium tabular-nums">
                        {previousDayView}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* 채널 방문하기 CTA — 가장 하단 강조 */}
              {visitUrl ? (
                <a
                  href={visitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block mt-6 px-4 py-3 rounded-md bg-accent-green/10 border border-accent-green/50 text-accent-green text-center kpol-text-meta font-medium active:opacity-70 transition-opacity touch-manipulation"
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
