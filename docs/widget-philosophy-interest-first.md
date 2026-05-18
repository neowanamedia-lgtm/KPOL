# KPOL 위젯 철학 — Interest-Target + Panel Architecture

작성일: 2026-05-19 (최종 수정 2회차 통합)
선행: [`election-focus-design.md`](./election-focus-design.md) · [`auto-update-architecture.md`](./auto-update-architecture.md) · [`chart-indicators.md`](./chart-indicators.md)

> **위젯은 기능이 아니라 관심 대상이다.**
> 그리고 그 관심 대상은 **고정 목록이 아니라 동적으로 갱신**된다.

---

## 0. 한 줄 요약

- 상위 레이어 = **InterestTarget** (사람 / 선거구 / 광역 직책 / 선거 / 동적 묶음)
- 하위 레이어 = **Panel** 12종 (뉴스 흐름 / 비교 / 차트 / 사설 / 공식자료 …)
- 운영 모델 = **시스템 자동 생성 + 관리자 수동 큐레이션** 동시 지원
- HomeScreen = "내 관심" + "추천 관심 대상" 두 영역

---

## 1. 핵심 철학 — 관심 대상이 위젯이다

| 기존 (수정 대상) | 새 방향 |
|---|---|
| 기능 위젯 (`ranking`, `theme_flow`) | 관심 대상 위젯 (`이재명`, `종로`, `서울시장`) |
| 위젯 제목 = 기능명 | 위젯 제목 = 고유명사 |
| "위젯 종류 추가" | "관심 대상 추가" |

**KPOL은 분석 플랫폼이 아니라 "관심 흐름 터미널"이다.**
사용자는 "정책 키워드 연결 위젯"을 보러 오지 않고, "이재명"을 보러 온다.

---

## 2. 두 레이어 구조

```
┌─ 상위 레이어 ────────────────────────────────────┐
│  InterestTarget                                  │
│    type · id · title · subtitle                  │
│    auto_generated · priority · pinned            │
│    panels[]  ←── 하위 레이어 구성 명세            │
└──────────────────────────────────────────────────┘
                       │
                       ▼
┌─ 하위 레이어 ────────────────────────────────────┐
│  Panel (12종)                                    │
│    뉴스 흐름 · 키워드 흐름 · 차트 · 비교         │
│    외부 사설/해설 · 공식자료 · 관련 기사 · 흐름   │
│    + 지표 · 관련 대상 · 정책 연결 · 언론 분포    │
└──────────────────────────────────────────────────┘
```

각 InterestTarget은 자신의 type에 맞는 default panels를 가지며, 관리자/사용자가 추가/제거할 수 있다.

---

## 3. InterestTarget 모델

### 3.1 타입 정의 (TS)

```typescript
// src/types/widget.ts (재작성 대상)

export type InterestTargetType =
  | 'politician'        // 이재명, 한동훈
  | 'district'          // 종로, 분당갑
  | 'regional_office'   // 서울시장, 경기지사 (UX 분리, 기술적으론 district)
  | 'election'          // 9회 지방선거
  | 'issue_cluster';    // 재보궐 14곳, 오늘 많이 움직이는 곳

export type Priority = 'pinned' | 'high' | 'normal' | 'low';

export type GeneratedReason =
  | 'election_cycle'    // 선거 일정 근접
  | 'mention_surge'     // 기사 급증
  | 'regional_focus'    // 지역 뉴스 집중
  | 'editorial_focus'   // 외부 사설 집중
  | 'keyword_surge'     // 키워드 급등
  | 'manager_pick';     // 관리자 수동

export interface InterestTarget {
  id: string;                  // interest_targets.id (uuid)
  type: InterestTargetType;
  /** politicians.id / districts.id / elections.id / cluster slug 등 */
  target_ref: string;
  title: string;               // "이재명", "종로"
  subtitle?: string;           // "민주당·당대표"

  // 운영 메타
  auto_generated: boolean;
  pinned: boolean;
  priority: Priority;
  priority_score: number;      // 0 ~ 100, 정렬 가중치
  active: boolean;
  generated_reason?: GeneratedReason;
  reason_metadata?: Record<string, unknown>;
  expires_at?: string;         // 자동 생성 대상의 자동 만료
  updated_at: string;

  // 패널 구성
  panels: PanelConfig[];
}

export interface PanelConfig {
  type: PanelType;
  visible: boolean;
  order: number;
  params?: Record<string, unknown>;
}
```

