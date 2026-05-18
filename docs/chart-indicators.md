# KPOL 차트 지표 설계

작성일: 2026-05-19
선행 문서: [`data-sources-report.md`](./data-sources-report.md), [`auto-update-architecture.md`](./auto-update-architecture.md)

---

## 0. 설계 원칙

> **정치인의 가치/평가/호감도 차트가 아니라, 뉴스 기반 흐름 차트.**

| 표기 가능 | 표기 금지 |
|---|---|
| 노출 / 연결 / 집중도 / 다양성 | 인기·신뢰·우열·여론 장악·지지율 |
| 변화율 / 분포 / 시계열 | "좋다·나쁘다 / 1위·꼴찌 / 승·패" |
| 근거 기사 보기 | 영향력 평가 문장 |

모든 지표는:
- 산정식 명시 (`basis_label`)
- 근거 기사 역추적 가능 (`article_mentions` → `news_articles`)
- 데이터 소스가 라벨에 포함 ("빅카인즈 기준", "지역 매체 포함" 등)

---

## 1. 6대 지표 정의

### 1.1 전국 뉴스 노출 지수 (National Exposure Index)

| 항목 | 내용 |
|---|---|
| **정의** | 전국 매체의 보도량 가중치 |
| **산정식** | `mention_count_national * log(1 + national_source_count)` |
| `mention_count_national` | 최근 N일 동안 전국지/방송이 다룬 기사 수 |
| `national_source_count` | 그 기간 동안 다룬 distinct 전국 매체 수 |
| **단위** | 절대값 (정규화는 UI 단계) |
| **윈도우** | 1일 / 7일 / 30일 |
| **표기 라벨** | "전국 뉴스 노출 · {window} · 빅카인즈 기준" |

### 1.2 지역 뉴스 노출 지수 (Regional Exposure Index)

| 항목 | 내용 |
|---|---|
| **정의** | 정치인의 지역구 또는 활동 지역 매체에서의 보도량 |
| **산정식** | `mention_count_regional * log(1 + regional_source_count)` |
| **매칭 규칙** | (1) 매체의 `region_code`가 정치인 `politician_positions.region_code`와 같음 OR (2) 기사 본문에 정치인 지역구명 포함 |
| **단위** | 절대값 |
| **윈도우** | 7일 / 30일 (지역 매체는 보도 빈도 낮음 → 윈도우 넓게) |
| **표기 라벨** | "지역 뉴스 노출 · 지역 매체 한정 · {window}" |
| **주의** | MVP 단계는 빅카인즈의 지역지 카테고리만 사용 → 부정확. 3단계 RSS 보완 시 의미 향상. |

### 1.3 정책 키워드 연결 지수 (Policy Keyword Connection Index)

| 항목 | 내용 |
|---|---|
| **정의** | 정치인이 정책 키워드와 함께 등장하는 폭과 연결도 |
| **산정식** | `distinct_policy_keywords + α * sum(keyword_frequency)` (α는 가중치) |
| `distinct_policy_keywords` | 매핑된 기사들의 `extracted_keywords` 중 정책 슬러그에 매칭된 키워드 수 |
| **단위** | 절대값 (키워드 수) |
| **윈도우** | 30일 |
| **표기 라벨** | "정책 키워드 연결 · 30d · 자동 추출 기반" |
| **부차 출력** | 상위 5개 키워드 목록 → `politicians.current_keywords`에 캐시 |

### 1.4 이슈 집중도 (Issue Concentration)

| 항목 | 내용 |
|---|---|
| **정의** | 정치인의 기사 분포가 특정 테마에 집중된 정도 |
| **산정식** | HHI = `Σ(share_i)²` where `share_i = articles_in_theme_i / total_articles` |
| **범위** | 0 ~ 1. 1에 가까울수록 단일 이슈 집중. 0에 가까울수록 분산. |
| **윈도우** | 7일 |
| **표기 라벨** | "이슈 집중도 · 7d · 테마 분포 HHI" |
| **UI 보조 표시** | 상위 3개 테마 share 함께 (예: "부동산 62% / 교통 18% / 청년 8%") |
| **주의** | "한 이슈만 다룬다"라는 평가가 아닌 분포 그 자체의 표현. UI 문구에서 가치 판단 금지. |

### 1.5 언론사 다양성 지수 (Source Diversity Index)

