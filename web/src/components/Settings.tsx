"use client";

import {
  CloseIcon,
  MinusIcon,
  MoonIcon,
  MoonIconFilled,
  PlusIcon,
  SunIcon,
  SunIconFilled,
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
      {/* 헤더 — 닫기 X만 */}
      <header className="shrink-0 flex items-center justify-end px-2 h-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="설정 닫기"
          className="w-10 h-10 flex items-center justify-center text-fg-muted hover:text-fg transition-colors cursor-pointer touch-manipulation"
        >
          <CloseIcon className="w-5 h-5 pointer-events-none" />
        </button>
      </header>

      {/* 본문 — 라벨 텍스트 없이 아이콘 컨트롤만. 항목 늘면 같은 패턴으로 추가. */}
      <main className="flex-1 overflow-y-auto px-5">
        {/* 화면 모드 행 — 선택은 채움 아이콘 + 밝은 fg, 비선택은 outline + dim */}
        <div className="flex items-center justify-end gap-1 py-5 border-b border-border/40">
          <ModeIcon
            active={theme === "day"}
            onClick={() => onChangeTheme("day")}
            ariaLabel="Day 모드"
          >
            {theme === "day" ? (
              <SunIconFilled className="w-[18px] h-[18px] pointer-events-none" />
            ) : (
              <SunIcon className="w-[18px] h-[18px] pointer-events-none" />
            )}
          </ModeIcon>
          <ModeIcon
            active={theme === "night"}
            onClick={() => onChangeTheme("night")}
            ariaLabel="Night 모드"
          >
            {theme === "night" ? (
              <MoonIconFilled className="w-[18px] h-[18px] pointer-events-none" />
            ) : (
              <MoonIcon className="w-[18px] h-[18px] pointer-events-none" />
            )}
          </ModeIcon>
        </div>

        {/* 글자 크기 행 — 가운데 단계 표시 제거, －／＋ 동그라미 버튼만 */}
        <div className="flex items-center justify-end gap-2 py-5 border-b border-border/40">
          <CircleBtn onClick={decScale} disabled={!canDec} ariaLabel="글자 크기 줄이기">
            <MinusIcon className="w-[14px] h-[14px] pointer-events-none" />
          </CircleBtn>
          <CircleBtn onClick={incScale} disabled={!canInc} ariaLabel="글자 크기 키우기">
            <PlusIcon className="w-[14px] h-[14px] pointer-events-none" />
          </CircleBtn>
        </div>
      </main>
    </div>
  );
}

/* 36×36 아이콘 토글 — 색 강조 없음. 선택은 밝은 fg + 은은한 elev 배경,
   비선택은 dim. 아이콘 채움/outline 차이로 선택 상태를 더 명확히 표현. */
function ModeIcon({
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
      onPointerUp={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer touch-manipulation transition-colors ${
        active ? "text-fg bg-elev/60" : "text-fg-dim hover:text-fg-muted"
      }`}
    >
      {children}
    </button>
  );
}

/* 36×36 원형 step 버튼 — 동일 폼팩터로 ModeIcon과 정렬 맞춤. */
function CircleBtn({
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
      className={`w-9 h-9 rounded-full flex items-center justify-center border border-border transition-colors touch-manipulation ${
        disabled
          ? "text-fg-dim/40 cursor-not-allowed"
          : "text-fg-muted hover:text-brand hover:border-brand active:bg-brand/10 cursor-pointer"
      }`}
    >
      {children}
    </button>
  );
}
