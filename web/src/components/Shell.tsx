"use client";

import { useEffect, useRef, useState } from "react";
import { PersonRow } from "@/components/PersonRow";
import { Settings, type Scale, type Theme } from "@/components/Settings";
import {
  ArrowUpIcon,
  SearchIcon,
  SettingsIcon,
} from "@/components/icons";
import { DEMO_PEOPLE } from "@/data/people.mock";

type TabKey = "people" | "media" | "by-election" | "local-election";

const TABS: { key: TabKey; label: string }[] = [
  { key: "people", label: "인물" },
  { key: "media", label: "미디어" },
  { key: "by-election", label: "보궐선거" },
  { key: "local-election", label: "지방선거" },
];

const BASIS_BY_TAB: Record<TabKey, string> = {
  people: "산정 기준: 순위 변동 · 24시 · 14:00 자동집계",
  media: "산정 기준: 언급·인용·연결 횟수 · 24시 · 14:00 자동집계",
  "by-election": "산정 기준: 후보 단위 신호 · 24시 · 14:00 자동집계",
  "local-election": "산정 기준: 후보 단위 신호 · 24시 · 14:00 자동집계",
};

const SCALE_KEY = "kpol-scale";
const THEME_KEY = "kpol-theme";

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

export function Shell() {
  const [activeTab, setActiveTab] = useState<TabKey>("people");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scale, setScale] = useState<Scale>(0);
  const [theme, setTheme] = useState<Theme>("night");
  const scrollRef = useRef<HTMLDivElement>(null);

  // hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    setScale(loadInitialScale());
    setTheme(loadInitialTheme());
  }, []);

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

  const toggleExpand = (id: string) => {
    setExpandedId((curr) => (curr === id ? null : id));
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="fixed inset-0 flex flex-col bg-bg">
        {/* ── 상단 고정: 3줄 — 내부 가로줄 일체 없음, 한 덩어리 배경 ── */}
        <header className="shrink-0 bg-bg">
          {/* 1줄: 로고 단독 — 자동집계 텍스트는 3줄로 이동 */}
          <div className="flex items-center px-4 pt-2 pb-1">
            <h1 className="kpol-text-brand text-brand font-normal leading-none">
              KPOL&nbsp;TOP100
            </h1>
          </div>

          {/* 2줄: 가로 스크롤 4탭 — border 없음, 같은 배경 */}
          <nav>
            <ul className="flex overflow-x-auto no-scrollbar">
              {TABS.map((t) => {
                const active = t.key === activeTab;
                return (
                  <li key={t.key} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab(t.key);
                        setExpandedId(null);
                      }}
                      className={`kpol-text-tab relative px-4 h-9 pt-2 flex items-end justify-center leading-none transition-colors ${
                        active
                          ? "text-fg font-medium"
                          : "text-fg-dim hover:text-fg-muted"
                      }`}
                    >
                      {active ? `[${t.label}]` : t.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* 3줄: 산정 기준 띄 — border·배경 mismatch 없음 */}
          <button
            type="button"
            aria-label="산정 기준 상세 보기"
            className="w-full flex items-center px-4 h-8 text-left active:bg-elev/60"
          >
            <span className="kpol-text-basis tracking-wide">
              <span className="text-accent-green font-medium underline decoration-accent-green/40 underline-offset-2">
                산정 기준
              </span>
              <span className="text-fg-dim">
                {BASIS_BY_TAB[activeTab].replace("산정 기준", "")}
              </span>
            </span>
          </button>
        </header>

        {/* ── 중앙 독립 스크롤 ── */}
        <main
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          {activeTab === "people" ? (
            <ul className="pb-8">
              {DEMO_PEOPLE.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  expanded={expandedId === p.id}
                  onToggle={toggleExpand}
                />
              ))}
              <li className="px-4 py-3 text-fg-dim kpol-text-label-xs tracking-wide border-t border-border/40">
                DEMO DATA · 가상 인물 표시 (다음 단계에서 실 데이터 연결)
              </li>
            </ul>
          ) : (
            <PlaceholderPane label={TABS.find((t) => t.key === activeTab)!.label} />
          )}
        </main>

        {/* ── 하단 고정: 3항목 — bg/border 모두 제거, 한 덩어리 배경 ── */}
        <nav className="shrink-0 bg-bg">
          <ul className="grid grid-cols-3 h-14">
            <li>
              <button
                type="button"
                onClick={scrollToTop}
                aria-label="맨 위로"
                className="w-full h-full flex items-center justify-center text-fg hover:text-brand active:text-brand transition-colors"
              >
                <ArrowUpIcon className="w-[18px] h-[18px]" />
              </button>
            </li>
            <li>
              <button
                type="button"
                aria-label="검색"
                className="w-full h-full flex items-center justify-center text-fg hover:text-brand transition-colors"
              >
                <SearchIcon className="w-[18px] h-[18px]" />
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="설정"
                className={`w-full h-full flex items-center justify-center transition-colors ${
                  settingsOpen ? "text-brand" : "text-fg hover:text-brand"
                }`}
              >
                <SettingsIcon className="w-[18px] h-[18px]" />
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {settingsOpen ? (
        <Settings
          scale={scale}
          theme={theme}
          onChangeScale={setScale}
          onChangeTheme={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
}

function PlaceholderPane({ label }: { label: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="kpol-text-name text-fg font-medium mb-2">{label} 탭</div>
      <div className="kpol-text-detail text-fg-dim leading-relaxed">
        디자인·UX 확인 단계입니다.
        <br />이 탭의 데이터 모델·표시는 다음 단계에서 합의됩니다.
      </div>
    </div>
  );
}
