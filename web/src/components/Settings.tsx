"use client";

import {
  CloseIcon,
  MinusIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
} from "@/components/icons";

export type Scale = 0 | 1 | 2 | 3;
export type Theme = "day" | "night";

interface Props {
  scale: Scale;
  theme: Theme;
  onChangeScale: (s: Scale) => void;
  onChangeTheme: (t: Theme) => void;
  onClose: () => void;
}

const SCALE_LABEL: Record<Scale, string> = {
  0: "기본",
  1: "+1",
  2: "+2",
  3: "+3",
};

function clampScale(n: number): Scale {
  if (n <= 0) return 0;
  if (n >= 3) return 3;
  return n as Scale;
}

export function Settings({
  scale,
  theme,
  onChangeScale,
  onChangeTheme,
  onClose,
}: Props) {
  const decScale = () => onChangeScale(clampScale(scale - 1));
  const incScale = () => onChangeScale(clampScale(scale + 1));
  const canDec = scale > 0;
  const canInc = scale < 3;

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* 헤더 — 닫기 X만, 텍스트 최소 */}
      <header className="shrink-0 flex items-center justify-end px-2 h-12 border-b border-border bg-sticky">
        <button
          type="button"
          onClick={onClose}
          aria-label="설정 닫기"
          className="w-10 h-10 flex items-center justify-center text-fg-muted hover:text-fg transition-colors"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 space-y-10">
        {/* A. Day / Night — 해/달 아이콘 토글 */}
        <section>
          <p className="kpol-text-label-xs text-fg-dim mb-3 tracking-wider uppercase text-center">
            화면 모드
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
            <ModeButton
              active={theme === "day"}
              onClick={() => onChangeTheme("day")}
              ariaLabel="Day 모드"
            >
              <SunIcon className="w-8 h-8" />
            </ModeButton>
            <ModeButton
              active={theme === "night"}
              onClick={() => onChangeTheme("night")}
              ariaLabel="Night 모드"
            >
              <MoonIcon className="w-8 h-8" />
            </ModeButton>
          </div>
        </section>

        {/* B. 글자 크기 — － 기본 ＋ */}
        <section>
          <p className="kpol-text-label-xs text-fg-dim mb-3 tracking-wider uppercase text-center">
            글자 크기
          </p>
          <div className="grid grid-cols-[64px_1fr_64px] gap-3 max-w-xs mx-auto">
            <StepButton
              onClick={decScale}
              disabled={!canDec}
              ariaLabel="글자 크기 줄이기"
            >
              <MinusIcon className="w-6 h-6" />
            </StepButton>
            <div className="h-16 flex flex-col items-center justify-center rounded border border-border-strong bg-elev">
              <span className="kpol-text-name text-fg font-medium tabular-nums">
                {SCALE_LABEL[scale]}
              </span>
              <span className="kpol-text-label-xs text-fg-dim mt-0.5">
                {scale + 1} / 4
              </span>
            </div>
            <StepButton
              onClick={incScale}
              disabled={!canInc}
              ariaLabel="글자 크기 키우기"
            >
              <PlusIcon className="w-6 h-6" />
            </StepButton>
          </div>
        </section>
      </main>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`h-16 rounded border flex items-center justify-center transition-colors ${
        active
          ? "border-brand text-brand bg-brand/10"
          : "border-border text-fg-muted hover:text-fg hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}

function StepButton({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`h-16 rounded border flex items-center justify-center transition-colors ${
        disabled
          ? "border-border text-fg-dim/40 cursor-not-allowed"
          : "border-border text-fg-muted hover:text-brand hover:border-brand active:bg-brand/10"
      }`}
    >
      {children}
    </button>
  );
}