### 3.2 타입별 기본 동작

| target.type | target_ref 의미 | label 예 | 기본 panels |
|---|---|---|---|
| `politician` | politicians.id | "이재명" | trend · chart · keyword_flow · article · editorial · official_sources · compare · indicators |
| `district` | electoral_districts.id | "종로" | trend · related_targets(후보) · keyword_flow · compare · article · editorial · official_sources |
| `regional_office` | electoral_districts.id (metro_*) | "서울시장" | related_targets(후보) · compare · trend · keyword_flow · article · editorial · official_sources |
| `election` | elections.id | "9회 지방선거" | trend · related_targets(선거구) · keyword_flow · article · editorial |
| `issue_cluster` | 슬러그 | "재보궐 14곳" | related_targets(구성원) · trend · keyword_flow · article |

---

## 4. Panel — 12종

### 4.1 사용자 명시 8종

| Panel | 역할 | 데이터 소스 |
|---|---|---|
| `news_flow` | 뉴스 발행 시계열 | `news_articles` × 일자 |
| `keyword_flow` | 키워드 빈도/변화 | `extracted_keywords` 집계 |
| `compare_panel` | 다른 대상과 비교 | `getPoliticianComparison()` 등 |
| `chart_panel` | 14일 차트 (스파크라인 + 상세) | `daily_metrics` / `daily_district_metrics` |
| `editorial_panel` | 외부 사설·칼럼 (외부 의견 라벨 의무) | `news_articles WHERE article_type='editorial'` |
| `official_sources_panel` | 공식자료 (선관위·국회·지자체) | `news_articles WHERE article_type='official_source'` |
| `article_panel` | 관련 기사 (일반 뉴스) | `news_articles WHERE article_type='news'` |
| `trend_panel` | 흐름 요약 (오늘/7d/30d 변화율) | `v_politician_metrics` 등 |

### 4.2 추가 4종 (확장)

| Panel | 역할 | 비고 |
|---|---|---|
| `indicators_panel` | 6대 지표 (전국/지역/정책/이슈집중/매체다양성) | `politician_daily_indicators` |
| `related_targets_panel` | 관련 대상 리스트 (후보·멤버·같은 지역) | district→candidates, cluster→members |
| `policy_panel` | 정책 테마 연결 | `article_themes` 집계 |
| `media_panel` | 언론사 분포 (다양성·집중도) | source diversity 분석 |

### 4.3 PanelType union

```typescript
export type PanelType =
  // 사용자 명시 8종
  | 'news_flow' | 'keyword_flow' | 'compare_panel' | 'chart_panel'
  | 'editorial_panel' | 'official_sources_panel' | 'article_panel' | 'trend_panel'
  // 확장 4종
  | 'indicators_panel' | 'related_targets_panel' | 'policy_panel' | 'media_panel';
```

---

## 5. Widget Registry 수정안

### 5.1 두 레지스트리 분리

```typescript
// 1차: InterestTargetType → 홈 카드 프리뷰 컴포넌트
const targetCardRegistry: Record<InterestTargetType, ComponentType<TargetCardProps>> = {
  politician:       PoliticianTargetCard,
  district:         DistrictTargetCard,
  regional_office:  RegionalOfficeTargetCard,
  election:         ElectionTargetCard,
  issue_cluster:    ClusterTargetCard,
};

// 2차: PanelType → 패널 렌더러 (DetailScreen 안에서 펼쳐짐)
const panelRegistry: Record<PanelType, ComponentType<PanelProps>> = {
  news_flow:              NewsFlowPanel,
  keyword_flow:           KeywordFlowPanel,
  compare_panel:          ComparePanel,
  chart_panel:            ChartPanel,
  editorial_panel:        EditorialPanel,
  official_sources_panel: OfficialSourcesPanel,
  article_panel:          ArticlePanel,
  trend_panel:            TrendPanel,
  indicators_panel:       IndicatorsPanel,
  related_targets_panel:  RelatedTargetsPanel,
  policy_panel:           PolicyPanel,
  media_panel:            MediaPanel,
};
```

