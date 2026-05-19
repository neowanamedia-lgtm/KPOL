"use client";

import type { DemoPerson } from "@/data/people.mock";
import { RankSparkline } from "@/components/RankSparkline";
import {
  CloseIcon,
  StarIcon,
  StarIconFilled,
} from "@/components/icons";

interface Props {
  person: DemoPerson;
  isInterested: boolean;
  onToggleInterest: (id: string) => void;
  onClose: () => void;
}

function formatRank(rank: number): string {
  return rank < 100 ? rank.toString().padStart(2, "0") : rank.toString();
}

function ChangeSignal({ value }: { value: number }) {
  if (value > 0) {
    return <span className="text-signal-up tabular-nums">▲ +{value}</span>;
  }
  if (value < 0) {
    return <span className="text-signal-down tabular-nums">▼ {value}</span>;
  }
  return <span className="text-signal-flat tabular-nums">- 0</span>;
}

export function PersonDetail({
  person,
  isInterested,
  onToggleInterest,
  onClose,
}: Props) {
  const history = person.rankHistory7d;
  const today = history[history.length - 1];
  const yesterday = history[history.length - 2];
  const dayDelta = yesterday - today;
  const best = Math.min(...history);
  const worst = Math.max(...history);
  const toggle = () => onToggleInterest(person.id);

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* 헤더 — 닫기 X (우상단) / 사진 + 이름·별 (사진 우하단에 붙는 덩어리) */}
      <header className="shrink-0 px-6 pt-2 pb-5">
        {/* 1) 닫기 X 자체 row — 우측 끝 */}
        <div className="flex justify-end -mr-3 mb-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="상세 닫기"
            className="w-10 h-10 flex items-center justify-center text-fg-muted hover:text-fg transition-colors cursor-pointer touch-manipulation"
          >
            <CloseIcon className="w-5 h-5 pointer-events-none" />
          </button>
        </div>

        {/* 2) 사진 + 이름·별 — items-end로 사진 바닥에 이름이 붙음 */}
        <div className="flex items-end gap-3">
          <div
            className="w-[112px] h-[140px] rounded-md bg-elev flex items-center justify-center text-fg-muted text-[44px] font-medium select-none shrink-0"
            aria-hidden
          >
            {person.name.charAt(0)}
          </div>
          <div className="flex items-center gap-1 pb-1 min-w-0">
            <h1 className="text-fg text-[24px] font-medium leading-none truncate">
              {person.name}
            </h1>
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
          </div>
        </div>
      </header>

      {/* 본문 — 헤더 요약 제거, 바로 프로필부터 */}
      <main className="flex-1 overflow-y-auto px-6 pb-10">
        {/* 프로필 — div+flex 기반 정보표 (grid보다 wrap 안정적) */}
        {person.profile ? (
          <section className="pt-2 pb-6 kpol-text-detail space-y-0.5">
            <ProfileRow label="직책" value={person.currentRole} />
            <ProfileRow label="정당" value={person.profile.party} />
            <ProfileRow label="선거구" value={person.profile.constituency} />
            <ProfileRow label="생년" value={person.profile.birth} />
            <ProfileRow label="성별" value={person.profile.gender} />
            <ProfileRow label="직업" value={person.profile.occupation} />
            <ProfileRow label="소속" value={person.profile.affiliation} />
            <ProfileRow
              label="학력"
              value={person.profile.education.join(" · ")}
            />
            <ProfileRow
              label="경력"
              value={person.profile.career.join(" · ")}
            />
          </section>
        ) : (
          <section className="pt-2 pb-6 kpol-text-detail">
            <ProfileRow label="직책" value={person.currentRole} />
            <p className="text-fg-dim mt-3">
              프로필 정보는 다음 단계에서 채워집니다.
            </p>
          </section>
        )}

        {/* 순위 변화 차트 — 선·점 모두 흰색(text-fg) */}
        <section className="pt-5 pb-6">
          <h2 className="text-accent-green text-[13px] font-medium tracking-wide mb-3">
            순위 변화 · 최근 일주일
          </h2>
          <RankSparkline history={history} height={120} tone="fg" />
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 kpol-text-list-xs text-fg-dim tabular-nums">
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
              <dt>최고</dt>
              <dd className="text-fg font-medium">{formatRank(best)}위</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>최저</dt>
              <dd className="text-fg font-medium">{formatRank(worst)}위</dd>
            </div>
          </dl>
        </section>

        {/* 최근 주요 뉴스 */}
        <section className="pt-5">
          <h2 className="text-accent-green text-[13px] font-medium tracking-wide mb-3">
            최근 주요 뉴스
          </h2>
          {person.news && person.news.length > 0 ? (
            <ul className="space-y-3">
              {person.news.map((n, i) => (
                <li key={i} className="py-1">
                  <p className="text-fg kpol-text-meta leading-snug">{n.title}</p>
                  <p className="text-fg-dim kpol-text-list-xs mt-0.5 tabular-nums">
                    {n.source} · {n.time}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-dim kpol-text-detail">
              최근 주목 뉴스는 다음 단계에서 연결됩니다.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 leading-snug">
      <span className="text-fg-dim w-12 shrink-0">{label}</span>
      <span className="text-fg flex-1 min-w-0">{value}</span>
    </div>
  );
}
