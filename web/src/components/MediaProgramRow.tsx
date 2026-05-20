"use client";

import type { MediaProgram, MediaProgramHost } from "@/lib/programs";

/**
 * KPOL Media 프로그램 1줄 카드 — PersonRow 의 패턴·간격·텍스트 utility 그대로.
 *
 * 좌측: [순위] [프로그램명]   (클릭 영역 — 상세 진입)
 * 가운데: [방송사 · 진행자]   (truncate)
 * 우측: [영향력 점수 or —]    (tabular-nums)
 *
 * 썸네일·전체 진행자·고정 패널·상태 등은 ProgramDetail overlay 에서 표시.
 */

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
}

interface Props {
  rank: number;
  program: MediaProgramListItem;
  onOpen: (id: string) => void;
}

function formatRank(rank: number): string {
  return rank < 100 ? rank.toString().padStart(2, "0") : rank.toString();
}

function formatScore(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(Number(s))) return "—";
  return Number(s).toFixed(2);
}

function buildMeta(p: MediaProgramListItem): string {
  const parts: string[] = [];
  const broadcaster = (p.broadcaster ?? "").trim();
  const channel = (p.channel_name ?? "").trim();
  if (broadcaster) parts.push(broadcaster);
  else if (channel) parts.push(channel);

  // 진행자 1명만 표시 (밀도 보존). 여러 명이면 " 외" 표기.
  const hosts = (p.hosts ?? []).filter((h) => !!h.person_name);
  if (hosts.length === 1) parts.push(hosts[0].person_name);
  else if (hosts.length > 1)
    parts.push(`${hosts[0].person_name} 외 ${hosts.length - 1}`);

  return parts.join(" · ");
}

export function MediaProgramRow({ rank, program, onOpen }: Props) {
  const meta = buildMeta(program);
  return (
    <li className="border-b border-border">
      <div className="kpol-row-pad w-full flex items-center gap-2.5 px-4 leading-tight">
        <button
          type="button"
          onClick={() => onOpen(program.id)}
          aria-label={`${program.title} 상세 보기`}
          className="flex items-center gap-2.5 text-left cursor-pointer touch-manipulation shrink-0 active:opacity-60 transition-opacity"
        >
          <span className="kpol-text-rank tabular-nums shrink-0 min-w-[2em] text-fg-dim">
            {formatRank(rank)}
          </span>
          <span className="kpol-text-name font-medium shrink-0 whitespace-nowrap text-fg">
            {program.title}
          </span>
        </button>
        <span className="kpol-text-meta text-fg-muted flex-1 min-w-0 truncate">
          {meta || "—"}
        </span>
        <span className="kpol-text-signal shrink-0 text-right whitespace-nowrap tabular-nums text-fg-dim">
          {formatScore(program.influence_score)}
        </span>
      </div>
    </li>
  );
}
