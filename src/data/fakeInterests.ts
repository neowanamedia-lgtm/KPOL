/**
 * Fake Interest Targets — UI 검증용 시드.
 * 실 데이터 도입 시 interest_targets 테이블이 이 역할을 대체.
 *
 * 관심 대상 시뮬레이션:
 *  - "내 관심" 7개 (manager_pick / pinned 위주)
 *  - "추천" 6개 (auto_generated, 다양한 generated_reason)
 *
 * fakeInterests는 fakePoliticians와 느슨하게 연결된다.
 * target_ref가 fake politician id일 때는 InterestDetail에서
 * getPoliticianDetail로 매핑 가능.
 */

import { fakePoliticianFlow } from './fakeFlow';
import { fakePoliticians } from './fakePoliticians';
import type { AvailableTarget } from '../services/dataProvider/types';
import type { InterestTarget, RecommendedTarget } from '../types/widget';

const FAKE_NOW = '2026-05-19T03:20:00+09:00';

/** 7일 미리보기 흐름 추출 (last 7 points) */
const flow7 = (politicianId: string) =>
  (fakePoliticianFlow[politicianId] ?? []).slice(-7).map((p) => ({
    date: p.date,
    value: p.value,
  }));

// ─────────────────────────────────────────────────────────────
// 내 관심 — 7개 (관리자 핀 시드)
// ─────────────────────────────────────────────────────────────
export const fakeMyInterests: InterestTarget[] = [
  {
    id: 'it_001',
    type: 'issue_cluster',
    target_ref: 'by_election_14',
    title: '재보궐 14곳',
    subtitle: '14개 선거구 · 6·3 동시',
    auto_generated: false,
    pinned: true,
    priority: 'pinned',
    priority_score: 100,
    active: true,
    generated_reason: 'manager_pick',
    panels: [],
    updated_at: FAKE_NOW,
    preview: {
      member_count: 14,
      mention_count: 384,
      mention_change: 14.2,
      context_meta: '24h',
    },
  },
  {
    id: 'it_002',
    type: 'regional_office',
    target_ref: 'd_seoul_mayor',
    title: '서울시장',
    subtitle: '9회 지방선거 · 후보 4',
    auto_generated: false,
    pinned: true,
    priority: 'pinned',
    priority_score: 99,
    active: true,
    generated_reason: 'manager_pick',
    panels: [],
    updated_at: FAKE_NOW,
    preview: {
      member_count: 4,
      mention_count: 184,
      mention_change: 18.0,
      flow_7d: flow7('p_002'),
    },
  },
  {
    id: 'it_003',
    type: 'regional_office',
    target_ref: 'd_gyeonggi_governor',
    title: '경기지사',
    subtitle: '9회 지방선거 · 후보 3',
    auto_generated: false,
    pinned: true,
    priority: 'pinned',
    priority_score: 98,
    active: true,
    generated_reason: 'manager_pick',
    panels: [],
    updated_at: FAKE_NOW,
    preview: {
      member_count: 3,
      mention_count: 138,
      mention_change: 9.0,
      flow_7d: flow7('p_005'),
    },
  },
  {
    id: 'it_004',
    type: 'politician',
    target_ref: 'p_009',
    title: '조은하',
    subtitle: '제1정당·당대표',
    auto_generated: false,
    pinned: true,
    priority: 'pinned',
    priority_score: 95,
    active: true,
    generated_reason: 'manager_pick',
    panels: [],
    updated_at: FAKE_NOW,
    preview: {
      mention_count: 134,
      mention_change: 18.4,
      flow_7d: flow7('p_009'),
    },
  },
  {
    id: 'it_005',
    type: 'regional_office',
    target_ref: 'd_busan_mayor',
    title: '부산시장',
    subtitle: '9회 지방선거 · 후보 3',
    auto_generated: false,
    pinned: false,
    priority: 'high',
    priority_score: 88,
    active: true,
    generated_reason: 'manager_pick',
    panels: [],
    updated_at: FAKE_NOW,
    preview: {
      member_count: 3,
      mention_count: 102,
      mention_change: -3.4,
      flow_7d: flow7('p_004'),
    },
  },
  {
    id: 'it_006',
    type: 'issue_cluster',
    target_ref: 'today_surge_politicians',
    title: '오늘 많이 움직이는 사람',
    subtitle: '10인 · 자동 집계',
    auto_generated: true,
    pinned: false,
    priority: 'high',
    priority_score: 82,
    active: true,
    generated_reason: 'mention_surge',
    panels: [],
    updated_at: FAKE_NOW,
    preview: {
      member_count: 10,
      mention_count: 612,
      mention_change: 24.6,
      context_meta: '24h',
    },
  },
  {
    id: 'it_007',
    type: 'election',
    target_ref: 'e_9th_local_election',
    title: '9회 지방선거',
    subtitle: '2026-06-03 · D-15',
    auto_generated: false,
    pinned: false,
    priority: 'normal',
    priority_score: 70,
    active: true,
    generated_reason: 'manager_pick',
    panels: [],
    updated_at: FAKE_NOW,
    preview: {
      member_count: 348,
      mention_count: 2318,
      mention_change: 14.6,
      context_meta: 'D-15',
    },
  },
];

