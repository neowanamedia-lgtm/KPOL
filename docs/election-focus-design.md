# KPOL 1차 출시 — 6·3 선거 흐름 터미널 설계

작성일: 2026-05-19 · D-15
대상: 1차 출시 = 제9회 전국동시지방선거(2026-06-03) + 국회의원 재·보궐 14곳 흐름 터미널
선행: [`data-sources-report.md`](./data-sources-report.md) · [`auto-update-architecture.md`](./auto-update-architecture.md) · [`chart-indicators.md`](./chart-indicators.md)

---

## 0. 정체성 (재선언)

> **KPOL은 1차 출시 시점에 "6·3 선거 흐름 터미널"이다.**
> 후보를 평가하지 않는다. 당선 가능성을 예측하지 않는다.
> 사용자가 맥락을 확인할 수 있도록 **뉴스 흐름과 외부 기사·공식자료를 연결**한다.

---

## 1. 6·3 선거 중심 UX 설계

### 1.1 핵심 사용자 가치

> "내가 사는 선거구 / 관심 선거구의 **뉴스 흐름**을 한눈에 본다."

기존 KPOL이 "인물 시장"이었다면, 1차 출시 KPOL은 "**선거구 시장**".
인물은 선거구 안의 종목, 선거구는 시장 단위, 6·3은 결산일.

### 1.2 해야 할 것 / 하지 말아야 할 것 (선거 기간 강화)

| ✅ 허용 | ❌ 금지 |
|---|---|
| 뉴스 언급량 기준 변화 | 당선 가능성·확률 |
| 기사 증가율 / 7일·30일 비교 | 우세 / 열세 / 판세 단정 |
| 연결 키워드 / 정책 테마 | 민심 판단 / 분위기 추정 |
| 기사 집중도 / 언론사 다양성 | 후보 평가 / 좋은-나쁜 후보 |
| 외부 사설·칼럼 연결 (외부 의견 라벨) | KPOL 자체 의견 / 논평 |
| 공식자료 링크 (선관위·국회·지자체) | 여론조사 결과 추정 표시 |

**선거 기간 특별 정책 토글**: `system_settings.election_period_active = true`일 때는 변화율 표시 일시 정지, 비교 위젯 헤더에 "흐름 차이 표시 · 평가 아님" 라벨 의무.

### 1.3 사용자 흐름

```
[홈 — 선거구 중심] ─→ [선거구 상세 DistrictDetail] ─→ [후보 비교 / 인물 상세]
                                                              │
                            ↓                                 ↓
                  [관련 기사 / 사설·칼럼 / 공식자료] ◀────────┘
```

---

## 2. 데이터 모델 초안

### 2.1 신규 테이블 5종

```sql
-- elections : 선거 회차 마스터
elections (
  id              uuid PK,
  name            text NOT NULL,         -- "제9회 전국동시지방선거"
  election_type   text NOT NULL,         -- 'general' | 'local' | 'by_election' | 'presidential'
  date            date NOT NULL,
  status          text NOT NULL,         -- 'upcoming' | 'ongoing' | 'completed'
  nec_election_id text,                  -- 선관위 선거ID (외부 API 키)
  created_at      timestamptz default now()
)

-- electoral_districts : 선거구
electoral_districts (
  id                uuid PK,
  election_id       uuid FK -> elections,
  name              text NOT NULL,       -- "서울 종로구"
  name_short        text,                -- "종로"
  region_code       text,                -- 행정구역 코드 (광역)
  parent_region     text,                -- "서울특별시"
  district_type     text NOT NULL,
  -- 'assembly_member' | 'metro_governor' | 'metro_mayor' | 'basic_mayor'
  -- 'basic_assembly_proportional' | 'basic_assembly_seat'
  -- 'educational_superintendent' | 'edu_committee'
  seats             int NOT NULL default 1,
  nec_district_code text,                -- 선관위 선거구 코드
  is_byelection     boolean default false,
  status            text default 'active',
  created_at        timestamptz default now()
)

-- candidates : 후보자 (특정 선거 × 선거구 × 인물)
candidates (
  id                uuid PK,
  election_id       uuid FK,
  district_id       uuid FK -> electoral_districts,
  politician_id     uuid FK -> politicians,    -- 기존 인물 마스터와 연결
  party_id          uuid FK -> parties,
  candidate_number  int,                -- 기호
  status            text NOT NULL,
  -- 'registered' | 'withdrew' | 'elected' | 'not_elected' | 'invalid'
  registered_at     timestamptz,
  nec_candidate_id  text,
  unique (election_id, district_id, politician_id)
)

-- district_watch : 사용자 관심 선거구 (개인화 후속 단계)
-- 1차 출시에서는 단일 사용자 / 디바이스 단위로 클라이언트 저장
district_watch (
  user_id    text NOT NULL,         -- anon 사용자 식별자
  district_id uuid FK,
  added_at   timestamptz default now(),
  primary key (user_id, district_id)
)
```

