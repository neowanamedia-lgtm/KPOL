"use client";

import { CloseIcon } from "@/components/icons";

interface Props {
  onClose: () => void;
}

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. 언급량",
    body: "뉴스, 영상, 커뮤니티, SNS, 검색 흐름 등에서 해당 인물이 얼마나 자주 언급되는지를 반영합니다. 단순히 한 번 화제가 된 경우보다 여러 공간에서 반복적으로 등장하는 흐름을 더 중요하게 봅니다.",
  },
  {
    title: "2. 반응 강도",
    body: "해당 인물에 대한 댓글, 공유, 토론, 재언급, 2차 확산 정도를 반영합니다. 단순 노출보다 사람들이 실제로 반응하고 움직인 정도를 더 중요하게 봅니다.",
  },
  {
    title: "3. 상승 속도",
    body: "전날 또는 최근 며칠과 비교해 얼마나 빠르게 관심이 증가했는지를 반영합니다. 갑작스러운 이슈, 발언, 논란, 발표, 출마 가능성, 방송 출연 등이 순위 변동에 영향을 줄 수 있습니다.",
  },
  {
    title: "4. 지속성",
    body: "일시적인 화제보다 일정 기간 계속 언급되는 인물을 더 안정적으로 평가합니다. 하루짜리 급등 이슈는 반영하되, 지속성이 낮으면 다음 순위에서 빠르게 하락할 수 있습니다.",
  },
  {
    title: "5. 이슈 영향력",
    body: "해당 인물이 만든 발언, 행동, 사건, 정책, 논쟁이 정치권이나 여론 흐름에 실제 영향을 주었는지를 반영합니다. 단순 조회수보다 정치적 파급력이 큰 이슈를 더 높게 평가합니다.",
  },
  {
    title: "6. 미디어 확산력",
    body: "방송, 기사, 유튜브, 숏폼, 커뮤니티 등 여러 매체로 확산되는 정도를 반영합니다. 특정 플랫폼 안에서만 강한 인물보다 여러 경로에서 동시에 언급되는 인물이 더 높은 평가를 받을 수 있습니다.",
  },
  {
    title: "7. 변동성",
    body: "KPOL TOP100은 고정 명단이 아니라 매일 바뀌는 흐름형 랭킹입니다. 오늘의 순위는 현재 시점의 관심과 영향력을 보여주는 것이며, 절대적인 인물 평가나 지지율을 의미하지 않습니다.",
  },
  {
    title: "8. 제외 및 보정 원칙",
    body: "명백한 조작성 반복 언급, 의미 없는 도배성 데이터, 비정상적인 트래픽, 단기적 노이즈는 순위 반영에서 낮게 처리합니다. 또한 특정 진영이나 정당에 유리하도록 수동 편집하지 않는 것을 원칙으로 합니다.",
  },
];

const INTRO =
  "KPOL은 단순 인기 순위를 만들지 않습니다. 하루 동안의 노출량, 언급량, 반응, 상승 속도, 지속성, 이슈 영향력을 함께 고려하여 순위를 산정합니다.";

export function BasisExplainer({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* 헤더 — 닫기 X만 */}
      <header className="shrink-0 flex items-center justify-end px-2 h-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="산정 기준 닫기"
          className="w-10 h-10 flex items-center justify-center text-fg-muted hover:text-fg transition-colors"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </header>

      {/* 본문 — 카드 ✗, 단순 문단 흐름, 충분한 간격 */}
      <main className="flex-1 overflow-y-auto px-5 pb-12">
        <h1 className="text-accent-green text-[18px] font-medium leading-snug mb-4">
          KPOL 인물 TOP100 산정 기준
        </h1>

        <p className="text-fg-muted text-[14px] leading-relaxed mb-8">
          {INTRO}
        </p>

        <div className="space-y-7">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-fg text-[14px] font-medium mb-2">
                {s.title}
              </h2>
              <p className="text-fg-muted text-[13px] leading-relaxed">
                {s.body}
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
