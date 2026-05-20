"use client";

import type {
  MediaProgramFull,
  MediaProgramHost,
  MediaProgramPanelist,
  MediaProgramPersonLink,
  MediaProgramChannelStats,
  MediaProgramDailyRanking,
  MediaProgramRecentVideo,
} from "@/lib/programs";
import { CloseIcon, StarIcon, StarIconFilled } from "@/components/icons";
import { RankSparkline } from "@/components/RankSparkline";

/**
 * KPOL Media 프로그램 상세 화면.
 *
 * 랭킹 기준 = "전날 조회수" 단일 지표 (kpol-data-ingest-safety v2).
 *   - 상단 강조: 전날 조회수 · 순위 · 변동
 *   - 최근 2주 영상 리스트 (실 데이터)
 *   - 누적 채널 지표 (구독자/총 조회 등) 는 맨 아래 보조 정보
 *
 * PersonDetail 의 구조/톤/간격 그대로 미러:
 *   - fixed inset-0 z-50 bg-bg flex flex-col
 *   - 우상단 X close
 *   - 헤더 (썸네일 + 타이틀)
 *   - SectionTitle (text-accent-green) 으로 구분
 */

interface Props {
  program: MediaProgramFull;
  isInterested: boolean;
  onToggleInterest: (id: string) => void;
  onClose: () => void;
}

function formatViews(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (n >= 100000000) return `${(n / 100000000).toFixed(1).replace(/\.0$/, "")}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
}

function formatViewsExact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString("ko-KR");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function RankDeltaInline({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-signal-flat tabular-nums">– 0</span>;
  }
  if (value > 0) {
    return (
      <span className="text-signal-up tabular-nums font-medium">▲ +{value}</span>
    );
  }
  if (value < 0) {
    return (
      <span className="text-signal-down tabular-nums font-medium">▼ {value}</span>
    );
  }
  return <span className="text-signal-flat tabular-nums">– 0</span>;
}

export function ProgramDetail({
  program,
  isInterested,
  onToggleInterest,
  onClose,
}: Props) {
  const toggle = () => onToggleInterest(program.id);
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
    external_url,
    hosts,
    panelists,
    person_links,
    channel,
    daily_ranking,
    recent_videos,
    recent_activity,
  } = program;

  // 헤더 썸네일 우선순위
  const headerThumb = channel?.thumbnail_url ?? thumbnail_url ?? null;

  // sparkline history — recent_activity.daily_view_series 우선
  const sparklineHistory = recent_activity?.daily_view_series ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* ── 헤더 ── */}
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
          {headerThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={headerThumb}
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
            <div className="flex items-center gap-1 min-w-0">
              <h1
                className={`text-[22px] font-medium leading-tight truncate ${isInterested ? "text-accent-green" : "text-fg"}`}
              >
                {title}
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
            <div className="text-fg-dim kpol-text-list-xs truncate">
              {[broadcaster, channel_name].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        </div>
      </header>

      {/* ── 본문 ── */}
      <main className="flex-1 overflow-y-auto px-6 pb-10">
        {/* 1) 전날 조회수 강조 — 단일 지표 랭킹 기준 */}
        <DailyRankingHeadline ranking={daily_ranking ?? null} />

        {/* 2) 정보표 */}
        <section className="pt-2 pb-6 kpol-text-detail space-y-0.5">
          <ProfileRow label="방송사" value={broadcaster ?? "-"} />
          <ProfileRow label="채널" value={channel_name ?? "-"} />
          <ProfileRow label="분류" value={category ?? "-"} />
          <ProfileRow label="편성" value={upload_frequency ?? "-"} />
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

        {/* 3) 영향력 추이 sparkline — 데이터 누적 후 표시 */}
        <section className="pt-5 pb-6">
          <SectionTitle>영향력 추이 · 최근 2주</SectionTitle>
          <RankSparkline history={sparklineHistory} height={120} tone="fg" />
          {sparklineHistory.length < 2 ? (
            <p className="mt-3 kpol-text-list-xs text-fg-dim">
              일일 snapshot 누적 후 표시됩니다 (최소 2일 필요).
            </p>
          ) : null}
        </section>

        {/* 4) 최근 영상 · 최근 2주 — youtube_video_daily_snapshots 최신 */}
        <RecentVideosSection videos={recent_videos ?? null} />

        {/* 5) 진행자 */}
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

        {/* 6) 고정 패널 */}
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

        {/* 7) 최근 출연 / 관련 인물 */}
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

        {/* 8) YouTube 채널 누적 지표 — 보조 정보 (맨 아래로) */}
        {channel ? <ChannelStatsSection channel={channel} /> : null}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// sub-components
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

function DailyRankingHeadline({
  ranking,
}: {
  ranking: MediaProgramDailyRanking | null;
}) {
  if (!ranking || ranking.previous_day_view_count == null) {
    return (
      <section className="pt-2 pb-4">
        <SectionTitle>전날 조회수 · 랭킹 기준</SectionTitle>
        <p className="text-fg-dim kpol-text-detail">
          일일 snapshot 준비 중 — 14:00 KST 자동 산정 후 표시됩니다.
        </p>
      </section>
    );
  }
  return (
    <section className="pt-2 pb-5">
      <SectionTitle>전날 조회수 · 랭킹 기준</SectionTitle>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-fg text-[28px] font-medium tabular-nums leading-none">
          {formatViewsExact(ranking.previous_day_view_count)}
        </span>
        <span className="text-fg-dim kpol-text-list-xs">조회</span>
        {ranking.rank != null ? (
          <span className="text-accent-green kpol-text-meta tabular-nums">
            #{ranking.rank}위
          </span>
        ) : null}
        <span className="kpol-text-meta">
          <RankDeltaInline value={ranking.rank_delta} />
        </span>
      </div>
      <p className="mt-2 kpol-text-list-xs text-fg-dim">
        최근 {ranking.recent_window_days}일 영상 {ranking.recent_video_count}개의
        24h 누적 조회수 합 · {formatDate(ranking.snapshot_date)} 기준
      </p>
    </section>
  );
}

function RecentVideosSection({
  videos,
}: {
  videos: MediaProgramRecentVideo[] | null;
}) {
  return (
    <section className="pt-5">
      <SectionTitle>최근 영상 · 최근 2주</SectionTitle>
      {videos && videos.length > 0 ? (
        <ul className="space-y-3">
          {videos.slice(0, 20).map((v) => (
            <li key={v.video_id} className="py-1 border-b border-border/40 last:border-0">
              <a
                href={`https://www.youtube.com/watch?v=${v.video_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-fg kpol-text-meta leading-snug hover:text-accent-green block"
              >
                {v.title ?? "(제목 없음)"}
              </a>
              <div className="text-fg-dim kpol-text-list-xs mt-0.5 tabular-nums flex flex-wrap gap-x-2.5 gap-y-0.5">
                {v.published_at ? (
                  <span>{formatDate(v.published_at)}</span>
                ) : null}
                <span>총 {formatViews(v.cumulative_view_count)}</span>
                {v.daily_view_delta != null ? (
                  <span className="text-fg">
                    +{formatViews(v.daily_view_delta)} (24h)
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-dim kpol-text-detail">
          영상 데이터 준비 중 (YouTube snapshot 후 표시)
        </p>
      )}
    </section>
  );
}

