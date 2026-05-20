"use client";

import type {
  MediaProgramFull,
  MediaProgramHost,
  MediaProgramPanelist,
  MediaProgramPersonLink,
  MediaProgramChannelStats,
  MediaProgramRecentVideo,
} from "@/lib/programs";
import { CloseIcon, StarIcon, StarIconFilled } from "@/components/icons";
import { RankSparkline } from "@/components/RankSparkline";

/**
 * KPOL Media 프로그램 상세 화면 — immersive 콘텐츠 프로필 구조.
 *
 * 상단 (헤더 — 콘텐츠 소개 중심):
 *   [×]
 *   [Title] [★]
 *   [짧은 소개 문장]
 *   [방송사 · 채널명]  (중복이면 자동 dedup)
 *   [편성 시간]
 *
 * 본문 (밀도 정리):
 *   - 영향력 추이 sparkline (recent_activity.daily_view_series 가 ≥2일 때만)
 *   - 최근 영상 · 최근 2주 (snapshot 있으면 표시)
 *   - 진행자 / 고정 패널 / 최근 출연·관련 인물
 *   - 채널 누적 지표 (참고, channel 데이터 있을 때만 — 맨 아래)
 *
 * 제거된 영역 (사용자 지시):
 *   - 상단 썸네일
 *   - "전날 조회수 · 랭킹 기준" DailyRankingHeadline
 *   - "일일 스냅샷 준비 중" placeholder
 *   - ProfileRow (상태/시작/종영/카테고리 등 — 의미 약함)
 *   - 본문 description (헤더로 이동)
 */

interface Props {
  program: MediaProgramFull;
  isInterested: boolean;
  onToggleInterest: (id: string) => void;
  onClose: () => void;
}

function formatViews(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (n >= 100000000)
    return `${(n / 100000000).toFixed(1).replace(/\.0$/, "")}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
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

/**
 * "MBN · MBN" 같은 중복 표기 방지 — 동일 값이면 한 번만.
 */
function buildBroadcasterChannelLine(
  broadcaster: string | null,
  channelName: string | null,
): string {
  const b = (broadcaster ?? "").trim();
  const c = (channelName ?? "").trim();
  if (!b && !c) return "";
  if (!b) return c;
  if (!c) return b;
  if (b === c) return b;
  return `${b} · ${c}`;
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
    description,
    upload_frequency,
    hosts,
    panelists,
    person_links,
    channel,
    recent_activity,
    recent_videos,
  } = program;

  const broadcasterChannelLine = buildBroadcasterChannelLine(
    broadcaster ?? null,
    channel_name ?? null,
  );

  // sparkline — recent_activity.daily_view_series ≥2 일 때만 섹션 표시
  const sparklineHistory = recent_activity?.daily_view_series ?? [];
  const showSparkline = sparklineHistory.length >= 2;

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* ── 헤더 — 콘텐츠 소개 중심 (썸네일 없음) ── */}
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

        {/* 타이틀 + 별 (PersonDetail 동일 패턴) */}
        <div className="flex items-center gap-1 min-w-0">
          <h1
            className={`text-[22px] font-medium leading-tight truncate ${
              isInterested ? "text-accent-green" : "text-fg"
            }`}
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

        {/* 짧은 소개 문장 — 타이틀 바로 아래 */}
        {description ? (
          <p className="text-fg-muted kpol-text-detail mt-2 leading-relaxed">
            {description}
          </p>
        ) : null}

        {/* 방송사 · 채널명 (중복 dedup) */}
        {broadcasterChannelLine ? (
          <div className="text-fg-dim kpol-text-list-xs mt-3 truncate">
            {broadcasterChannelLine}
          </div>
        ) : null}

        {/* 편성 시간 */}
        {upload_frequency ? (
          <div className="text-fg-dim kpol-text-list-xs mt-0.5 truncate">
            {upload_frequency}
          </div>
        ) : null}
      </header>

      {/* ── 본문 ── */}
      <main className="flex-1 overflow-y-auto px-6 pb-10">
        {/* 영향력 추이 — 데이터 있을 때만 (≥2일 누적) */}
        {showSparkline ? (
          <section className="pt-2 pb-6">
            <SectionTitle>영향력 추이 · 최근 2주</SectionTitle>
            <RankSparkline history={sparklineHistory} height={120} tone="fg" />
            {recent_activity ? (
              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 kpol-text-list-xs text-fg-dim tabular-nums">
                {recent_activity.upload_count != null ? (
                  <div className="flex gap-1.5">
                    <dt>업로드</dt>
                    <dd className="text-fg font-medium">
                      {recent_activity.upload_count}회
                    </dd>
                  </div>
                ) : null}
                {recent_activity.avg_view_count != null ? (
                  <div className="flex gap-1.5">
                    <dt>평균 조회</dt>
                    <dd className="text-fg font-medium">
                      {formatViews(recent_activity.avg_view_count)}
                    </dd>
                  </div>
                ) : null}
                {recent_activity.max_view_count != null ? (
                  <div className="flex gap-1.5">
                    <dt>최고</dt>
                    <dd className="text-fg font-medium">
                      {formatViews(recent_activity.max_view_count)}
                    </dd>
                  </div>
                ) : null}
                {recent_activity.last_upload_at ? (
                  <div className="flex gap-1.5">
                    <dt>최근</dt>
                    <dd className="text-fg font-medium">
                      {formatDate(recent_activity.last_upload_at)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </section>
        ) : null}

        {/* 최근 영상 — snapshot 데이터 있을 때만 */}
        <RecentVideosSection videos={recent_videos ?? null} />

        {/* 진행자 */}
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

        {/* 고정 패널 */}
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

        {/* 최근 출연 / 관련 인물 */}
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

        {/* 채널 누적 지표 — 참고, 맨 아래 */}
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

function RecentVideosSection({
  videos,
}: {
  videos: MediaProgramRecentVideo[] | null;
}) {
  if (!videos || videos.length === 0) {
    return (
      <section className="pt-5">
        <SectionTitle>최근 영상 · 최근 2주</SectionTitle>
        <p className="text-fg-dim kpol-text-detail">영상 정보 없음</p>
      </section>
    );
  }
  return (
    <section className="pt-5">
      <SectionTitle>최근 영상 · 최근 2주</SectionTitle>
      <ul className="space-y-3">
        {videos.slice(0, 20).map((v) => (
          <li
            key={v.video_id}
            className="py-1 border-b border-border/40 last:border-0"
          >
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
