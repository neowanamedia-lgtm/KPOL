/**
 * RankSparkline — 인물 순위 변화 라인 차트.
 *
 * - 라인은 SVG (preserveAspectRatio="none"으로 컨테이너 폭 stretch).
 * - 점은 HTML div absolute로 그려 stretch 영향 ✗ → 항상 완전 원형.
 * - Y축 반전: 1위(낮은 숫자)가 위쪽.
 */
interface Props {
  history: number[];
  /** px height — 컨테이너 폭은 100%로 채움 */
  height?: number;
  /** 'brand' = 코랄/와인 (기본), 'fg' = 흰색 (상세 화면) */
  tone?: "brand" | "fg";
}

export function RankSparkline({ history, height = 80, tone = "brand" }: Props) {
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

  const W = 100;
  const H = height;
  const padY = 10;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const step = W / (history.length - 1);

  const points = history.map((rank, i) => {
    const x = i * step;
    const y = ((rank - min) / range) * (H - padY * 2) + padY;
    return { x, y, rank };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const toneClass = tone === "fg" ? "text-fg" : "text-brand";

  return (
    <div className={`relative w-full ${toneClass}`} style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-label={`최근 ${history.length}일 순위 변화`}
        role="img"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* 점은 HTML div로 — SVG stretch 영향 받지 않아 완전 원형 유지.
          8px + 배경색 ring으로 선과 분리, 항상 명확히 보임. */}
      {points.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute w-2 h-2 rounded-full bg-current ring-[3px] ring-bg -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${(p.x / W) * 100}%`,
            top: `${(p.y / H) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