총 컴포넌트 수: 5 (카드) + 12 (패널) = 17. 기존 13개 위젯 컴포넌트 대비 +4이지만 책임 분리가 명확.

### 5.2 진입점

```tsx
// HomeScreen
{interestTargets.map((t) => {
  const Card = targetCardRegistry[t.type];
  return <Card key={t.id} target={t} onOpen={() => navigateToDetail(t)} />;
})}

// InterestDetailScreen
{target.panels
  .filter(p => p.visible)
  .sort((a, b) => a.order - b.order)
  .map((p) => {
    const Panel = panelRegistry[p.type];
    return <Panel key={p.type} target={target} params={p.params} />;
  })}
```

---

## 6. HomeScreen — 두 영역 구조

```
┌─────────────────────────────────────────┐
│ KPOL                       03:20 · DEMO │
│ 6·3 선거 흐름 터미널 · D-15              │
├─────────────────────────────────────────┤
│ ── 내 관심 (7) ─────────────[+ 추가] ── │
│ [재보궐 14곳]                            │
│ [서울시장]                              │
│ [이재명]                                │
│ [경기지사]                              │
│ [종로]                                  │
│ [오늘 많이 움직이는 곳]                  │
│ [9회 지방선거 전체]                      │
├─────────────────────────────────────────┤
│ ── 추천 관심 대상 ──────────────────── │
│ ※ 뉴스 흐름·선거 흐름 기반 자동 추천     │
│ [한동훈] (기사 급증)            [+추가] │
│ [부산시장] (선거 임박)          [+추가] │
│ [분당갑] (관심 몰림)            [+추가] │
│ [의료개혁] (키워드 급등)        [+추가] │
├─────────────────────────────────────────┤
│  Sample data for interface validation   │
└─────────────────────────────────────────┘
```

### 6.1 "내 관심" 영역

- `pinned` 우선 → `priority_score` 내림차순 → `updated_at` 내림차순
- 사용자가 추가/제거 가능
- 카드 3줄 이하 (제목 / 부제 / 메트릭)

### 6.2 "추천 관심 대상" 영역

- **시스템 자동 생성 + 관리자 큐레이션** 대상 중 사용자가 아직 추가하지 않은 것
- `generated_reason`을 작은 회색 라벨로 표시:
  - "기사 급증" (mention_surge)
  - "선거 임박" (election_cycle)
  - "관심 몰림" (regional_focus)
  - "키워드 급등" (keyword_surge)
  - "외부 사설 집중" (editorial_focus)
  - "큐레이션" (manager_pick)
- **알고리즘 피드 톤 금지**: 무한 스크롤 ✗, "당신을 위한" 같은 카피 ✗
- 4~6개 표시. 더 보기 → AddInterestScreen

---

## 7. 위젯 타이틀 / 카피 원칙

### 7.1 허용 / 금지

| ✅ 좋은 타이틀 | ❌ 나쁜 타이틀 |
|---|---|
| "이재명" / "한동훈" / "오세훈" | "정치인 비교 위젯" / "주요 인물 흐름" |
| "종로" / "분당갑" | "선거구 흐름 위젯" / "기사량 증가 선거구" |
| "서울시장" / "경기지사" | "광역 선거 위젯" |
| "재보궐 14곳" / "오늘 많이 움직이는 곳" | "급등 랭킹 위젯" / "이슈 트래커" |
| "9회 지방선거" | "선거 사이클 요약" |

