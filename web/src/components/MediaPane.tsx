"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MediaProgramRow,
  type MediaProgramListItem,
} from "@/components/MediaProgramRow";

/**
 * KPOL Media 탭 본체 — Shell 의 중앙 스크롤 영역에 들어감.
 *
 * 책임 = 리스트만. 상세 overlay 는 Shell root 레벨의 <MediaDetailOverlay /> 가 담당.
 * (PersonDetail 처럼 root 직속 렌더해야 main 의 stacking context 를 벗어남 — header/nav 위로 immersive 점유.)
 *
 * - GET /api/programs (active 만, top 100)
 * - 행 클릭 시 onOpen(id) → Shell 의 mediaProgramId state 갱신
 */

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; programs: MediaProgramListItem[] };

interface Props {
  onOpen: (id: string) => void;
}

export function MediaPane({ onOpen }: Props) {
  const [list, setList] = useState<ListState>({ status: "loading" });

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

  if (list.status === "loading") {
    return (
      <div className="px-4 py-16 text-center kpol-text-detail text-fg-dim">
        불러오는 중…
      </div>
    );
  }
  if (list.status === "error") {
    return (
      <div className="px-4 py-16 text-center kpol-text-detail text-fg-dim">
        데이터를 불러오지 못했습니다.
        <div className="text-fg-dim/70 text-[11px] mt-1">{list.message}</div>
      </div>
    );
  }
  if (list.status === "empty") {
    return (
      <div className="px-4 py-16 text-center kpol-text-detail text-fg-dim">
        미디어 프로그램 준비 중
      </div>
    );
  }
  return (
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
  );
}
