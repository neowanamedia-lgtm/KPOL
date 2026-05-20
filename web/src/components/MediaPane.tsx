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
 * - GET /api/programs (active 만, influence_score desc)
 * - 행 클릭 → GET /api/programs/[id] → ProgramDetail full-screen overlay
 *
 * UX/톤은 Person 리스트와 동일 (간격·색·텍스트 utility 동일).
 * 메인 Shell 의 레이아웃·상단/하단 네비게이션은 건드리지 않음.
 */

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; programs: MediaProgramListItem[] };

export function MediaPane() {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [openId, setOpenId] = useState<string | null>(null);
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

  // openId 가 바뀌면 detail fetch. openId=null 일 때는 무동작 — onCloseDetail 이 detail 도 클리어.
  useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    // 동기 setState (effect body) — 외부 fetch 직전 상태 클리어.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    setDetailLoading(true);
    setDetailErr(null);
    (async () => {
      try {
        const res = await fetch(`/api/programs/${openId}`, {
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
  }, [openId]);

  const onOpen = (id: string) => setOpenId(id);
  const onCloseDetail = () => {
    setOpenId(null);
    setDetail(null);
    setDetailErr(null);
    setDetailLoading(false);
  };

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
      {openId && detailLoading ? (
        <div className="fixed inset-0 z-50 bg-bg flex items-center justify-center kpol-text-detail text-fg-dim">
          불러오는 중…
        </div>
      ) : null}
      {openId && detailErr ? (
        <div className="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center px-6 kpol-text-detail text-fg-dim text-center">
          <p>프로그램 상세를 불러오지 못했습니다.</p>
          <p className="text-fg-dim/70 text-[11px] mt-2">{detailErr}</p>
          <button
            type="button"
            onClick={onCloseDetail}
            className="mt-4 text-accent-green kpol-text-detail underline underline-offset-2"
          >
            닫기
          </button>
        </div>
      ) : null}
      {detail ? (
        <ProgramDetail program={detail} onClose={onCloseDetail} />
      ) : null}
    </>
  );
}
