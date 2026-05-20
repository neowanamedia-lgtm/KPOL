"use client";

import { useEffect, useState } from "react";
import type { MediaProgramFull } from "@/lib/programs";
import { ProgramDetail } from "@/components/ProgramDetail";

/**
 * KPOL Media 프로그램 상세 overlay — Shell root level 에서 렌더.
 *
 * PersonDetail 과 동일 immersive 패턴:
 *   - Shell 의 `<div className="fixed inset-0 flex flex-col">` 형제로 렌더
 *   - main(z-0) 안에 갇히지 않아 header/nav(z-20) 위에 자연스럽게 stack
 *   - 자체 fixed inset-0 z-50 bg-bg 로 화면 전체 immersive 점유
 *
 * 책임:
 *   - id 변경 감지 → /api/programs/[id] fetch
 *   - loading / error / ready 상태 표시 (KPOL 톤)
 *   - id=null 이면 아무것도 렌더 안 함
 */

interface Props {
  id: string | null;
  /** 현재 id 의 즐겨찾기 상태 (Shell 의 mediaInterestSet.has(id)). */
  isInterested: boolean;
  /** 별 토글 핸들러 — program.id 전달. */
  onToggleInterest: (id: string) => void;
  onClose: () => void;
}

export function MediaDetailOverlay({
  id,
  isInterested,
  onToggleInterest,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<MediaProgramFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
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
        setDetail(json as MediaProgramFull);
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

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-bg flex items-center justify-center kpol-text-detail text-fg-dim">
        불러오는 중…
      </div>
    );
  }
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center px-6 kpol-text-detail text-fg-dim text-center">
        <p>프로그램 상세를 불러오지 못했습니다.</p>
        <p className="text-fg-dim/70 text-[11px] mt-2">{error}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-accent-green kpol-text-detail underline underline-offset-2"
        >
          닫기
        </button>
      </div>
    );
  }
  if (detail) {
    return (
      <ProgramDetail
        program={detail}
        isInterested={isInterested}
        onToggleInterest={onToggleInterest}
        onClose={onClose}
      />
    );
  }
  return null;
}
