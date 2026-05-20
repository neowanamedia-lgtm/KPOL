"use client";

import { useCallback, useEffect, useState } from "react";
import type { MediaProgramFull } from "@/lib/programs";
import {
  MediaProgramRow,
  type MediaProgramListItem,
} from "@/components/MediaProgramRow";
import { ProgramDetail } from "@/components/ProgramDetail";

/**
 * KPOL Media 탭 본체 — Shell 의 중앙 스크롤 영역에 들어감.
 *
 * Controlled: selectedId / onOpen / onClose 를 Shell 이 관리해서,
 * "미디어" 탭 버튼 재탭 시 Shell 이 onClose 트리거 → 자연스럽게 리스트 복귀.
 *
 * - GET /api/programs (active 만, top 100)
 * - GET /api/programs/[id] → ProgramDetail full-screen overlay
 *
 * UX/톤은 Person 리스트와 동일 (간격·색·텍스트 utility 동일).
 */

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; programs: MediaProgramListItem[] };

interface Props {
  /** 현재 열린 ProgramDetail 의 program id (없으면 리스트만 표시) */
  selectedId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
}

export function MediaPane({ selectedId, onOpen, onClose }: Props) {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [detail, setDetail] = useState<MediaProgramFull | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setList({ status: "loading" });
    try {
      const res = await fetch("/api/programs?limit=100", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setList({ status: "error", message: json.error ?? `HTTP ${res.status}` });
        return;
      }
      const programs = (json.programs ?? []) as MediaProgramListItem[];
      setList(
        programs.length > 0
          ? { status: "ready", programs }
          : { status: "empty" },
      );
    } catch (e) {
      setList({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadList();
  }, [loadList]);

  // selectedId 가 바뀌면 detail fetch.
  // null 이 되면 detail/err/loading 모두 초기화 (Shell 의 탭 재탭 close 와 정합).
  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      setDetailErr(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setDetailLoading(true);
    setDetailErr(null);
    (async () => {
      try {
        const res = await fetch(`/api/programs/${selectedId}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setDetailErr(json.error ?? `HTTP ${res.status}`);
          return;
        }
        setDetail(json as MediaProgramFull);
      } catch (e) {
        if (cancelled) return;
        setDetailErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return (
    <>
      {list.status === "loading" ? (
        <div className="px-4 py-16 text-center kpol-text-detail text-fg-dim">
          불러오는 중…
        </div>
      ) : list.status === "error" ? (
        <div className="px-4 py-16 text-center kpol-text-detail text-fg-dim">
          데이터를 불러오지 못했습니다.
          <div className="text-fg-dim/70 text-[11px] mt-1">{list.message}</div>
        </div>
      ) : list.status === "empty" ? (
        <div className="px-4 py-16 text-center kpol-text-detail text-fg-dim">
          미디어 프로그램 준비 중
        </div>
      ) : (
        <ul className="pb-8">
          {list.programs.map((p, i) => (
            <MediaProgramRow
              key={p.id}
              rank={i + 1}
              program={p}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}

      {/* detail overlay — PersonDetail 와 동일 fixed inset-0 z-50 패턴 */}
      {selectedId && detailLoading ? (
        <div className="fixed inset-0 z-50 bg-bg flex items-center justify-center kpol-text-detail text-fg-dim">
          불러오는 중…
        </div>
      ) : null}
      {selectedId && detailErr ? (
        <div className="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center px-6 kpol-text-detail text-fg-dim text-center">
          <p>프로그램 상세를 불러오지 못했습니다.</p>
          <p className="text-fg-dim/70 text-[11px] mt-2">{detailErr}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 text-accent-green kpol-text-detail underline underline-offset-2"
          >
            닫기
          </button>
        </div>
      ) : null}
      {detail ? (
        <ProgramDetail program={detail} onClose={onClose} />
      ) : null}
    </>
  );
}