### 7.2 부제목 패턴

| target.type | 부제목 예시 |
|---|---|
| politician | "민주당·당대표", "국힘·전 비대위원장" |
| district | "국회의원 재·보궐 · 후보 3" |
| regional_office | "9회 지방선거 · 후보 4" |
| election | "2026-06-03 · 활성 선거구 348" |
| issue_cluster | "14개 선거구 · 24h", "10개 인물 · 자동 집계" |

### 7.3 절대 안 쓰는 표현 (재확인)

위젯 어디서도 사용 금지:
- "최고의 / 최악의 / 1위 / 꼴찌"
- "당선 가능성 / 우세 / 열세 / 판세"
- "민심 / 분위기 / 여론 장악"
- "좋은 / 나쁜 / 강력한 / 약한"
- 알고리즘 피드형 카피 ("당신을 위한", "지금 핫한")

---

## 8. UX 흐름 — 표준 시나리오

### 8.1 "내가 사는 종로 보기"

```
1. HomeScreen → "내 관심" 비어있음
2. "추천 관심 대상" 영역에 [종로] (기사 급증) 카드 노출
3. [+추가] 탭 → 내 관심으로 이동
4. [종로] 카드 탭 → InterestDetailScreen (type=district)
5. 화면 구성:
   - 헤더: "종로" + "국회의원 재·보궐 · D-15"
   - trend_panel (오늘/7d/30d 변화율)
   - chart_panel (14일 흐름)
   - related_targets_panel (후보 3인)
   - compare_panel ("후보 비교 펼치기" 토글)
   - article_panel / editorial_panel / official_sources_panel
6. 후보 카드 탭 → 그 인물의 InterestDetailScreen으로 이동
```

### 8.2 "이재명 vs 한동훈 비교"

```
1. 홈에 [이재명] 추가
2. 카드 탭 → InterestDetailScreen
3. compare_panel의 "비교 추가" 버튼
4. 검색 모달에서 "한동훈" 선택
5. ComparePanel 펼침: 좌(이재명)·우(한동훈) + 5개 지표 + 14d 흐름
6. 헤더에 "흐름 차이 표시 · 평가 아님" 라벨
```

### 8.3 "재보궐 14곳 둘러보기"

```
1. 홈에서 [재보궐 14곳] 탭
2. InterestDetailScreen (type=issue_cluster)
3. related_targets_panel — 14개 선거구 리스트 (변화율 정렬)
4. 어느 선거구든 탭 → 그 선거구의 InterestDetailScreen
5. compare_panel에서 후보 자동 비교
```

### 8.4 네비게이션

```
RootStack:
  Splash
  Main (BottomTabs)
    ├ Home          (내 관심 + 추천 관심 대상)
    ├ Discover      (검색 + 모든 추천 + 관리자 큐레이션)
    └ Settings
  InterestDetail   { targetType, targetRef }   ← 통합 화면
  AddInterest      (검색 + 추천 카드 + "+" 액션)
  AdminTargets     (관리자 전용 — 큐레이션·핀고정 — 후순위)
```

`PoliticianDetail` / `DistrictDetail` 등 별도 라우트 대신 **단일 `InterestDetail`** 라우트가 `target_type` 으로 화면 구성 분기. 코드 단순화.

---

## 9. 데이터 모델 — `interest_targets` 테이블

별도 파일: `supabase/migrations/0008_interest_targets.sql`

