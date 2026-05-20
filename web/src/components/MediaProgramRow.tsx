"use client";

import type { MediaProgram, MediaProgramHost } from "@/lib/programs";

/**
 * KPOL Media 프로그램 1줄 카드 — PersonRow 의 패턴·간격·텍스트 utility 그대로.
 *
 * 좌측: [순위] [프로그램명]   (클릭 영역 — 상세 진입)
 * 가운데: [방송사]            (truncate)
 * 우측: [순위 변동 신호]      (▲/▼/-, PersonRow ChangeSignal 동일 톤)
 *
 * 진행자/패널/썸네일/score 는 ProgramDetail overlay 에서만 표시 (밀도 보호).
 *
 * rank_change 는 현재 항상 0 (변동 source 미도입 — 추후 14일 활동 기반).
 */

// hosts 는 list 응답에 포함되지만 카드엔 표시 안 함 (밀도 보호). 타입만 유지해 API 호환.
export interface MediaProgramListItem
  extends Pick<
    MediaProgram,
    | "id"
    | "title"
    | "broadcaster"
    | "channel_name"
    | "influence_score"
    | "active_status"
  > {
  hosts?: Pick<MediaProgramHost, "person_name" | "role">[];
  rank_change?: number | null;
}

interface Props {
  rank: number;
  program: MediaProgramListItem;
  onOpen: (id: string) => void;
}

function formatRank(rank: number): string {
  return rank < 100 ? rank.toString().padStart(2, "0") : rank.toString();
}

// PersonRow 와 동일 — clip-paste duplicate (PersonRow 파일 미수정 원칙 보존).
function ChangeSignal({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span
        className="text-signal-up tabular-nums font-medium"
        aria-label={`상승 ${value}`}
      >
        ▲ +{value}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span
        className="text-signal-down tabular-nums font-medium"
        aria-label={`하락 ${Math.abs(value)}`}
      >
        ▼ {value}
      </span>
    );
  }
  return (
    <span
      className="text-signal-flat tabular-nums font-medium"
      aria-label="변동 없음"
    >
      - 0
    </span>
  );
}

function buildMeta(p: MediaProgramListItem): string {
  // 진행자 제거 — 프로그램명과 중복 방지. 방송사 / 채널명 만 짧게.
  const broadcaster = (p.broadcaster ?? "").trim();
  if (broadcaster) return broadcaster;
  const channel = (p.channel_name ?? "").trim();
  return channel || "—";
}

export function MediaProgramRow({ rank, program, onOpen }: Props) {
  const meta = buildMeta(program);
  const change = typeof program.rank_change === "number" ? program.rank_change : 0;
  return (
    <li className="border-b border-border">
      <div className="kpol-row-pad w-full flex items-center gap-2.5 px-4 leading-tight">
        <button
          type="button"
          onClick={() => onOpen(program.id)}
          aria-label={`${program.title} 상세 보기`}
          className="flex flex-1 items-center gap-2.5 text-left cursor-pointer touch-manipulation min-w-0 active:opacity-60 transition-opacity"
        >
          <span className="kpol-text-rank tabular-nums shrink-0 min-w-[2em] text-fg-dim">
            {formatRank(rank)}
          </span>
          <span className="kpol-text-name font-medium min-w-0 truncate text-fg">
            {program.title}
          </span>
        </button>
        <span className="kpol-text-meta text-fg-muted shrink-0 whitespace-nowrap max-w-[28%] truncate">
          {meta}
        </span>
        <span className="kpol-text-signal shrink-0 text-right whitespace-nowrap">
          <ChangeSignal value={change} />
        </span>
      </div>
    </li>
  );
}
