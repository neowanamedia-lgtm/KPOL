"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PersonRow } from "@/components/PersonRow";
import { PersonDetail } from "@/components/PersonDetail";
import { MediaPane } from "@/components/MediaPane";
import { MediaInfoModal } from "@/components/MediaInfoModal";
import { fireEvent, type CategoryTarget } from "@/lib/analytics";
import {
  MinusIcon,
  MoonIconFilled,
  PlusIcon,
  ShareIcon,
  SunIcon,
} from "@/components/icons";
import { DEMO_PEOPLE } from "@/data/people.mock";

type Scale = 0 | 1 | 2 | 3;
type Theme = "day" | "night";

const SHARE_TEXT = `KPOL

정치·미디어·선거 흐름을
실시간 KPOL TOP100으로 확인하세요.

지금 가장 주목받는 인물과 이슈를
한눈에 볼 수 있습니다.

www.kpol.한국`;

const SHARE_URL = "https://www.kpol.한국";

function clampScale(n: number): Scale {
  if (n <= 0) return 0;
  if (n >= 3) return 3;
  return n as Scale;
}

type TabKey = "people" | "media" | "by-election" | "local-election";

const TABS: { key: TabKey; label: string }[] = [
  { key: "people", label: "인물" },
  { key: "by-election", label: "보궐선거" },
  { key: "local-election", label: "지방선거" },
  { key: "media", label: "미디어" },
];

const TAB_EVENT_TARGET: Record<TabKey, CategoryTarget> = {
  people: "person",
  "by-election": "by_election",
  "local-election": "local_election",
  media: "media",
};

const BASIS_BY_TAB: Record<TabKey, string> = {
  people: "산정 기준: 순위 변동 · 24시 · 14:00 자동집계",
  "by-election": "산정 기준: 후보 단위 신호 · 24시 · 14:00 자동집계",
  "local-election": "산정 기준: 후보 단위 신호 · 24시 · 14:00 자동집계",
  media: "산정 기준: 최근 24시간 총조회수 자동 집계",
};

const SCALE_KEY = "kpol-scale";
const THEME_KEY = "kpol-theme";
const INTERESTS_KEY = "kpol-interests";
const MEDIA_INTERESTS_KEY = "kpol-media-interests";

function loadInitialScale(): Scale {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(SCALE_KEY);
  const n = raw === null ? 0 : parseInt(raw, 10);
  return n === 1 || n === 2 || n === 3 ? n : 0;
}

function loadInitialTheme(): Theme {
  if (typeof window === "undefined") return "night";
  const raw = window.localStorage.getItem(THEME_KEY);
  return raw === "day" ? "day" : "night";
}

