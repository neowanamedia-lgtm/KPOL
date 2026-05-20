"use client";

import type {
  MediaProgramFull,
  MediaProgramHost,
  MediaProgramPanelist,
  MediaProgramPersonLink,
} from "@/lib/programs";
import { CloseIcon } from "@/components/icons";

/**
 * KPOL Media 프로그램 상세 화면 (skeleton).
 *
 * PersonDetail 의 구조·톤·간격을 그대로 미러링.
 * 메인 Shell.tsx 에 아직 연결 안 됨 — Media 탭 정식 도입 시 wiring.
 *
 * 사용 예 (admin 또는 미래 Media 탭):
 *   <ProgramDetail program={programFull} onClose={...} />
 *
 * 영상 리스트·관련 인물 graph 는 placeholder. 정식 데이터 wiring 은 후속.
 */

interface Props {
  program: MediaProgramFull;
  onClose: () => void;
}

function formatViews(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (n >= 100000000) return `${(n / 100000000).toFixed(1).replace(/\.0$/, "")}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  // ISO date(YYYY-MM-DD) 또는 timestamptz 모두 수용
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function ProgramDetail({ program, onClose }: Props) {
  const {
    title,
    broadcaster,
    channel_name,
    thumbnail_url,
    category,
    description,
    upload_frequency,
    started_at,
    ended_at,
    active_status,
    political_alignment,
    average_views,
    influence_score,
    external_url,
    hosts,
    panelists,
    person_links,
  } = program;

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* ── 헤더 — PersonDetail 동일 패턴 ── */}
      <header className="shrink-0 px-6 pt-2 pb-5">
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

        <div className="flex items-end gap-3">
          {thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail_url}
              alt={title}
              className="w-[112px] h-[112px] rounded-md object-cover bg-elev shrink-0"
            />
          ) : (
            <div
              className="w-[112px] h-[112px] rounded-md bg-elev flex items-center justify-center text-fg-muted text-[40px] font-medium select-none shrink-0"
              aria-hidden
            >
              {title.charAt(0)}
            </div>
          )}
          <div className="flex flex-col gap-1 pb-1 min-w-0">
            <h1 className="text-fg text-[22px] font-medium leading-tight truncate">
              {title}
            </h1>
            <div className="text-fg-dim kpol-text-list-xs truncate">
              {[broadcaster, channel_name].filter(Boolean).join(" · ") || "—"}
            </div>
            {influence_score != null ? (
              <div className="text-accent-green kpol-text-list-xs tabular-nums">
                영향력 {Number(influence_score).toFixed(2)}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── 본문 ── */}
      <main className="flex-1 overflow-y-auto px-6 pb-10">
        {/* 1) 정보표 — PersonDetail ProfileRow 패턴 */}
        <section className="pt-2 pb-6 kpol-text-detail space-y-0.5">
          <ProfileRow label="방송사" value={broadcaster ?? "-"} />
          <ProfileRow label="채널" value={channel_name ?? "-"} />
          <ProfileRow label="분류" value={category ?? "-"} />
          <ProfileRow
            label="편성"
            value={upload_frequency ?? "-"}
          />
          <ProfileRow
            label="상태"
            value={
              active_status === "active"
                ? "방송 중"
                : active_status === "ended"
                  ? "종영"
                  : active_status === "on_hiatus"
                    ? "휴방"
                    : active_status
            }
          />
          <ProfileRow label="시작" value={formatDate(started_at)} />
          {ended_at ? (
            <ProfileRow label="종영" value={formatDate(ended_at)} />
          ) : null}
          <ProfileRow label="누적 평균 조회" value={formatViews(average_views)} />
          {political_alignment ? (
            <ProfileRow label="성향" value={political_alignment} />
          ) : null}
          {external_url ? (
            <div className="flex gap-3 leading-snug">
              <span className="text-fg-dim w-16 shrink-0">공식</span>
              <a
                href={external_url}
                target="_blank"
                rel="noreferrer"
                className="text-fg hover:text-accent-green flex-1 min-w-0 truncate"
              >
                {external_url}
              </a>
            </div>
          ) : null}
        </section>

        {description ? (
          <section className="pb-6 kpol-text-detail">
            <p className="text-fg-muted whitespace-pre-wrap leading-relaxed">
              {description}
            </p>
          </section>
        ) : null}

        {/* 2) 진행자 */}
        <section className="pt-5">
          <SectionTitle>진행자</SectionTitle>
          {hosts.length > 0 ? (
            <ul className="space-y-2">
              {hosts.map((h) => (
                <HostRow key={h.id} host={h} />
              ))}
            </ul>
          ) : (
            <p className="text-fg-dim kpol-text-detail">등록된 진행자 없음</p>
          )}
        </section>

        {/* 3) 고정 패널 */}
        <section className="pt-5">
          <SectionTitle>고정 패널</SectionTitle>
          {panelists.length > 0 ? (
            <ul className="space-y-2">
              {panelists.map((p) => (
                <PanelistRow key={p.id} panelist={p} />
              ))}
            </ul>
          ) : (
            <p className="text-fg-dim kpol-text-detail">등록된 고정 패널 없음</p>
          )}
        </section>

        {/* 4) 최근 출연 정치인 (person_links) */}
        <section className="pt-5">
          <SectionTitle>최근 출연 / 관련 인물</SectionTitle>
          {person_links.length > 0 ? (
            <ul className="space-y-2">
              {person_links.slice(0, 20).map((l) => (
                <PersonLinkRow key={l.id} link={l} />
              ))}
            </ul>
          ) : (
            <p className="text-fg-dim kpol-text-detail">
              등록된 출연 기록 없음
            </p>
          )}
        </section>

        {/* 5) 최근 영상 — TODO: YouTube playlistItems API 도입 (할당량 검토) */}
        <section className="pt-5">
          <SectionTitle>최근 영상</SectionTitle>
          <p className="text-fg-dim kpol-text-detail">
            영상 리스트 준비 중 (YouTube API 연결 예정)
          </p>
        </section>

        {/* 6) 관련 인물 연결 — TODO: graph view 후속 */}
        <section className="pt-5">
          <SectionTitle>관련 인물 연결</SectionTitle>
          <p className="text-fg-dim kpol-text-detail">
            관계망 표시 준비 중
          </p>
        </section>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// sub-components — PersonDetail ProfileRow/제목 패턴 그대로
// ──────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-accent-green text-[13px] font-medium tracking-wide mb-3">
      {children}
    </h2>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 leading-snug">
      <span className="text-fg-dim w-16 shrink-0">{label}</span>
      <span className="text-fg flex-1 min-w-0">{value}</span>
    </div>
  );
}

function HostRow({ host }: { host: MediaProgramHost }) {
  return (
    <li className="py-1">
      <div className="text-fg kpol-text-meta">{host.person_name}</div>
      <div className="text-fg-dim kpol-text-list-xs">
        {host.role}
        {host.active ? "" : " · 종료"}
        {host.notes ? ` · ${host.notes}` : ""}
      </div>
    </li>
  );
}

function PanelistRow({ panelist }: { panelist: MediaProgramPanelist }) {
  return (
    <li className="py-1">
      <div className="text-fg kpol-text-meta">{panelist.person_name}</div>
      <div className="text-fg-dim kpol-text-list-xs">
        {[panelist.panel_role, panelist.cadence]
          .filter(Boolean)
          .join(" · ") || "고정 패널"}
        {panelist.active ? "" : " · 종료"}
        {panelist.notes ? ` · ${panelist.notes}` : ""}
      </div>
    </li>
  );
}

function PersonLinkRow({ link }: { link: MediaProgramPersonLink }) {
  const typeLabel =
    link.link_type === "guest_appearance"
      ? "출연"
      : link.link_type === "mention"
        ? "언급"
        : link.link_type === "clip_subject"
          ? "클립"
          : link.link_type === "interview"
            ? "인터뷰"
            : link.link_type;
  return (
    <li className="py-1">
      <div className="text-fg kpol-text-meta">
        {link.person_name}
        <span className="text-fg-dim ml-2">[{typeLabel}]</span>
      </div>
      <div className="text-fg-dim kpol-text-list-xs tabular-nums">
        {link.appearance_date ? formatDate(link.appearance_date) : "-"}
        {link.context ? ` · ${link.context}` : ""}
      </div>
      {link.source_url ? (
        <a
          href={link.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-fg-dim hover:text-accent-green kpol-text-list-xs underline underline-offset-2 truncate inline-block max-w-full"
        >
          {link.source_url}
        </a>
      ) : null}
    </li>
  );
}
