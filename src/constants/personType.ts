import type { PersonType } from '../types';

/**
 * 인물 유형 한국어 라벨.
 * 분류용 표기일 뿐, 평가/성향 의미를 담지 않는다.
 */

/** 상세 화면용 풀 라벨 */
export const personTypeLabel: Record<PersonType, string> = {
  elected_official: '선출직',
  party_leader: '정당 지도부',
  local_government: '지역 정치',
  political_commentator: '정치 평론가',
  political_youtuber: '정치 유튜버',
  political_platform_operator: '정치 플랫폼 운영자',
  political_influencer: '정치 인플루언서',
};

/** 카드/필터용 짧은 라벨 */
export const personTypeShortLabel: Record<PersonType, string> = {
  elected_official: '선출직',
  party_leader: '정당',
  local_government: '지역',
  political_commentator: '평론가',
  political_youtuber: '유튜버',
  political_platform_operator: '플랫폼',
  political_influencer: '인플루언서',
};

/** 검색 필터 표시 순서 */
export const SEARCH_FILTER_TYPES: PersonType[] = [
  'elected_official',
  'party_leader',
  'local_government',
  'political_commentator',
  'political_youtuber',
  'political_platform_operator',
  'political_influencer',
];

/**
 * 홈의 "영향력 인물 흐름" 섹션에 포함되는 유형 집합.
 * 통합 기획안 v2의 영향력시장(8번)에 대응.
 */
export const INFLUENCE_PERSON_TYPES: ReadonlyArray<PersonType> = [
  'political_commentator',
  'political_youtuber',
  'political_platform_operator',
  'political_influencer',
];

export const isInfluencePerson = (type: PersonType): boolean =>
  INFLUENCE_PERSON_TYPES.includes(type);