```sql
create table interest_targets (
  id               uuid primary key default gen_random_uuid(),
  target_type      text not null check (target_type in (
    'politician', 'district', 'regional_office', 'election', 'issue_cluster'
  )),
  target_ref       text not null,        -- 외부 키 (politicians.id / districts.id / cluster slug)
  title            text not null,
  subtitle         text,

  -- 운영
  auto_generated   boolean not null default false,
  pinned           boolean not null default false,
  priority         text not null default 'normal'
                   check (priority in ('pinned','high','normal','low')),
  priority_score   int not null default 50,
  is_active        boolean not null default true,
  generated_reason text check (generated_reason in (
    'election_cycle','mention_surge','regional_focus',
    'editorial_focus','keyword_surge','manager_pick'
  )),
  reason_metadata  jsonb not null default '{}'::jsonb,
  expires_at       timestamptz,

  -- 패널 구성
  panels           jsonb not null default '[]'::jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 활성 대상 중복 방지 (같은 target은 1개만)
create unique index it_unique_active
  on interest_targets (target_type, target_ref)
  where is_active = true;

create index it_priority_idx on interest_targets(priority_score desc, updated_at desc)
  where is_active = true;
create index it_auto_idx on interest_targets(auto_generated, is_active);
```

---

## 10. 자동 생성 로직 설계

### 10.1 자동 대상 생성 트리거

| 트리거 | 함수 | 생성되는 target_type | reason |
|---|---|---|---|
| 선거 사이클 가까움 (D-30 이내) | `gen_election_cycle_targets()` | district, regional_office, election | `election_cycle` |
| 7일 기사 급증 상위 N | `gen_mention_surge_targets()` | politician, district | `mention_surge` |
| 광역 단위 기사 집중 | `gen_regional_focus_targets()` | district, regional_office | `regional_focus` |
| 외부 사설·칼럼 다수 등장 | `gen_editorial_focus_targets()` | politician, district | `editorial_focus` |
| 정책 키워드 급등 | `gen_keyword_surge_targets()` | issue_cluster (정책 슬러그) | `keyword_surge` |

### 10.2 통합 함수 (J4가 호출)

```sql
create or replace function refresh_auto_interest_targets(p_date date default current_date)
returns int
language plpgsql
as $$
declare v_count int := 0;
begin
  -- 1. 만료된 자동 대상 비활성화
  update interest_targets
  set is_active = false, updated_at = now()
  where auto_generated = true
    and (expires_at < now() or
         (generated_reason = 'mention_surge' and updated_at < now() - interval '3 days'));

  -- 2~6. 5개 생성 함수 순차 호출
  v_count := v_count + gen_election_cycle_targets(p_date);
  v_count := v_count + gen_mention_surge_targets(p_date);
  v_count := v_count + gen_regional_focus_targets(p_date);
  v_count := v_count + gen_editorial_focus_targets(p_date);
  v_count := v_count + gen_keyword_surge_targets(p_date);

  return v_count;
end;
$$;
```

### 10.3 생성 규칙 예시 — mention_surge

```sql
-- 어제 대비 기사 변화율 상위 5인을 politician 타입 자동 대상으로 등록
create or replace function gen_mention_surge_targets(p_date date)
returns int
language plpgsql
as $$
declare v_count int := 0;
begin
  with surge as (
    select p.id, p.name, pp.position_label, vpm.day_change_pct
    from politicians p
    left join lateral (
      select position_label from politician_positions pp2
      where pp2.politician_id = p.id and pp2.end_date is null limit 1
    ) pp on true
    join v_politician_metrics vpm on vpm.politician_id = p.id and vpm.date = p_date
    where p.is_active = true
      and vpm.day_change_pct >= 25       -- 임계값: +25% 이상
      and vpm.mention_count >= 30        -- 노이즈 차단: 30건 이상
    order by vpm.day_change_pct desc
    limit 5
  )
  insert into interest_targets (
    target_type, target_ref, title, subtitle,
    auto_generated, priority, priority_score,
    generated_reason, reason_metadata, expires_at, panels
  )
  select
    'politician',
    s.id::text,
    s.name,
    s.position_label,
    true,
    'high',
    80 + (rank() over (order by s.day_change_pct desc))::int,  -- 변화율 클수록 점수 ↑
    'mention_surge',
    jsonb_build_object('day_change_pct', s.day_change_pct),
    now() + interval '3 days',
    -- default politician panels
    '[
       {"type":"trend_panel","visible":true,"order":1},
       {"type":"chart_panel","visible":true,"order":2},
       {"type":"keyword_flow","visible":true,"order":3},
       {"type":"article_panel","visible":true,"order":4},
       {"type":"editorial_panel","visible":true,"order":5},
       {"type":"official_sources_panel","visible":true,"order":6}
     ]'::jsonb
  from surge s
  on conflict (target_type, target_ref) where is_active = true
  do update set
    priority_score = excluded.priority_score,
    generated_reason = excluded.generated_reason,
    reason_metadata = excluded.reason_metadata,
    expires_at = excluded.expires_at,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
```