function ChannelStatsSection({ channel }: { channel: MediaProgramChannelStats }) {
  const sub = channel.hidden_subscriber_count
    ? "비공개"
    : formatViews(channel.subscriber_count);
  const view = formatViews(channel.view_count);
  const video =
    channel.video_count != null
      ? channel.video_count.toLocaleString("ko-KR")
      : "-";
  return (
    <section className="pt-5">
      <SectionTitle>채널 누적 지표 (참고)</SectionTitle>
      <p className="text-fg-dim kpol-text-list-xs mb-2">
        ※ 랭킹 산정엔 사용 안 함 — 채널 규모 참고용
      </p>
      <div className="kpol-text-detail space-y-0.5">
        <ProfileRow label="구독자" value={sub} />
        <ProfileRow label="누적 조회" value={view} />
        <ProfileRow label="영상 수" value={video} />
        {channel.published_at ? (
          <ProfileRow label="개설일" value={formatDate(channel.published_at)} />
        ) : null}
        {channel.country ? (
          <ProfileRow label="국가" value={channel.country} />
        ) : null}
        {channel.channel_title ? (
          <ProfileRow label="채널명" value={channel.channel_title} />
        ) : null}
        {channel.custom_url ? (
          <div className="flex gap-3 leading-snug">
            <span className="text-fg-dim w-16 shrink-0">handle</span>
            <span className="text-fg flex-1 min-w-0 truncate">
              {channel.custom_url}
            </span>
          </div>
        ) : null}
        <div className="flex gap-3 leading-snug">
          <span className="text-fg-dim w-16 shrink-0">채널</span>
          <a
            href={channel.official_url}
            target="_blank"
            rel="noreferrer"
            className="text-fg hover:text-accent-green flex-1 min-w-0 truncate"
          >
            {channel.official_url}
          </a>
        </div>
      </div>
    </section>
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