### 2.2 기존 테이블 확장

```sql
-- news_articles : 기사 분류 추가
alter table news_articles
  add column if not exists article_type text NOT NULL default 'news'
  check (article_type in (
    'news',              -- 일반 기사
    'editorial',         -- 사설·칼럼 (외부 의견)
    'analysis',          -- 해설 기사
    'interview',         -- 인터뷰
    'official_source'    -- 공식자료 (선관위·국회·지자체)
  ));

-- article_mentions : 선거구 컨텍스트 추가
alter table article_mentions
  add column if not exists district_id uuid references electoral_districts(id);

-- politicians : 현재 출마 선거구 캐시 (J1 갱신)
alter table politicians
  add column if not exists current_candidacy_district_id uuid references electoral_districts(id);
```

### 2.3 일별 선거구 집계

```sql
-- daily_district_metrics : 선거구 단위 일배치 집계
daily_district_metrics (
  district_id      uuid FK -> electoral_districts,
  date             date NOT NULL,
  mention_count    int default 0,
  source_count     int default 0,
  top_keywords     text[] default '{}',
  top_themes       text[] default '{}',
  candidate_count  int default 0,
  computed_at      timestamptz default now(),
  primary key (district_id, date)
)
```

→ 별도 SQL 파일: `supabase/migrations/0007_election_schema.sql` (초안 작성, 적용 보류)

### 2.4 RelatedArticle — DTO 정의

DB 변경 없이 RPC 응답 단계에서 `article_type` 기반으로 그룹화하여 반환:

```typescript
// dataProvider/types.ts
export type ArticleType = 'news' | 'editorial' | 'analysis' | 'interview' | 'official_source';

export interface RelatedArticleDTO {
  id: string;
  article_type: ArticleType;       // NEW
  title: string;
  source: string;
  published_at: Iso;
  url: string;
  ai_summary_flag: boolean;
  basis_label: string;              // 예: "외부 사설·칼럼", "언론사 해설", "공식자료"
}
```

---

## 3. 위젯 시스템 확장 — 신규 위젯 4종

기존 9개 `WidgetType` + 신규 4개 = 13종.

```typescript
export type WidgetType =
  // ── 기존 ──
  | 'politician_single' | 'politician_compare' | 'ranking'
  | 'theme_flow' | 'region_flow' | 'influence_flow'
  | 'keyword_surge' | 'market_snapshot' | 'news_stream'
  // ── 선거 전용 (신규) ──
  | 'district_flow'           // 단일 선거구 흐름
  | 'district_candidate_compare'   // 같은 선거구 후보 비교 (Compare의 특수화)
  | 'by_election_focus'       // 재·보궐 14곳 집중
  | 'election_summary';       // 6·3 선거 사이클 요약
```

### 3.1 district_flow — 선거구 흐름 위젯

```
┌─────────────────────────────────────────┐
│ 서울 종로구 · 국회의원 재·보궐 · 흐름   │
│ 뉴스 언급량 기준 · 7d                    │
├─────────────────────────────────────────┤
│ 오늘 기사    72  ▲ +24.3%               │
│ 활성 후보    3                          │
│ ▁▂▃▄▅▆▇█  (스파크라인)                 │
│                                         │
│ 키워드  [재건축] [재보궐] [지방행정]     │
│ 후보(3) → 자세히 보기                    │
└─────────────────────────────────────────┘
```

**params**: `{ district_id }`