다른 4개 함수도 같은 패턴 — 0008 SQL에 stub 형태로 포함.

---

## 11. 관리자 큐레이션 구조

### 11.1 데이터 관점

- `auto_generated = false`, `generated_reason = 'manager_pick'`
- 자동 대상과 같은 테이블, 같은 모양. UI에서 구분 표시.

### 11.2 관리자 액션

| 액션 | DB 변경 |
|---|---|
| 새 대상 추가 | INSERT (auto=false, priority='high', generated_reason='manager_pick') |
| 고정 | UPDATE pinned=true |
| 우선순위 조정 | UPDATE priority + priority_score |
| 자동 대상 → 관리자 보존 | UPDATE auto_generated=false (자동 만료 면제) |
| 비활성화 | UPDATE is_active=false |

### 11.3 관리자 화면 (후순위)

- 1차 출시에서는 SQL/Supabase Studio 직접 편집으로 시작
- 2차에 `AdminTargetsScreen` 도입 (선거 사이클 종료 후)

### 11.4 핀 고정 운영 가이드 (예: D-15 시점)

```sql
-- 6·3 출시 메인 핀 대상 — 관리자 시드
insert into interest_targets (target_type, target_ref, title, subtitle,
                              auto_generated, pinned, priority, priority_score,
                              generated_reason, panels)
values
  ('issue_cluster',   'by_election_14',         '재보궐 14곳',     '14개 선거구 · 6·3 동시', false, true, 'pinned', 100, 'manager_pick', '...'::jsonb),
  ('regional_office', '<seoul_mayor_id>',       '서울시장',        '9회 지방선거',           false, true, 'pinned', 99,  'manager_pick', '...'::jsonb),
  ('regional_office', '<gyeonggi_governor_id>', '경기지사',        '9회 지방선거',           false, true, 'pinned', 98,  'manager_pick', '...'::jsonb),
  ('election',        '<9th_local_election>',   '9회 지방선거',    '2026-06-03',             false, true, 'pinned', 97,  'manager_pick', '...'::jsonb);
```

이 시드는 0008 SQL의 마지막 부분에 둠 (실 ID 채워 넣은 뒤 실행).

---

## 12. 이후 구현 우선순위

### 12.1 코드 즉시 (오늘~내일)

| 우선 | 작업 | 파일 |
|---|---|---|
| **C1** | `src/types/widget.ts` 재작성 — InterestTarget + Panel 모델 | 새 파일 |
| **C2** | 기존 `WidgetType` enum 제거 — 죽은 코드 청소 | 종전 작업 정리 |
| **C3** | DataProvider 확장 — `getInterestTargets()` / `getInterestTarget(type, ref)` / `getInterestDetail(target)` / `getRecommendations()` | FakeDataProvider + SupabaseDataProvider 스텁 |
| **C4** | 5개 TargetCard 컴포넌트 (홈 카드 프리뷰) | `src/widgets/cards/*` |
| **C5** | HomeScreen 재구성 — "내 관심" + "추천 관심 대상" 두 영역 | `screens/HomeScreen.tsx` |

### 12.2 다음 (이번 주, 키 발급 후 병행)

| 우선 | 작업 | 산출 |
|---|---|---|
| **C6** | InterestDetailScreen 통합 — 패널 순회 렌더 | `screens/InterestDetailScreen.tsx` |
| **C7** | 12개 Panel 컴포넌트 (8 사용자명시 + 4 확장) | `src/widgets/panels/*` |
| **C8** | AddInterestScreen — 검색 + 추천 추가 흐름 | 신규 화면 |
| **C9** | 사용자 관심 목록 로컬 persistence (`AsyncStorage`) | 클라이언트 |

