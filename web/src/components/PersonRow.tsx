"use client";

import type { DemoPerson } from "@/data/people.mock";
import { RankSparkline } from "@/components/RankSparkline";

interface Props {
  person: DemoPerson;
  expanded: boolean;
  onToggle: (id: string) => void;
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

export function PersonRow({ person, expanded, onToggle }: Props) {
  return (
    <li className="border-b border-border">
      <button
        type="button"
        onClick={() => onToggle(person.id)}
        aria-expanded={expanded}
        className="kpol-row-pad w-full flex items-center gap-3 px-4 text-left leading-tight active:bg-elev hover:bg-elev/60 transition-colors"
      >
        <span className="kpol-text-rank text-fg-dim tabular-nums w-8 shrink-0">
          {formatRank(person.rank)}
        </span>
        <span className="kpol-text-name text-fg font-medium w-14 shrink-0 truncate">
          {person.name}
        </span>
        <span className="kpol-text-meta text-fg-muted flex-1 truncate">
          {person.currentRole}
        </span>
        <span className="kpol-text-signal shrink-0 w-16 text-right">
          <ChangeSignal value={person.rankChange24h} />
        </span>
      </button>

      {expanded ? <ExpandedDetail person={person} /> : null}
    </li>
  );
}

function ExpandedDetail({ person }: { person: DemoPerson }) {
  const history = person.rankHistory7d;
  const today = history[history.length - 1];
  const yesterday = history[history.length - 2];
  // 순위는 낮을수록 위. 어제 → 오늘 변화: yesterday - today 가 양수면 상승.
  const dayDelta = yesterday - today;
  const best = Math.min(...history); // 가장 좋은 순위 = 가장 작은 숫자
  const worst = Math.max(...history);

  return (
    <div className="px-4 pt-2 pb-4 bg-elev/40 border-t border-border/60">
      {/* 라인 차트 */}
      <RankSparkline history={history} height={90} />

      {/* 보조 정보 4개 — 한 줄, 모바일 좁은 폭이면 두 줄로 자동 줄바꿈 */}
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 kpol-text-list-xs text-fg-dim tabular-nums">
        <div className="flex gap-1.5">
          <dt>오늘</dt>
          <dd className="text-fg font-medium">{formatRank(today)}위</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>전일</dt>
          <dd>
            <ChangeSignal value={dayDelta} />
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>7d 최고</dt>
          <dd className="text-fg font-medium">{formatRank(best)}위</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>7d 최저</dt>
          <dd className="text-fg font-medium">{formatRank(worst)}위</dd>
        </div>
      </dl>

      {/* 최근 신호 — 있을 때만 */}
      {person.recentSignals && person.recentSignals.length > 0 ? (
        <section className="mt-3">
          <h3 className="kpol-text-list-xs text-fg-dim uppercase tracking-wider mb-1">
            최근 흐름
          </h3>
          <ul className="kpol-text-detail text-fg-muted space-y-0.5">
            {person.recentSignals.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