// ─────────────────────────────────────────────────────────────
// 추천 관심 대상 — 6개 (자동 생성)
// ─────────────────────────────────────────────────────────────
export const fakeRecommendedInterests: RecommendedTarget[] = [
  {
    id: 'rec_001',
    type: 'politician',
    target_ref: 'p_001',
    title: '김민수',
    subtitle: '제1정당·국회의원 3선',
    generated_reason: 'mention_surge',
    reason_metadata: { day_change_pct: 38.2 },
    priority_score: 88,
    preview: {
      mention_count: 142,
      mention_change: 38.2,
      flow_7d: flow7('p_001'),
    },
  },
  {
    id: 'rec_002',
    type: 'politician',
    target_ref: 'p_006',
    title: '윤하늘',
    subtitle: '제1정당·국회의원 초선',
    generated_reason: 'mention_surge',
    reason_metadata: { day_change_pct: 41.0 },
    priority_score: 86,
    preview: {
      mention_count: 64,
      mention_change: 41.0,
      flow_7d: flow7('p_006'),
    },
  },
  {
    id: 'rec_003',
    type: 'regional_office',
    target_ref: 'd_daegu_mayor',
    title: '대구시장',
    subtitle: '9회 지방선거 · 후보 3',
    generated_reason: 'election_cycle',
    reason_metadata: { days_to_election: 15 },
    priority_score: 80,
    preview: {
      member_count: 3,
      mention_count: 84,
      mention_change: 8.2,
    },
  },
  {
    id: 'rec_004',
    type: 'politician',
    target_ref: 'p_010',
    title: '한지호',
    subtitle: '정치노트·유튜브 채널',
    generated_reason: 'editorial_focus',
    reason_metadata: { editorial_count_7d: 5 },
    priority_score: 76,
    preview: {
      mention_count: 78,
      mention_change: 24.3,
      flow_7d: flow7('p_010'),
    },
  },
  {
    id: 'rec_005',
    type: 'issue_cluster',
    target_ref: 'kw_ai_tech',
    title: 'AI/기술',
    subtitle: '키워드 급등',
    generated_reason: 'keyword_surge',
    reason_metadata: { keyword_change_pct: 35.0 },
    priority_score: 72,
    preview: {
      mention_count: 318,
      mention_change: 35.0,
      context_meta: '30d',
    },
  },
  {
    id: 'rec_006',
    type: 'district',
    target_ref: 'd_seoul_jongno',
    title: '종로',
    subtitle: '국회의원 재·보궐 · 후보 3',
    generated_reason: 'regional_focus',
    reason_metadata: { regional_share: 0.62 },
    priority_score: 70,
    preview: {
      member_count: 3,
      mention_count: 72,
      mention_change: 24.3,
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Add Interest 화면 카탈로그 — 7개 카테고리
// 사용자가 홈에 "설치" 가능한 모든 대상.
// ─────────────────────────────────────────────────────────────
export const fakeAvailableTargets: AvailableTarget[] = [
  // 인물 — fake politicians 전체
  ...fakePoliticians.map<AvailableTarget>((p) => ({
    type: 'politician',
    target_ref: p.id,
    title: p.name,
    subtitle: [p.party ?? p.affiliation, p.position].filter(Boolean).join(' · '),
    category: '인물',
    preview: {
      mention_count: p.mentionCount,
      mention_change: p.mentionChange,
      flow_7d: flow7(p.id),
    },
  })),

  // 선거구
  { type: 'district', target_ref: 'd_seoul_jongno', title: '종로', subtitle: '국회의원 재·보궐 · 후보 3', category: '선거구', preview: { member_count: 3, mention_count: 72, mention_change: 24.3 } },
  { type: 'district', target_ref: 'd_seongnam_bundang_a', title: '분당갑', subtitle: '국회의원 재·보궐 · 후보 3', category: '선거구', preview: { member_count: 3, mention_count: 58, mention_change: 12.0 } },
  { type: 'district', target_ref: 'd_busan_jin_a', title: '부산진갑', subtitle: '국회의원 재·보궐 · 후보 2', category: '선거구', preview: { member_count: 2, mention_count: 44, mention_change: 6.4 } },
  { type: 'district', target_ref: 'd_suwon_jeong', title: '수원정', subtitle: '국회의원 재·보궐 · 후보 3', category: '선거구', preview: { member_count: 3, mention_count: 38, mention_change: 8.0 } },

  // 지방선거 (광역단체장)
  { type: 'regional_office', target_ref: 'd_seoul_mayor', title: '서울시장', subtitle: '9회 지방선거 · 후보 4', category: '지방선거', preview: { member_count: 4, mention_count: 184, mention_change: 18.0 } },
  { type: 'regional_office', target_ref: 'd_gyeonggi_governor', title: '경기지사', subtitle: '9회 지방선거 · 후보 3', category: '지방선거', preview: { member_count: 3, mention_count: 138, mention_change: 9.0 } },
  { type: 'regional_office', target_ref: 'd_busan_mayor', title: '부산시장', subtitle: '9회 지방선거 · 후보 3', category: '지방선거', preview: { member_count: 3, mention_count: 102, mention_change: -3.4 } },
  { type: 'regional_office', target_ref: 'd_daegu_mayor', title: '대구시장', subtitle: '9회 지방선거 · 후보 3', category: '지방선거', preview: { member_count: 3, mention_count: 84, mention_change: 8.2 } },
  { type: 'regional_office', target_ref: 'd_incheon_mayor', title: '인천시장', subtitle: '9회 지방선거 · 후보 3', category: '지방선거', preview: { member_count: 3, mention_count: 72, mention_change: 5.1 } },
  { type: 'regional_office', target_ref: 'd_gwangju_mayor', title: '광주시장', subtitle: '9회 지방선거 · 후보 3', category: '지방선거', preview: { member_count: 3, mention_count: 58, mention_change: 7.0 } },

  // 정책 / 주제
  { type: 'issue_cluster', target_ref: 'kw_realestate', title: '부동산', subtitle: '정책 키워드 흐름', category: '정책/주제', preview: { mention_count: 412, mention_change: 28.4 } },
  { type: 'issue_cluster', target_ref: 'kw_ai_tech', title: 'AI/기술', subtitle: '정책 키워드 흐름', category: '정책/주제', preview: { mention_count: 318, mention_change: 35.0 } },
  { type: 'issue_cluster', target_ref: 'kw_youth', title: '청년', subtitle: '정책 키워드 흐름', category: '정책/주제', preview: { mention_count: 207, mention_change: 12.8 } },
  { type: 'issue_cluster', target_ref: 'kw_foreign_security', title: '외교안보', subtitle: '정책 키워드 흐름', category: '정책/주제', preview: { mention_count: 161, mention_change: -4.1 } },
  { type: 'issue_cluster', target_ref: 'kw_healthcare', title: '의료', subtitle: '정책 키워드 흐름', category: '정책/주제', preview: { mention_count: 144, mention_change: 16.2 } },
  { type: 'issue_cluster', target_ref: 'kw_defense', title: '국방', subtitle: '정책 키워드 흐름', category: '정책/주제', preview: { mention_count: 96, mention_change: 4.8 } },

  // 지역
  { type: 'issue_cluster', target_ref: 'region_seoul', title: '서울', subtitle: '지역 정치 흐름', category: '지역', preview: { mention_count: 528, mention_change: 14.0 } },
  { type: 'issue_cluster', target_ref: 'region_gyeonggi', title: '경기', subtitle: '지역 정치 흐름', category: '지역', preview: { mention_count: 362, mention_change: 8.4 } },
  { type: 'issue_cluster', target_ref: 'region_busan', title: '부산', subtitle: '지역 정치 흐름', category: '지역', preview: { mention_count: 224, mention_change: -2.1 } },
  { type: 'issue_cluster', target_ref: 'region_daegu', title: '대구', subtitle: '지역 정치 흐름', category: '지역', preview: { mention_count: 168, mention_change: 11.0 } },
  { type: 'issue_cluster', target_ref: 'region_gwangju', title: '광주', subtitle: '지역 정치 흐름', category: '지역', preview: { mention_count: 124, mention_change: 6.5 } },

  // 선거
  { type: 'election', target_ref: 'e_9th_local_election', title: '9회 지방선거', subtitle: '2026-06-03 · D-15', category: '선거', preview: { member_count: 348, mention_count: 2318, mention_change: 14.6, context_meta: 'D-15' } },
  { type: 'election', target_ref: 'e_by_election_2026', title: '2026 재·보궐', subtitle: '2026-06-03 · 14개 선거구', category: '선거', preview: { member_count: 14, mention_count: 384, mention_change: 14.2, context_meta: 'D-15' } },

  // 이슈 (동적 클러스터)
  { type: 'issue_cluster', target_ref: 'by_election_14', title: '재보궐 14곳', subtitle: '14개 선거구 · 6·3 동시', category: '이슈', preview: { member_count: 14, mention_count: 384, mention_change: 14.2 } },
  { type: 'issue_cluster', target_ref: 'today_surge_politicians', title: '오늘 많이 움직이는 사람', subtitle: '10인 · 자동 집계', category: '이슈', preview: { member_count: 10, mention_count: 612, mention_change: 24.6, context_meta: '24h' } },
  { type: 'issue_cluster', target_ref: 'today_surge_districts', title: '오늘 많이 움직이는 곳', subtitle: '10개 선거구 · 자동 집계', category: '이슈', preview: { member_count: 10, mention_count: 446, mention_change: 18.2, context_meta: '24h' } },
  { type: 'issue_cluster', target_ref: 'hot_regions', title: '관심 몰리는 지역', subtitle: '5개 광역 · 자동 집계', category: '이슈', preview: { member_count: 5, mention_count: 728, mention_change: 11.4 } },
];