| 항목 | 내용 |
|---|---|
| **정의** | 정치인을 다룬 매체의 다양성. 한 매체에 집중 vs 여러 매체에 분산. |
| **산정식** | Shannon entropy `H = -Σ p_i * log(p_i)` of source share |
| `p_i` | source_i 기사 / total_articles |
| **범위** | 0 ~ log(매체 수). 정규화 시 0 ~ 1. |
| **윈도우** | 7일 |
| **표기 라벨** | "언론사 다양성 · 7d · 매체별 분포 엔트로피" |
| **UI 보조 표시** | distinct source count (예: "12개 매체") |

### 1.6 근거 기사 목록 (Source Articles)

| 항목 | 내용 |
|---|---|
| **정의** | 위 5개 지표의 기반이 된 기사 리스트 |
| **출처** | `article_mentions` JOIN `news_articles` (confidence ≥ 0.85) |
| **정렬** | 발행 시각 내림차순 |
| **표기** | 기사 제목 · 매체 · 발행 시각 · `ai_summary_flag` 있으면 "AI 요약" 배지 |
| **링크** | `news_articles.url` 외부 브라우저 |

---

## 2. 데이터 소스 3단계 로드맵

| 단계 | 소스 | 영향받는 지표 | 시기 |
|---|---|---|---|
| **1단계 (MVP)** | 빅카인즈 OPEN API | 전국 노출 (충분), 지역 노출 (제한적), 정책 키워드, 이슈 집중도, 매체 다양성 (충분) | 빅카인즈 승인 직후 |
| **2단계** | + 네이버 뉴스 검색 | 실시간성 향상, 빅카인즈 미수록 매체 보완 | 1단계 안정화 후 |
| **3단계** | + 지역 언론 RSS / 사이트 크롤 | **지역 노출 지수 정확도 대폭 향상**, 지역 정치 커버리지 | 9회 지방선거(2026.6) 전후 |

**3단계 지역 매체 수집 후보 (예시)**:
- 부산일보 RSS, 광주일보 RSS, 강원도민일보 RSS, 매일신문(대구), 영남일보, 한라일보(제주) 등
- 각 매체의 robots.txt / 이용약관 확인 후 진입
- RSS 미제공 매체는 사이트 검색 결과 페이지 파싱 (라이선스 검토 필요)

**저작권 라이선스**:
- 제목 + URL + 요약은 인용 범위.
- 본문 저장은 라이선스 별도 협의.
- AI 요약 사용 시 UI에 "AI 요약" 배지 의무.

---

## 3. 스키마 확장 (`0006_indicator_extensions.sql`)

### 3.1 신규 컬럼

```sql
-- sources 정규화 (3단계 RSS 대비)
create table sources (
  id                text primary key,            -- 'chosun', 'busan_ilbo' 같은 slug
  name              text not null,
  source_type       text not null,               -- 'national_press' | 'broadcast' | 'regional_press' | 'online'
  region_code       text,                        -- 지역지인 경우
  base_url          text,
  is_active         boolean default true
);

-- news_articles에 source_id 추가 (text source는 호환 유지)
alter table news_articles
  add column if not exists source_id text references sources(id);

create index na_source_id_idx on news_articles(source_id);
```

### 3.2 일배치 지표 테이블

```sql
create table politician_daily_indicators (
  politician_id            uuid not null references politicians(id) on delete cascade,
  date                     date not null,
  national_exposure        numeric default 0,
  regional_exposure        numeric default 0,
  policy_keyword_index     numeric default 0,
  issue_concentration_hhi  numeric default 0,
  source_diversity         numeric default 0,
  distinct_source_count    int default 0,
  top_themes_share         jsonb default '{}',   -- {"부동산": 0.62, "교통": 0.18, ...}
  computed_at              timestamptz default now(),
  primary key (politician_id, date)
);
```

`daily_metrics`는 그대로 유지(언급량 총량). `politician_daily_indicators`는 6대 지표 계산 결과 저장.

### 3.3 계산 함수

`0006_indicator_extensions.sql`에 다음 함수들이 정의됨:
- `compute_national_exposure(politician_id, date, window_days)`
- `compute_regional_exposure(politician_id, date, window_days)`
- `compute_policy_keyword_index(politician_id, date, window_days)`
- `compute_issue_concentration(politician_id, date, window_days)`
- `compute_source_diversity(politician_id, date, window_days)`
- `refresh_politician_daily_indicators(date)` — J4가 호출, 위 5개 일괄 실행

---

