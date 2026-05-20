"use client";

import { CloseIcon } from "@/components/icons";

interface Props {
  onClose: () => void;
  /** 탭별 산정 기준 본문 — 'media'면 미디어 본문, 그 외는 인물 본문(기본) */
  tab?: "people" | "media" | "by-election" | "local-election";
}

interface BasisContent {
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
}

const PEOPLE_BASIS: BasisContent = {
  title: "KPOL 인물 TOP100 산정 기준",
  intro:
    "KPOL은 단순 인기 순위를 만들지 않습니다. 하루 동안의 노출량, 언급량, 반응, 상승 속도, 지속성, 이슈 영향력을 함께 고려하여 순위를 산정합니다.",
  sections: [
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
  ],
};

const MEDIA_BASIS: BasisContent = {
  title: "KPOL 미디어 TOP100 선정 기준",
  intro:
    "KPOL 미디어 TOP100은 단순 구독자 수나 조회수만으로 순위를 결정하지 않습니다. 실시간 사회 반응과 정치·언론 영향력, 플랫폼 확산력, 대중 파급력을 종합적으로 반영하여 순위를 산정합니다.",
  sections: [
    {
      title: "1. 뉴스 및 방송 노출 영향력",
      body: "언론 기사, 방송 프로그램, 시사 콘텐츠, 정치 관련 보도 등에서 얼마나 자주 언급되고 노출되는지를 반영합니다. 단순 노출 횟수뿐 아니라 주요 이슈 중심에서 얼마나 지속적으로 등장하는지도 함께 분석합니다.",
    },
    {
      title: "2. 정치·사회 이슈 파급력",
      body: "정치·사회 현안이 발생했을 때 해당 미디어가 여론 흐름과 담론 형성에 어느 정도 영향을 미치는지를 반영합니다. 특정 이슈를 단순 전달하는 수준인지, 실제 여론 흐름에 영향을 주는 수준인지까지 함께 분석합니다.",
    },
    {
      title: "3. 플랫폼별 반응 분석",
      body: "유튜브, SNS, 커뮤니티, 포털 등 각 플랫폼에서 나타나는 반응 차이를 종합 분석합니다. 한 플랫폼에서만 일시적으로 높은 반응을 얻는 경우보다 여러 플랫폼에서 지속적으로 영향력을 유지하는 경우를 높게 반영합니다.",
    },
    {
      title: "4. 실시간 화제성 및 검색 흐름",
      body: "실시간 검색량 변화와 언급 증가 속도, 특정 시간대 집중 반응 등을 반영합니다. 단기간 급등 반응뿐 아니라 일정 기간 이상 관심이 유지되는 흐름도 함께 분석합니다.",
    },
    {
      title: "5. 커뮤니티 및 온라인 언급량",
      body: "온라인 커뮤니티, 댓글, 게시글, 공유 흐름 등에서 얼마나 자주 언급되는지를 반영합니다. 단순 언급량뿐 아니라 실제 토론과 재확산으로 이어지는 비율도 함께 고려합니다.",
    },
    {
      title: "6. 콘텐츠 확산력",
      body: "영상, 기사, 클립, 발언 등이 얼마나 빠르게 확산되고 재생산되는지를 분석합니다. 짧은 시간 안에 다양한 플랫폼으로 퍼지는 콘텐츠일수록 높은 반영을 받을 수 있습니다.",
    },
    {
      title: "7. 대중 반응 지속성",
      body: "일회성 화제보다 일정 기간 이상 꾸준히 반응이 이어지는 미디어를 더 높게 평가합니다. 지속적인 관심 유지 여부와 반복 언급 흐름 역시 주요 기준에 포함됩니다.",
    },
    {
      title: "8. 정치 담론 형성 영향력",
      body: "정치·사회 분야에서 특정 의제나 논쟁 흐름을 형성하거나 방향을 바꾸는 수준의 영향력을 반영합니다. 실제 여론 흐름 안에서 중심 역할을 하는 미디어일수록 높은 평가를 받을 수 있습니다.",
    },
    {
      title: "9. 공유 및 반응 활성도",
      body: "콘텐츠 공유 빈도, 댓글 활성도, 반응 참여율 등을 함께 분석합니다. 단순 조회수보다 실제 사용자 참여와 반응 흐름을 중요하게 반영합니다.",
    },
    {
      title: "10. 종합 영향력 분석",
      body: "KPOL 미디어 TOP100은 개별 수치 하나만으로 순위를 결정하지 않습니다. 플랫폼 확산력, 정치·사회 영향력, 실시간 화제성, 온라인 반응, 검색 흐름 등을 종합적으로 분석하여 최종 순위를 산정합니다.",
    },
  ],
};

function pickContent(tab?: Props["tab"]): BasisContent {
  if (tab === "media") return MEDIA_BASIS;
  return PEOPLE_BASIS;
}

export function BasisExplainer({ onClose, tab }: Props) {
  const content = pickContent(tab);

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* 헤더 — 닫기 X만 */}
      <header className="shrink-0 flex items-center justify-end px-2 h-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="산정 기준 닫기"
          className="w-10 h-10 flex items-center justify-center text-fg-muted hover:text-fg transition-colors cursor-pointer touch-manipulation"
        >
          <CloseIcon className="w-5 h-5 pointer-events-none" />
        </button>
      </header>

      {/* 본문 — 카드 ✗, 단순 문단 흐름, 충분한 간격 */}
      <main className="flex-1 overflow-y-auto px-5 pb-12">
        <h1 className="text-accent-green text-[18px] font-medium leading-snug mb-4">
          {content.title}
        </h1>

        <p className="text-fg-muted text-[14px] leading-relaxed mb-8">
          {content.intro}
        </p>

        <div className="space-y-7">
          {content.sections.map((s) => (
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