### 3.2 district_candidate_compare — 선거구 후보 비교 위젯 ★ 핵심

같은 `district_id`의 후보들을 자동으로 끌어와 Compare 위젯의 `district` 모드로 렌더.

```
┌─────────────────────────────────────────┐
│ 서울 종로구 · 후보 비교                  │
│ 뉴스 언급량 기준 · 평가 아님 · 흐름 차이  │
├──────────────┬──────────────┬───────────┤
│ 후보 A        │ 후보 B        │ 후보 C    │
│ 정당          │ 정당          │ 정당      │
│ 142 +28%     │ 118 +22%     │ 64 +14%  │
│ ▁▃▆▇█      │ ▁▂▅▆▇       │ ▁▂▃▄▅   │
│ [부동산]      │ [복지]        │ [청년]    │
└──────────────┴──────────────┴───────────┘
   ─ 흐름 차이 표시, 우열 아님 ─
```

**params**: `{ district_id, focus_metric? }`
**구현**: `PoliticianCompareWidget`의 `compare_mode='district'` 분기 (기존 위젯 재사용).

### 3.3 by_election_focus — 재·보궐 14곳 집중 위젯

```
┌─────────────────────────────────────────┐
│ 국회의원 재·보궐 · 14곳 · 24h            │
│ 기사 증가 상위                          │
├─────────────────────────────────────────┤
│ ▲ 서울 종로구       72  +24.3%          │
│ ▲ 부산 사하구갑     58  +18.0%          │
│ ▲ 인천 미추홀구을   44  +11.5%          │
│ ─ 경기 화성을       38   +2.1%          │
│ ▼ 광주 서구갑       28   −4.0%          │
│   ...                                   │
└─────────────────────────────────────────┘
   탭 → DistrictDetailScreen
```

**params**: `{ election_id, limit? }`

### 3.4 election_summary — 6·3 선거 사이클 요약 위젯

```
┌─────────────────────────────────────────┐
│ 6·3 선거 흐름 · D-15                     │
├─────────────────────────────────────────┤
│ 활성 선거구         326                  │
│ 활성 후보         1,842                  │
│ 오늘 관련 기사     2,318  ▲ +14.6%      │
│ 활성 정책 테마        8                  │
│                                         │
│ 6월 3일 결산 · 뉴스 언급량 기준          │
└─────────────────────────────────────────┘
```

**params**: `{ election_id }`

---

## 4. HomeScreen 위젯 재배치안

### 4.1 기본 홈 배치 (1차 출시)

```typescript
export const defaultHomeWidgets_v1: WidgetConfig[] = [
  // 1. 헤더 — 사이클 요약
  { id: 'w_election_summary',  type: 'election_summary',         title: '6·3 선거 흐름', size: 'large',  order: 1, visible: true,
    params: { election_id: '<9th_local_election>' } },

  // 2. 재·보궐 14곳 집중
  { id: 'w_by_election',       type: 'by_election_focus',         title: '재·보궐 14곳', size: 'large',  order: 2, visible: true,
    params: { election_id: '<by_election_2026>', limit: 14 } },

  // 3. 오늘 기사 증가 선거구
  { id: 'w_district_surge',    type: 'ranking',                   title: '오늘 기사 증가 선거구', size: 'medium', order: 3, visible: true,
    params: { ranking_type: 'district_surge', scope: '6·3' } },

  // 4. 관심 선거구 후보 비교 (사용자 미설정 시 가장 핫한 선거구 자동)
  { id: 'w_district_compare',  type: 'district_candidate_compare', title: '관심 선거구 후보 비교', size: 'large',  order: 4, visible: true,
    params: { district_id: '<auto_or_user_pick>' } },

  // 5. 주요 정책 키워드 (선거 컨텍스트)
  { id: 'w_keyword_surge',     type: 'keyword_surge',             title: '급등 키워드', size: 'small',  order: 5, visible: true },

  // 6. 외부 사설·해설 연결
  { id: 'w_editorial_stream',  type: 'news_stream',               title: '외부 사설·해설', size: 'medium', order: 6, visible: true,
    params: { article_types: ['editorial', 'analysis'], limit: 5 } },

  // 7. 관심 인물 흐름
  { id: 'w_watchlist',         type: 'influence_flow',            title: '관심 인물 흐름', size: 'medium', order: 7, visible: true },
];
```