function loadInitialInterests(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INTERESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function loadInitialMediaInterests(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MEDIA_INTERESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function Shell() {
  const [activeTab, setActiveTab] = useState<TabKey>("people");
  const [detailId, setDetailId] = useState<string | null>(null);
  /**
   * 미디어 탭의 ProgramDetail overlay 상태 — Shell 에서 들고 있어야
   * "미디어" 탭 버튼 재탭 시 overlay 자동 닫기가 가능 (Person 의 detailId 와 같은 패턴).
   */
  const [mediaProgramId, setMediaProgramId] = useState<string | null>(null);
  const [scale, setScale] = useState<Scale>(0);
  const [theme, setTheme] = useState<Theme>("night");
  const [interests, setInterests] = useState<string[]>([]);
  const [mediaInterests, setMediaInterests] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const interestSet = useMemo(() => new Set(interests), [interests]);
  const mediaInterestSet = useMemo(
    () => new Set(mediaInterests),
    [mediaInterests],
  );
  const detailPerson = useMemo(
    () => (detailId ? DEMO_PEOPLE.find((p) => p.id === detailId) ?? null : null),
    [detailId],
  );

  // hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    // localStorage → React state 동기화 (외부 시스템 sync)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScale(loadInitialScale());
    setTheme(loadInitialTheme());
    setInterests(loadInitialInterests());
    setMediaInterests(loadInitialMediaInterests());
  }, []);

  // PWA 실행 시 1회 이벤트 (mount 시. is_pwa는 analytics에서 standalone 감지)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
    if (isStandalone) fireEvent("pwa_launch");
  }, []);

  // persist interests
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(INTERESTS_KEY, JSON.stringify(interests));
  }, [interests]);

  // persist media interests (별도 key — UUID 풀, person id 와 분리)
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      MEDIA_INTERESTS_KEY,
      JSON.stringify(mediaInterests),
    );
  }, [mediaInterests]);

  // sync to <html data-scale> + persist
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.scale = String(scale);
    window.localStorage.setItem(SCALE_KEY, String(scale));
  }, [scale]);

  // sync to <html data-theme> + persist
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const openDetail = (id: string) => setDetailId(id);
  const closeDetail = () => setDetailId(null);

  const toggleInterest = (id: string) => {
    setInterests((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    );
  };

  const toggleMediaInterest = (id: string) => {
    setMediaInterests((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    );
  };

  const toggleTheme = () =>
    setTheme((t) => (t === "night" ? "day" : "night"));
  const decScale = () => setScale((s) => clampScale(s - 1));
  const incScale = () => setScale((s) => clampScale(s + 1));

  const handleShare = async () => {
    fireEvent("share_click");
    // 1) native share sheet
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "KPOL",
          text: SHARE_TEXT,
          url: SHARE_URL,
        });
        return;
      } catch (err) {
        // 사용자 취소는 AbortError — silent.
        if (err instanceof Error && err.name === "AbortError") return;
        // 그 외 실패는 clipboard로 fallback (아래로 진행)
      }
    }
    // 2) clipboard fallback
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(`${SHARE_TEXT}\n${SHARE_URL}`);
        showToast("공유 문구가 복사되었습니다.");
        return;
      } catch {
        // 아래로 진행
      }
    }
    // 3) 모두 실패
    showToast("공유를 사용할 수 없습니다. 배포 주소에서 다시 시도해 주세요.");
  };

  return (
    <>
      <div className="fixed inset-0 flex flex-col bg-bg">
        {/* ── 상단 고정: 3줄 — 내부 가로줄 일체 없음, 한 덩어리 배경 ── */}
        <header className="shrink-0 bg-bg relative z-20">
          {/* 1줄: 로고 단독 — 자동집계 텍스트는 3줄로 이동 */}
          <div className="flex items-center px-4 pt-2 pb-1">
            <h1 className="kpol-text-brand text-brand font-normal leading-none">
              KPOL&nbsp;TOP100
            </h1>
          </div>

          {/* 2줄: 4탭 — flex-1 균등 분배, 모든 텍스트 cell 가운데 정렬.
              각 텍스트의 visual center가 화면 폭 1/8, 3/8, 5/8, 7/8에 정확히 위치. */}
          <nav>
            <ul className="flex w-full">
              {TABS.map((t) => {
                const active = t.key === activeTab;
                return (
                  <li key={t.key} className="flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab(t.key);
                        // 탭 재탭 시 열린 detail overlay 들을 모두 닫아 자연스럽게 리스트로 복귀.
                        setDetailId(null);
                        setMediaProgramId(null);
                        fireEvent("category_click", {
                          event_target: TAB_EVENT_TARGET[t.key],
                        });
                      }}
                      className={`kpol-text-tab w-full h-9 pt-2 flex items-end justify-center leading-none transition-colors ${
                        active
                          ? "text-fg font-medium"
                          : "text-fg-dim hover:text-fg-muted"
                      }`}
                    >
                      [{t.label}]
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* 3줄: 산정 기준 띄 — 상세 설명 모달 제거. 비대화형 표시만. */}
          <div className="relative z-10 flex items-center px-4 h-8">
            <span className="kpol-text-basis tracking-wide">
              <span className="text-accent-green font-medium">산정 기준</span>
              <span className="text-fg-dim">
                {BASIS_BY_TAB[activeTab].replace("산정 기준", "")}
              </span>
            </span>
          </div>
        </header>

        {/* ── 중앙 독립 스크롤 ── */}
        <main
          className="flex-1 overflow-y-auto overscroll-contain relative z-0"
        >
          {activeTab === "people" ? (
            <ul className="pb-8">
              {DEMO_PEOPLE.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  interested={interestSet.has(p.id)}
                  onOpen={openDetail}
                />
              ))}
            </ul>
          ) : activeTab === "media" ? (
            <MediaPane
              onOpen={setMediaProgramId}
              interestSet={mediaInterestSet}
            />
          ) : (
            <PlaceholderPane label={TABS.find((t) => t.key === activeTab)!.label} />
          )}
        </main>

        {/* ── 하단 고정: 컨트롤 바 (safe-area 바로 위에 얇게 붙음) ── */}
        <nav
          className="shrink-0 bg-bg relative z-20"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-3 items-end h-16 px-4 pb-1.5">
            {/* 좌: Day/Night 토글 — 명확히 보이도록 text-fg */}
            <div className="flex justify-start">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === "night" ? "Day 모드로 전환" : "Night 모드로 전환"}
                aria-pressed={theme === "day"}
                className="w-9 h-9 flex items-end justify-center pb-[6px] text-fg hover:text-brand transition-colors cursor-pointer touch-manipulation"
              >
                {theme === "night" ? (
                  <SunIcon className="w-5 h-5 pointer-events-none" />
                ) : (
                  <MoonIconFilled className="w-5 h-5 pointer-events-none" />
                )}
              </button>
            </div>

            {/* 중: 공유 — 즉시 native share sheet 호출 */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleShare}
                aria-label="공유"
                className="w-9 h-9 flex items-end justify-center pb-[6px] text-fg hover:text-brand active:opacity-70 transition-all cursor-pointer touch-manipulation"
              >
                <ShareIcon className="w-5 h-5 pointer-events-none" />
              </button>
            </div>

            {/* 우: 글자 크기 - / + */}
            <div className="flex justify-end items-center gap-1.5">
              <button
                type="button"
                onClick={decScale}
                disabled={scale === 0}
                aria-label="글자 크기 줄이기"
                className={`w-[25px] h-[25px] rounded-full border flex items-center justify-center touch-manipulation transition-colors ${
                  scale === 0
                    ? "border-border bg-elev/60 text-fg-dim/40 cursor-not-allowed"
                    : "border-fg-muted bg-elev text-fg hover:text-brand cursor-pointer"
                }`}
              >
                <MinusIcon className="w-[13px] h-[13px] pointer-events-none" />
              </button>
              <button
                type="button"
                onClick={incScale}
                disabled={scale === 3}
                aria-label="글자 크기 키우기"
                className={`w-[25px] h-[25px] rounded-full border flex items-center justify-center touch-manipulation transition-colors ${
                  scale === 3
                    ? "border-border bg-elev/60 text-fg-dim/40 cursor-not-allowed"
                    : "border-fg-muted bg-elev text-fg hover:text-brand cursor-pointer"
                }`}
              >
                <PlusIcon className="w-[13px] h-[13px] pointer-events-none" />
              </button>
            </div>
          </div>
        </nav>
      </div>

      {detailPerson ? (
        <PersonDetail
          person={detailPerson}
          isInterested={interestSet.has(detailPerson.id)}
          onToggleInterest={toggleInterest}
          onClose={closeDetail}
        />
      ) : null}

      {/* 미디어 프로그램 정보 모달 — Shell root level 직속 렌더.
          상세 페이지 대신 바텀시트로 빠른 정보 확인 후 닫기. */}
      <MediaInfoModal
        id={activeTab === "media" ? mediaProgramId : null}
        isInterested={
          mediaProgramId ? mediaInterestSet.has(mediaProgramId) : false
        }
        onToggleInterest={toggleMediaInterest}
        onClose={() => setMediaProgramId(null)}
      />

      {/* Toast — 공유 결과/실패 안내. 2.5s 후 자동 사라짐. */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2 rounded-md bg-elev text-fg text-[13px] border border-border-strong shadow-lg pointer-events-none"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}

function PlaceholderPane({ label }: { label: string }) {
  return (
    <div className="px-4 py-16 text-center">
      <div className="kpol-text-detail text-fg-dim">{label} 준비 중</div>
    </div>
  );
}
