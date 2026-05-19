"use client";

import type { DemoPerson } from "@/data/people.mock";

interface Props {
  person: DemoPerson;
  interested: boolean;
  onOpen: (id: string) => void;
}

function formatRank(rank: number): string {
  return rank < 100 ? rank.toString().padStart(2, "0") : rank.toString();
}

function ChangeSignal({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="text-signal-up tabular-nums font-medium" aria-label={`상승 ${value}`}>
        ▲ +{value}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="text-signal-down tabular-nums font-medium" aria-label={`하락 ${Math.abs(value)}`}>
        ▼ {value}
      </span>
    );
  }
  return (
    <span className="text-signal-flat tabular-nums font-medium" aria-label="변동 없음">
      - 0
    </span>
  );
}

export function PersonRow({ person, interested, onOpen }: Props) {
  const rankClass = interested ? "text-accent-green" : "text-fg-dim";
  const nameClass = interested ? "text-accent-green" : "text-fg";

  return (
    <li className="border-b border-border">
      {/* 행 컨테이너는 일반 div — 클릭 이벤트 ✗. 스크롤만. */}
      <div className="kpol-row-pad w-full flex items-center gap-2.5 px-4 leading-tight">
        {/* 상세 진입은 순위 + 이름 영역만 */}
        <button
          type="button"
          onClick={() => onOpen(person.id)}
          aria-label={`${person.name} 상세 보기`}
          className="flex items-center gap-2.5 text-left cursor-pointer touch-manipulation shrink-0 active:opacity-60 transition-opacity"
        >
          <span className={`kpol-text-rank tabular-nums shrink-0 min-w-[2em] ${rankClass}`}>
            {formatRank(person.rank)}
          </span>
          <span className={`kpol-text-name font-medium shrink-0 whitespace-nowrap ${nameClass}`}>
            {person.name}
          </span>
        </button>
        {/* 직책 — 클릭 ✗ */}
        <span className="kpol-text-meta text-fg-muted flex-1 min-w-0 truncate">
          {person.currentRole}
        </span>
        {/* 변동 — 클릭 ✗ */}
        <span className="kpol-text-signal shrink-0 text-right whitespace-nowrap">
          <ChangeSignal value={person.rankChange24h} />
        </span>
      </div>
    </li>
  );
}