### 4.2 일반 정치 홈은 후순위

기존 `market_snapshot` / 일반 `theme_flow` / 일반 `region_flow` 위젯은 1차 출시 기본 홈에서 제외. 사용자가 명시적으로 추가하는 경우에만 표시. 6·3 결산 후 단계적 복원.

### 4.3 적응형 표시

| 사용자 상태 | 홈 구성 |
|---|---|
| 신규 사용자 | 위 v1 기본 배치 그대로 |
| 관심 선거구 등록 (1개 이상) | `w_district_compare`가 등록된 선거구를 사용 |
| 관심 선거구 다수 | 위젯 추가 가능 — 사용자별 정렬 |

---

## 5. DistrictDetailScreen — 선거구 상세 화면 구조

### 5.1 화면 구성

```
┌─────────────────────────────────────────┐
│ ← 서울 종로구                            │
│   국회의원 재·보궐 · 1석                  │
│   2026-06-03 · 활성                      │
│   [마지막 업데이트 03:20 · DEMO]         │
├─────────────────────────────────────────┤
│ ── 흐름 지표 (7d) ────────────────────  │
│  기사    72  ▲ +24.3%                   │
│  활성 후보 3                            │
│  매체 다양성 8개                        │
│  ▁▂▃▄▅▆▇█  (스파크라인)                │
├─────────────────────────────────────────┤
│ ── 후보·관련 인물 (3) ─────────────────  │
│  [후보 A]                               │
│  [후보 B]                               │
│  [후보 C]                               │
│  ─ 비교 위젯으로 열기                    │
├─────────────────────────────────────────┤
│ ── 최근 이슈 흐름 ────────────────────  │
│  [재건축 안전진단]                       │
│  [지방행정 권한]                         │
│  [재보궐 사유]                          │
├─────────────────────────────────────────┤
│ ── 관련 기사 (24) ────────────────────  │
│  ─ {제목}  {매체}  {시각}                │
│  ─ ...                                  │
├─────────────────────────────────────────┤
│ ── 외부 사설·칼럼 (8) ──────────────────│
│  ⚠ 외부 언론사의 의견·해설입니다.        │
│  ⚠ KPOL의 입장이 아닙니다.               │
│  ─ {제목}  {매체}  {시각}                │
├─────────────────────────────────────────┤
│ ── 언론사 해설 (5) ───────────────────  │
│  ─ {제목}                                │
├─────────────────────────────────────────┤
│ ── 공식자료 (3) ──────────────────────  │
│  ─ 선관위 후보자 정보                    │
│  ─ 선거구 공시 자료                     │
│  ─ 지자체 행정 자료                     │
├─────────────────────────────────────────┤
│  Sample data for interface validation   │
└─────────────────────────────────────────┘
```

### 5.2 데이터 컨트랙트

```typescript
// dataProvider/types.ts (추가)
export interface DistrictDetail extends ResponseMeta {
  district: {
    id: string;
    name: string;
    election_id: string;
    election_name: string;
    election_date: string;
    district_type: string;
    seats: number;
    parent_region: string | null;
    is_byelection: boolean;
    status: string;
  };
  flow: {
    today_mention_count: number;
    mention_change: number;
    flow_14d: FlowPointDTO[];
    active_source_count: number;
  };
  candidates: PoliticianCardDTO[];   // 같은 선거구 후보들
  current_issues: { keyword: string; mention_count: number }[];
  /** 기사 분류별 그룹화 */
  articles_by_type: {
    news: RelatedArticleDTO[];
    editorial: RelatedArticleDTO[];      // 외부 의견 라벨 의무
    analysis: RelatedArticleDTO[];
    interview: RelatedArticleDTO[];
    official_source: RelatedArticleDTO[];
  };
}
```

### 5.3 라우팅

`RootStackParamList`에 추가:

```typescript
DistrictDetail: { districtId: string };
```

진입:
- HomeScreen의 `by_election_focus` 위젯 → 항목 탭
- `district_flow` 위젯 → 카드 전체 탭
- 후보 비교 위젯 → 헤더의 "선거구 보기" 링크
- PoliticianDetailScreen → "출마/관련 선거구" 섹션 → 탭

