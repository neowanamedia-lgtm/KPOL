import type { DailyFlowSummary, FlowPoint } from '../types';

export const todayFlowSummary: DailyFlowSummary = {
  date: '2026-05-19',
  totalArticles: 1342,
  totalChange: 11.6,
  activeThemes: 6,
  // 사실 기반, 의견 없음.
  headline: '오늘 정치 기사량은 어제 대비 증가했습니다. 부동산·AI/기술 테마의 언급량이 상위에 위치합니다.',
};

/** 정치인 ID → 최근 14일 일별 언급량 (Fake) */
export const fakePoliticianFlow: Record<string, FlowPoint[]> = {
  // 선출직 / 지역 정치
  p_001: buildSeries('2026-05-19', 14, [40, 38, 44, 52, 60, 55, 68, 72, 80, 91, 99, 104, 118, 142]),
  p_002: buildSeries('2026-05-19', 14, [60, 58, 55, 62, 70, 68, 74, 80, 88, 92, 96, 104, 110, 118]),
  p_003: buildSeries('2026-05-19', 14, [50, 55, 58, 60, 62, 64, 66, 70, 72, 78, 82, 88, 92, 96]),
  p_004: buildSeries('2026-05-19', 14, [90, 92, 88, 85, 84, 82, 80, 79, 86, 85, 84, 83, 86, 81]),
  p_005: buildSeries('2026-05-19', 14, [55, 56, 58, 60, 62, 65, 64, 66, 68, 67, 69, 70, 72, 73]),
  p_006: buildSeries('2026-05-19', 14, [22, 25, 28, 26, 30, 33, 36, 38, 42, 46, 50, 54, 58, 64]),
  p_007: buildSeries('2026-05-19', 14, [62, 60, 61, 60, 58, 59, 60, 58, 57, 58, 58, 57, 58, 58]),
  p_008: buildSeries('2026-05-19', 14, [48, 50, 49, 51, 50, 52, 51, 53, 52, 50, 51, 52, 51, 52]),
  // 정당 지도부
  p_009: buildSeries('2026-05-19', 14, [88, 90, 92, 95, 98, 102, 106, 108, 112, 118, 122, 128, 130, 134]),
  // 영향력 인물
  p_010: buildSeries('2026-05-19', 14, [40, 42, 44, 46, 48, 50, 54, 58, 62, 64, 68, 70, 74, 78]),
  p_011: buildSeries('2026-05-19', 14, [44, 46, 48, 50, 51, 52, 54, 55, 56, 58, 60, 61, 62, 64]),
  p_012: buildSeries('2026-05-19', 14, [38, 40, 42, 42, 44, 45, 46, 47, 48, 49, 50, 51, 51, 52]),
  p_013: buildSeries('2026-05-19', 14, [18, 20, 22, 24, 26, 28, 30, 33, 36, 38, 40, 42, 44, 46]),
};

function buildSeries(endDateIso: string, days: number, values: number[]): FlowPoint[] {
  const end = new Date(endDateIso + 'T00:00:00+09:00');
  const out: FlowPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - (days - 1 - i));
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, value: values[i] ?? 0 });
  }
  return out;
}
