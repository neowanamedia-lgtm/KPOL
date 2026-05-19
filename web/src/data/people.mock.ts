/**
 * KPOL 인물 탭 데모 데이터 (가상 인물).
 *
 * [[kpol-data-foundation]]: 실명+임의수치 구조 금지 → 데모는 가상 이름 + DEMO 라벨.
 * 실제 데이터 연결은 다음 단계.
 *
 * rankHistory7d: 길이 7. 인덱스 0 = 6일 전, 마지막 = 오늘.
 * 값은 현재 순위(낮을수록 위). 차트는 Y축 반전해서 1위가 위에 보이도록 처리.
 */
export type RankChange = number;

export interface DemoPerson {
  id: string;
  rank: number;
  name: string;
  currentRole: string;
  rankChange24h: RankChange;
  rankHistory7d: number[];
  recentSignals?: string[];
}

export const DEMO_PEOPLE: DemoPerson[] = [
  { id: "p01", rank: 1,  name: "김도현", currentRole: "대통령",          rankChange24h:  0, rankHistory7d: [2, 2, 1, 1, 2, 1, 1], recentSignals: ["정상회담 일정 보도", "예산안 관련 입장 발표"] },
  { id: "p02", rank: 2,  name: "이서연", currentRole: "A당 당대표",      rankChange24h:  3, rankHistory7d: [6, 5, 4, 5, 4, 5, 2], recentSignals: ["전국 순회 일정 시작", "당 혁신안 관련 인터뷰"] },
  { id: "p03", rank: 3,  name: "박지훈", currentRole: "B당 당대표",      rankChange24h: -1, rankHistory7d: [1, 1, 2, 2, 3, 2, 3], recentSignals: ["원내대표 회동", "법안 관련 입장문"] },
  { id: "p04", rank: 4,  name: "최민준", currentRole: "국회의원",         rankChange24h:  5, rankHistory7d: [12, 11, 9, 10, 8, 9, 4], recentSignals: ["상임위 질의", "지역구 현안 관련 보도"] },
  { id: "p05", rank: 5,  name: "정유진", currentRole: "OO도지사 후보",   rankChange24h:  7, rankHistory7d: [18, 16, 14, 13, 11, 12, 5], recentSignals: ["공약 발표", "후보 등록"] },
  { id: "p06", rank: 6,  name: "강하늘", currentRole: "국회의원",         rankChange24h: -2, rankHistory7d: [3, 4, 3, 4, 5, 4, 6], recentSignals: ["발언 기사 다수"] },
  { id: "p07", rank: 7,  name: "윤서아", currentRole: "서울시장 후보",    rankChange24h: 12, rankHistory7d: [22, 20, 18, 19, 16, 19, 7], recentSignals: ["출마 선언", "주요 매체 인터뷰"] },
  { id: "p08", rank: 8,  name: "임지원", currentRole: "C당 정책위의장",  rankChange24h:  0, rankHistory7d: [9, 8, 8, 7, 9, 8, 8], recentSignals: [] },
  { id: "p09", rank: 9,  name: "한동수", currentRole: "국회의원",         rankChange24h: -4, rankHistory7d: [4, 5, 6, 6, 7, 5, 9], recentSignals: [] },
  { id: "p10", rank: 10, name: "송지원", currentRole: "부산시장 후보",    rankChange24h:  2, rankHistory7d: [14, 13, 12, 11, 13, 12, 10], recentSignals: ["후보 등록"] },
  { id: "p11", rank: 11, name: "노현우", currentRole: "국회의원",         rankChange24h:  1, rankHistory7d: [13, 14, 13, 12, 11, 12, 11], recentSignals: [] },
  { id: "p12", rank: 12, name: "백승호", currentRole: "경기도지사 후보",  rankChange24h: -1, rankHistory7d: [10, 10, 11, 11, 10, 11, 12], recentSignals: ["공약 발표"] },
  { id: "p13", rank: 13, name: "오은별", currentRole: "국회의원",         rankChange24h:  0, rankHistory7d: [13, 12, 13, 14, 13, 13, 13], recentSignals: [] },
  { id: "p14", rank: 14, name: "황민서", currentRole: "A당 대변인",      rankChange24h:  4, rankHistory7d: [22, 20, 19, 18, 17, 18, 14], recentSignals: ["브리핑 다수"] },
  { id: "p15", rank: 15, name: "신동훈", currentRole: "국회의원",         rankChange24h: -3, rankHistory7d: [8, 9, 10, 11, 12, 12, 15], recentSignals: [] },
  { id: "p16", rank: 16, name: "장서윤", currentRole: "교육감 후보",      rankChange24h:  6, rankHistory7d: [25, 23, 21, 20, 19, 22, 16], recentSignals: ["출마 선언"] },
  { id: "p17", rank: 17, name: "고은우", currentRole: "국회의원",         rankChange24h:  0, rankHistory7d: [16, 17, 17, 16, 18, 17, 17], recentSignals: [] },
  { id: "p18", rank: 18, name: "권하진", currentRole: "B당 사무총장",    rankChange24h: -2, rankHistory7d: [12, 13, 14, 15, 14, 16, 18], recentSignals: [] },
  { id: "p19", rank: 19, name: "조태경", currentRole: "광역시장 후보",    rankChange24h:  3, rankHistory7d: [26, 25, 24, 23, 21, 22, 19], recentSignals: [] },
  { id: "p20", rank: 20, name: "민지호", currentRole: "국회의원",         rankChange24h:  0, rankHistory7d: [19, 20, 21, 20, 19, 20, 20], recentSignals: [] },
];