### 5.4 PoliticianDetail 보강

기존 인물 상세에 추가 섹션:

```
── 출마/관련 선거구 ─────────────────────
   서울 종로구 · 국회의원 재·보궐 · 1석
   2026-06-03
   ─ 선거구 상세 보기

── 같은 선거구 다른 후보 ─────────────────
   [후보 B]
   [후보 C]
   ─ 후보 비교 위젯으로 열기
```

---

## 6. 기사·사설·공식자료 연결 UI 원칙

### 6.1 분류별 UI 톤

| article_type | 라벨 (UI) | 톤 | 외부 의견 경고 |
|---|---|---|---|
| `news` | "관련 기사" | 기본 | 불필요 |
| `editorial` | "외부 사설·칼럼" | 약한 amber 보더 | **"외부 언론사의 의견" 명시** |
| `analysis` | "언론사 해설" | 약한 amber 보더 | "언론사 해설" 라벨 |
| `interview` | "인터뷰" | 기본 | 불필요 |
| `official_source` | "공식자료" | 약한 회색 보더 + 🏛️ 아이콘 X (이모지 금지, 텍스트만) | "선관위·국회·지자체 공식자료" |

### 6.2 사설·칼럼 표시 강화 (법적 리스크 대응)

```
┌─────────────────────────────────────────┐
│ 외부 사설·칼럼 (8)                       │
│ ─ 외부 언론사의 의견·해설입니다.        │
│ ─ KPOL의 입장이 아닙니다.                │
├─────────────────────────────────────────┤
│ [사설] {제목}                            │
│ {매체} · {시각}                         │
└─────────────────────────────────────────┘
```

**라벨 의무 항목**:
1. 섹션 헤더에 "외부 의견" 명시
2. 카드 상단 좌측에 `[사설]` / `[칼럼]` 베지
3. 매체명 옆에 작은 회색 점으로 외부임을 표시
4. KPOL 자체 의견 아님을 푸터에 한 번 더 명시

### 6.3 AI 요약 사용 시

- 카드에 `AI 요약` 작은 배지
- 푸터에 "AI 요약은 빅카인즈 LAB get_summary 기반" 단일 줄
- 절대 KPOL이 직접 의견을 생성한 것처럼 보이면 안 됨

### 6.4 외부 링크 클릭

- 모든 기사 카드 탭 → 외부 브라우저 (`Linking.openURL`)
- 내부에서 본문을 렌더링하지 않는다 (저작권 안전)

### 6.5 공식자료 (official_source) 특별 표기

```
┌─────────────────────────────────────────┐
│ 공식자료 (3)                            │
│ ─ 선관위·국회·지자체에서 공개한 자료     │
├─────────────────────────────────────────┤
│ {제목}                                  │
│ 출처: 중앙선거관리위원회                 │
│ 공시일: 2026-05-15                      │
│ [원문 자료로 이동]                       │
└─────────────────────────────────────────┘
```

- 공식자료는 `source` 필드에 기관명 표기
- `source_provider`는 `'nec'` / `'assembly'` / `'local_gov'` 등 별도 enum 확장 가능

---

## 7. 이후 구현 작업 순서

### 7.1 즉시 (오늘~내일)

1. **0007 마이그레이션 SQL 작성** (`supabase/migrations/0007_election_schema.sql`)
   - 5개 신규 테이블 + 3개 ALTER + 1개 집계 테이블
   - 적용은 Supabase 발급 후

2. **DataProvider 인터페이스 확장**
   - `getElectionSummary(electionId)`
   - `getDistrictDetail(districtId)`
   - `getByElectionFocus(electionId, limit)`
   - `getCandidatesForDistrict(districtId)`
   - `getDistrictArticlesByType(districtId)`

3. **WidgetType 4종 추가** + `defaultHomeWidgets_v1`로 교체

### 7.2 내일~모레 (키 발급 후)

4. **신규 위젯 컴포넌트 4종** 작성
   - `DistrictFlowWidget` / `DistrictCandidateCompareWidget` / `ByElectionFocusWidget` / `ElectionSummaryWidget`
   - `PoliticianCompareWidget`에 `compare_mode='district'` 분기 추가

