/**
 * RankSparkline — 인물 순위 변화 라인 차트 (SVG, 외부 라이브러리 ✗).
 *
 * - 점-선 형태 (막대 ✗)
 * - Y축 반전: 1위(낮은 숫자)가 위쪽
 * - viewBox 기반 + non-scaling-stroke → 컨테이너 폭 변해도 선 굵기 유지
 * - 색은 currentColor (text-brand 등 상위 클래스 따라감)
 */
interface Props {
  history: number[];
  /** px height — 컨테이너 폭은 100%로 채움 */
  height?: number;
}

export function RankSparkline({ history, height = 80 }: Props) {
  if (history.length < 2) {
    return (
      <div
        className="w-full rounded border border-border/60 bg-sticky/60 flex items-center justify-center text-fg-dim kpol-text-list-xs"
        style={{ height }}
      >
        데이터 부족
      </div>
    );
  }

  const W = 100; // viewBox width 기준 (실제 폭은 부모 100%)
  const H = height;
  const padY = 10;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const step = W / (history.length - 1);

  // 낮은 순위(min) → 위 (y = padY). 높은 순위(max) → 아래 (y = H - padY).
  const points = history.map((rank, i) => {
    const x = i * step;
    const y = ((rank - min) / range) * (H - padY * 2) + padY;
    return { x, y, rank };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  return (
    <div className="w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full text-brand"
        role="img"
        aria-label={`최근 ${history.length}일 순위 변화`}
      >
        {/* Subtle baseline at top (1위 영역) and bottom — 가독성용 */}
        <line x1="0" y1={padY} x2={W} y2={padY} stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={H - padY} x2={W} y2={H - padY} stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2"
            fill="currentColor"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}