### 12.3 데이터 적재 직후

| 우선 | 작업 | 산출 |
|---|---|---|
| **C10** | 0008_interest_targets.sql 적용 | SQL 마이그레이션 |
| **C11** | 5개 자동 생성 함수 실 구현 (mention_surge부터) | `supabase/migrations/0008_interest_targets.sql` |
| **C12** | J4에 `refresh_auto_interest_targets` 호출 추가 | Edge Function 업데이트 |
| **C13** | 6·3 핀 시드 (관리자 큐레이션) | SQL INSERT |

### 12.4 출시 후

| 우선 | 작업 | 산출 |
|---|---|---|
| **C14** | 사용자별 관심 Supabase 동기화 | `user_interest_targets` 테이블 신설 |
| **C15** | AdminTargetsScreen — 관리자 큐레이션 UI | 신규 화면 |
| **C16** | 드래그 정렬 / 카드 크기 토글 | HomeScreen 인터랙션 |
| **C17** | 추천 알고리즘 고도화 — A/B 큐레이션 등 | 운영 작업 |

---

## 13. 마이그레이션 영향 (기존 산출물)

| 산출물 | 처리 |
|---|---|
| 기존 W1 — `src/types/widget.ts` 13종 WidgetType | **C1에서 폐기·재작성** |
| 기존 W1 — DataProvider 6개 신규 메서드 (Compare/Theme/Region/Keyword/Market/Recent) | **재사용** — 모두 Panel 데이터 소스로 그대로 사용 |
| W1 FakeDataProvider 구현 | **재사용** — 3개 메서드(getDistrictDetail/getElectionSummary/getIssueCluster) 추가만 |
| W1 useApi 6개 훅 | **재사용** |
| election-focus-design.md의 4개 신규 widget type | **격하** — 모두 InterestTarget의 type 또는 cluster 슬러그로 흡수 |
| 미구현된 13개 위젯 컴포넌트 계획 | **폐기** → 5 카드 + 12 패널로 대체 |

**데이터 레이어(DB/RPC/DataProvider 메서드) 100% 재사용.** 변경은 UI 추상화 + 위젯 모델만.

---

## 14. 검증 필요 항목

1. **자동 생성 임계값** — `mention_surge`의 +25% / 30건 임계값은 적정한지 실 데이터로 튜닝
2. **expires_at 정책** — mention_surge=3일, election_cycle=선거일까지 등 reason별 차등
3. **추천 영역 N개** — 4개? 6개? UX 테스트 필요
4. **관리자 핀 충돌** — auto-generated와 manager_pick이 같은 target_ref에 동시 등록되려 할 때 manager_pick이 우선되도록 UPSERT 정책 정리
5. **issue_cluster 슬러그 사전 표준화** — `by_election_14` / `today_surge_districts` 같은 슬러그 명명 규칙 문서화

---

## 15. 요약

1. **상위 = InterestTarget (5종) · 하위 = Panel (12종)** 두 레이어로 분리
2. **InterestTarget 동적 운영**: auto_generated + manager_pick + priority + expires_at
3. **HomeScreen 두 영역**: 내 관심 + 추천 관심 대상 (알고리즘 피드 톤 금지)
4. **단일 `InterestDetailScreen`** — target_type으로 패널 구성 분기
5. **신규 SQL**: `interest_targets` 테이블 + 5개 자동 생성 함수 + `refresh_auto_interest_targets`
6. **데이터 레이어 100% 재사용** — DB/RPC/메서드 변경 없음, UI 추상화만 교체
7. **6·3 출시**: 4~7개 핀 + 자동 갱신 영역 운영

다음 코드 신호 주시면 C1(타입 재작성)부터 즉시 진행하겠습니다.
