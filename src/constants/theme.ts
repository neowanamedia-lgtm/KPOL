/**
 * KPOL theme — Bloomberg Terminal / TradingView 감성.
 * 정치적 색상(빨강/파랑)을 정당과 연결 짓지 않는다.
 * 변화량 표시에 한해서만 미세한 포인트 컬러를 허용한다.
 */

export const colors = {
  // 배경 계층
  bgBase: '#0A0A0A',
  bgSurface: '#111111',
  bgElevated: '#161616',
  bgCard: '#141414',
  bgInput: '#1A1A1A',

  // 라인 / 디바이더
  border: '#1F1F1F',
  borderStrong: '#2A2A2A',

  // 텍스트
  textPrimary: '#F2F2F2',
  textSecondary: '#9A9A9A',
  textTertiary: '#5C5C5C',
  textInverse: '#0A0A0A',

  // 변화량 (감정 X — 데이터 변화만 표시)
  up: '#E0B341',      // 차분한 amber
  down: '#6B7280',    // 무채 gray (하락 강조 약화)
  neutral: '#5C5C5C',

  // 포인트
  accent: '#E0B341',  // 단 하나의 포인트 컬러
  divider: '#1F1F1F',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
} as const;

export const typography = {
  // 숫자/지표용 — 동일 너비 폰트가 이상적이지만 OS 기본 mono로 유지
  mono: 'Menlo',
  // 기본 텍스트는 시스템 폰트
  sans: undefined as string | undefined,

  size: {
    xs: 10,
    sm: 12,
    md: 13,
    base: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 28,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  letterSpacing: {
    tight: -0.2,
    normal: 0,
    wide: 0.4,
    wider: 0.8,
  },
} as const;

export const layout = {
  cardPadding: spacing.lg,
  screenPadding: spacing.lg,
  sectionGap: spacing.xxl,
} as const;

export type ThemeColors = typeof colors;
