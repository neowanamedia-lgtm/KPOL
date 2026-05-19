/**
 * OrientationGuard — 가로 모드에서는 셸 대신 안내 화면을 보여준다.
 *
 * Web/PWA에서 기기 회전 강제 잠금은 OS 권한이라 완전 차단 불가 →
 * CSS 미디어쿼리로 portrait/landscape 분기. JS 불필요.
 *
 * [[kpol-portrait-only]]
 */
export function OrientationGuard({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* portrait 시 정상 표시. landscape 시 숨김. */}
      <div className="kpol-portrait-shell">{children}</div>

      {/* landscape 전용 안내. */}
      <div className="kpol-landscape-guard">
        <div className="max-w-xs text-center px-6">
          <p className="text-fg text-base leading-relaxed">
            KPOL은 세로 화면에 최적화되어 있습니다.
            <br />
            휴대폰을 세로로 돌려주세요.
          </p>
        </div>
      </div>
    </>
  );
}