## 4. RPC 응답 확장

`get_politician_detail()` 응답에 `indicators` 필드 추가:

```jsonc
{
  "basis_label": "뉴스 언급량 기준",
  "as_of": "...",
  "data_mode": "live",
  "profile": { ... },
  "metrics": {
    "today_mention_count": 142,
    "mention_change": 38.2,
    "flow_14d": [...]
  },
  "indicators": {
    "national_exposure":      { "value": 184.2, "basis": "전국 매체 노출 가중", "window_days": 7 },
    "regional_exposure":      { "value":  12.4, "basis": "지역 매체 노출 가중", "window_days": 30 },
    "policy_keyword_index":   { "value":  18,   "basis": "30일 정책 키워드 연결 수", "top": ["부동산","재건축","세제"] },
    "issue_concentration":    { "value":   0.42, "basis": "테마 분포 HHI (7d)", "top_themes_share": { "부동산": 0.62, "교통": 0.18 } },
    "source_diversity":       { "value":   2.31, "basis": "매체 엔트로피 (7d)", "distinct_count": 12 }
  },
  "keywords": [...],
  "themes": [...],
  "related_articles": [...]
}
```

각 지표 객체에 `basis`(라벨)와 윈도우/상세를 동봉해 UI가 자동 라벨링 가능.

---

## 5. UI 적용 안 (Detail 화면)

```
┌───────────────────────────────────────────────────┐
│ [PERSON_TYPE]                                     │
│ {이름}                                            │
│ {정당 · 직책}                                     │
│ {지역구}                                          │
├───────────────────────────────────────────────────┤
│ 최근 흐름 · 14d · 뉴스 언급량 기준                │
│  오늘 언급      변화                              │
│   142          ▲ +38.2%                          │
│  ▁▁▂▂▃▃▄▄▅▆▆▇█  (스파크라인)                     │
├───────────────────────────────────────────────────┤
│ 지표 패널 · 7d · 자동 집계                        │  ← NEW
│ ┌─────────────┬─────────────┬─────────────┐      │
│ │ 전국 노출    │ 지역 노출    │ 정책 키워드   │      │
│ │  184.2      │   12.4      │   18        │      │
│ │  + 24%      │   −3%       │   +5         │      │
│ ├─────────────┼─────────────┼─────────────┤      │
│ │ 이슈 집중도  │ 매체 다양성   │             │      │
│ │  0.42       │   2.31      │             │      │
│ │ 부동산 62%   │   12개 매체   │             │      │
│ └─────────────┴─────────────┴─────────────┘      │
├───────────────────────────────────────────────────┤
│ 키워드 · 테마                                      │
│ [부동산] [재건축] [세제]                          │
├───────────────────────────────────────────────────┤
│ 근거 기사 · 8건 · 자동 집계                        │
│  ─ {제목} {매체} {시각}                           │
│  ─ ...                                            │
└───────────────────────────────────────────────────┘
```

- Bloomberg 다지표 패널 톤. 변화율은 amber 단색. 정당 색 매핑 금지.
- 각 지표 카드 하단에 작은 산정 기준 한 줄 (`tertiary text`).
- 영향력 인물(평론가/유튜버) 카드에서는 "지역 노출"이 의미 없으므로 숨김 or "—" 표시.

---

## 6. 구현 우선순위

| 우선 | 항목 | 단계 |
|---|---|---|
| **1차** | 전국 노출 / 정책 키워드 / 매체 다양성 / 이슈 집중도 | 빅카인즈 1단계만으로 충분히 동작 |
| **2차** | 지역 노출 (limited) | 빅카인즈 지역지 카테고리 활용 — 정확도 낮음 |
| **3차** | 지역 노출 (full) | 지역 RSS 수집 추가 후 정확도 본격 향상 |

내일 키 발급 후 1차부터 즉시 가동 가능.

---

## 7. 검증 필요 항목

1. 빅카인즈 응답에 매체 분류(전국/지역) 필드가 직접 있는지 → 매뉴얼 확인
2. 지역 매체의 `region_code` 매핑 규칙 (행정안전부 표준 코드 활용)
3. `extracted_keywords`에서 정책 키워드를 추려내는 정책 키워드 사전 필요 — `themes` 테이블 확장 또는 별도 `policy_keywords` 테이블
4. AI 요약 사용 시점에 빅카인즈 LAB 호출 비용 / 응답 시간 — 일배치 적합성 확인