5. **DistrictDetailScreen 신설** + 라우팅 추가

6. **HomeScreen 재구성** — v1 배치 적용

7. **PoliticianDetailScreen** "출마/관련 선거구" 섹션 추가

### 7.3 데이터 적재 (선관위 API 가동 후)

8. **J1 (profile_sync) 확장** — `elections`, `electoral_districts`, `candidates` 동기화 추가
9. **J2 (news_ingest) 확장** — 빅카인즈 응답의 매체 분류 → `article_type` 매핑 (사설/해설 식별)
10. **J3 (mapping_engine) 확장** — 기사 → 선거구 매핑 추가 (`article_mentions.district_id`)
11. **J4 (aggregate_and_rank)** — `daily_district_metrics` 추가, `district_surge` 랭킹 추가

### 7.4 선거 기간 운영 정책

12. `system_settings.election_period_active = true` 시
    - 비교 위젯 헤더에 "흐름 차이 표시 · 평가 아님" 라벨 의무 노출
    - 외부 사설·칼럼 섹션에 "외부 의견" 헤더 강화
    - 6월 2일 24시 ~ 6월 3일 20시: 여론조사·예측성 컨텐츠 노출 일시 정지 토글
13. 정정 요청 채널 — Settings 화면에 추가

---

## 8. 검증 필요 항목

1. **재·보궐 14곳 정확 명단** — 선관위 자료로 확인. 2026-06-03 동시 실시 기준.
2. **공직선거법 적용 범위** — KPOL이 "뉴스 언급량 기준 표시"만 하는 경우 제108조(여론조사 결과 공표) 적용 여부. 변호사 자문 권장.
3. **빅카인즈 응답에서 사설/칼럼/해설 구분** — `category` 또는 `byline_type` 필드 존재 여부. 매뉴얼 확인 후 매핑 결정.
4. **선관위 후보자 API 데이터 갱신 시점** — 후보 등록 마감 후 며칠 내 반영되는지.
5. **9회 지방선거 `nec_election_id` 값** — `0007_election_schema.sql` 시드 데이터에 필요.

---

## 9. 1차 출시 D-15 마일스톤

| 일자 | 작업 |
|---|---|
| 2026-05-19 (오늘) | 본 설계 문서 확정. 0007 SQL 초안. 메모리 갱신. |
| 2026-05-20 | 사용자 키 발급 (data.go.kr / 빅카인즈 / Supabase). 0001~0006 적용. |
| 2026-05-21~22 | 0007 적용 + DataProvider 확장 + 위젯 4종 컴포넌트 |
| 2026-05-23~24 | DistrictDetailScreen + HomeScreen v1 + 라우팅 |
| 2026-05-25~26 | J1 확장 (선거 데이터 적재) + 24시간 검증 |
| 2026-05-27~28 | J2/J3/J4 확장 + article_type 분류 + 실 흐름 가동 |
| 2026-05-29~30 | 운영 정책 토글 + 정정 요청 채널 + 최종 점검 |
| 2026-05-31~06-02 | 베타 검증 / 부하 테스트 |
| **2026-06-03** | **9회 지방선거 + 재·보궐 — KPOL 1차 출시 가동** |
| 2026-06-04~ | 결산 / 일반 홈 위젯 복귀 / 2차 사이클 |

---

## 10. 요약

1. KPOL 1차 출시 = **6·3 선거 흐름 터미널** (D-15)
2. 데이터 모델: `elections / electoral_districts / candidates / daily_district_metrics` 5개 신규 + 3개 ALTER
3. 위젯: 9개 기존 + 4개 신규 = 13개. 홈 v1은 **선거구 중심 7개 배치**
4. 새 화면: `DistrictDetailScreen` 신설, `PoliticianDetailScreen`에 출마/관련 선거구 섹션 추가
5. 기사 분류 5종 (`news / editorial / analysis / interview / official_source`) — 사설·칼럼은 **외부 의견 명시 의무**
6. KPOL은 **연결만 한다**: 평가·예측·우열·판세 단정 절대 금지. 공직선거법 리스크 대응.
