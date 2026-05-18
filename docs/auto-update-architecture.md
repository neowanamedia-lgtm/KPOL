# KPOL 자동 업데이트 아키텍처 설계

작성일: 2026-05-19
대상: 출시 후에도 사람이 개입하지 않고 자동 갱신되는 KPOL의 백엔드 구조
선행 문서: [`data-sources-report.md`](./data-sources-report.md)

---

## 0. 핵심 원칙

> **앱은 화면이고, 서버는 정치 데이터 엔진이다.**

| 레이어 | 역할 | 책임 없음 |
|---|---|---|
| **App (RN/Expo)** | 정리된 결과 표시 / 사용자 인터랙션 | 데이터 수집·계산·매핑·중복제거 ❌ |
| **API 레이어** | 앱이 쿼리하는 읽기 전용 엔드포인트 | 비즈니스 로직 ❌ |
| **DB (Postgres)** | 적재된 사실 + 집계 결과 | — |
| **Worker (배치)** | 수집·매핑·요약·집계 | 사용자 요청 처리 ❌ |
| **외부 소스** | 선관위 / 국회 / 빅카인즈 / 네이버 | — |

이 분리가 깨지면 (예: 앱이 직접 빅카인즈를 호출) 라이선스·키 노출·속도·일관성 모두 위협 받는다.

---

## 1. 시스템 다이어그램

```text
   ┌─────────────────────────────────────────────────────────────────────┐
   │                          KPOL Mobile App                            │
   │   - Home / Search / Detail / Settings                               │
   │   - "마지막 업데이트: 2026.05.19 03:20" 표시                          │
   │   - 모든 수치 옆에 "뉴스 언급량 기준 · 자동 집계" 라벨                │
   │   - 근거 기사 보기 (탭 → 외부 브라우저)                              │
   └────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / JSON
                                    ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │                  Read API (Supabase REST / RPC)                     │
   │   - get_home_feed()                                                 │
   │   - get_politician_detail(id)                                       │
   │   - get_ranking(type, date)                                         │
   │   - get_search_results(query, filter)                               │
   │   - get_last_update_status()                                        │
   │   - 모두 RLS로 read-only                                            │
   └────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL
                                    ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │                       Postgres (Supabase)                           │
   │   politicians · parties · politician_positions                      │
   │   news_articles · article_mentions · article_themes                 │
   │   themes · daily_metrics · daily_theme_metrics                      │
   │   rankings · ranking_entries                                        │
   │   update_logs                                                       │
   └────────────────────────────────┬────────────────────────────────────┘
                                    ▲
                                    │ INSERT / UPSERT
                                    │
   ┌────────────────────────────────┴────────────────────────────────────┐
   │              Workers (Supabase Edge Functions / pg_cron)            │
   │                                                                     │
   │   ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌─────────────┐       │
   │   │ profile   │  │ news      │  │ mapping  │  │ aggregate   │       │
   │   │ sync      │→ │ ingest    │→ │ engine   │→ │ + rankings  │       │
   │   └───────────┘  └───────────┘  └──────────┘  └─────────────┘       │
   │      매주 1회      6시간 1회      ingest 후      ingest 후            │
   │                                                                     │
   │   ┌───────────────────────────────────────────────────────────┐     │
   │   │  update_logs: 모든 단계의 시작/종료/오류 기록 (감사 추적)  │     │
   │   └───────────────────────────────────────────────────────────┘     │
   └────────────────────────────────┬────────────────────────────────────┘
                                    │ Outbound HTTPS
                                    ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │                       External Data Sources                         │
   │   선관위 API · 국회 OpenAPI · 빅카인즈 OPEN API · 네이버 검색 API     │
   │   빅카인즈 LAB (NER / 요약 / 키워드)                                  │
   └─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 배치 잡 카탈로그

배치는 4개의 독립 잡으로 분리한다. 의존 관계가 있는 것끼리만 직렬화하고, 나머지는 병렬 실행한다.

| 잡 ID | 이름 | 주기 (MVP) | 주기 (고도화) | 의존 |
|---|---|---|---|---|
| `J1` | profile_sync | 주 1회 (월 03:00) | 일 1회 | 없음 |
| `J2` | news_ingest | 6시간마다 | 1시간마다 → 15분 | J1 (정치인 명단 필요) |
| `J3` | mapping_engine | J2 직후 | J2 직후 | J2 |
| `J4` | aggregate_and_rank | J3 직후 (일 1회 결산) | J3 직후 매번 | J3 |

### 2.1 J1 — profile_sync

목적: 선관위 + 국회 API에서 인물 프로필 동기화.

- 22대 국회의원 / 8회 광역단체장 명단 갱신
- 직책 변경 / 정당 이동 / 사임 / 의원직 상실 반영 → `politician_positions`에 새 row 추가, 기존 row의 `end_date` 채움
- 정당 합당·분당 이벤트 반영 → `parties`
- **영향력 인물(평론가/유튜버 등)은 수동 입력만 가능** — 별도 잡 없음. 관리자 화면에서 등록.

### 2.2 J2 — news_ingest

목적: 빅카인즈 + 네이버 검색에서 신규 기사 수집.

- 정치인별로 쿼리: `name` + (의원/시장/도지사 등 직책 키워드) — 동명이인 노이즈 1차 차단
- 영향력 인물별로 쿼리: `name` + `affiliation` (채널/매체명) 결합
- `news_articles`에 INSERT … ON CONFLICT (url normalized) DO NOTHING
- 수집 윈도우: 직전 잡 종료 시각 ~ 현재. 첫 실행 또는 잡 누락 시 윈도우를 자동 확장
- 본문은 빅카인즈에서 제공되는 만큼만 저장 (저작권 안전 — 보통 메타 + 요약)

### 2.3 J3 — mapping_engine

목적: 자동 매핑.

- 빅카인즈 LAB `get_ner`로 신규 기사에서 인물 엔티티 추출
- 추출 결과를 `politicians.name` / `aliases`와 매칭
- 동명이인 후보가 둘 이상이면 직책·지역·정당 키워드로 가중치 산정
- `confidence >= 0.85` → 자동 확정 / `0.5 ≤ confidence < 0.85` → `reviewed_at IS NULL`로 둠 → 관리자 검수 큐
- `article_themes` 자동 태깅: 키워드 → 사전 매핑된 theme_id

### 2.4 J4 — aggregate_and_rank

목적: 일배치 집계 + 랭킹 스냅샷.

- `daily_mention_metrics` (politician × date) 갱신
- `daily_theme_metrics` (theme × date) 갱신
- `rankings`에 새 행 + `ranking_entries`에 순위 항목 (다축 랭킹: 오늘의 관심도 상승 / 주간 언급량 / 정책 연결 등)
- 변화율은 view로 계산:
  ```sql
  CREATE VIEW v_politician_change AS
  SELECT
    politician_id,
    date,
    mention_count,
    LAG(mention_count, 1) OVER w AS prev_day,
    AVG(mention_count) OVER (PARTITION BY politician_id ORDER BY date ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS week_avg
  FROM daily_mention_metrics
  WINDOW w AS (PARTITION BY politician_id ORDER BY date);
  ```

---

## 3. 업데이트 주기 단계별 로드맵

| 단계 | 주기 | 트리거 | 비고 |
|---|---|---|---|
| **MVP** | 일 1회 / 6시간 1회 | pg_cron | 부담 적음, 데모/검증 단계 |
| **출시 직후** | 6시간 1회 | pg_cron | 안정성 확보 후 |
| **고도화 1단계** | 1시간 1회 | pg_cron + outbox | 빅카인즈 쿼터 모니터링 필수 |
| **고도화 2단계** | 15분 (준실시간) | 전용 워커 큐 (Supabase Functions 또는 외부 Cloud Run) | 키 발급 한도 / 비용 검토 |
| **수동 트리거** | 모든 단계 공통 | 관리자 화면 버튼 → admin RPC | 주요 이슈 발생 시 |

> 단계 사이에 데이터 모델은 변경되지 않는다. 같은 테이블 구조에서 잡 주기만 단축. 이게 안 깨지도록 잡은 idempotent하게 작성.

---

## 4. 핵심 테이블 (사용자 지정 8종 + 보조)

```text
-- (1) 인물 / 정당 / 직책 이력
politicians                  (사용자 지정 ①)
politician_positions         (직책·정당·선거구 이력 — politicians을 시간 기반으로 보강)
politician_affiliations      (영향력 인물의 채널/매체 — 별도 테이블)
parties                      (사용자 지정 ②)

-- (2) 뉴스 원천 + 매핑
news_articles                (사용자 지정 ③)
article_mentions             (사용자 지정 ④ — politician × article)
article_themes               (theme × article)

-- (3) 분류
themes                       (사용자 지정 ⑤)

-- (4) 집계
daily_metrics                (사용자 지정 ⑥ — politician × date)
daily_theme_metrics          (theme × date — 옵션)

-- (5) 랭킹 스냅샷
rankings                     (사용자 지정 ⑦ — 랭킹 메타)
ranking_entries              (rankings의 항목들 — 순위 행)

-- (6) 운영
update_logs                  (사용자 지정 ⑧)
```

### 4.1 `rankings` / `ranking_entries`

다축 랭킹 (`kpol-prohibitions` 메모리의 "단일 인기 순위 금지" 원칙 준수):

```sql
rankings (
  id uuid PK,
  ranking_type text NOT NULL,   -- 'today_surge' | 'weekly_mention' |
                                -- 'policy_connection' | 'theme_surge' | ...
  scope text NOT NULL,           -- 'all' | 'elected' | 'influence' | 'theme:realestate'
  computed_at timestamptz NOT NULL,
  basis_label text NOT NULL,     -- "뉴스 언급량 기준" 같은 UI 라벨
  source_window_start timestamptz,
  source_window_end timestamptz
)

ranking_entries (
  ranking_id uuid FK,
  rank int NOT NULL,
  politician_id uuid FK (nullable),  -- 인물 랭킹용
  theme_id text FK (nullable),       -- 테마 랭킹용
  metric_value numeric NOT NULL,
  metric_change numeric,             -- nullable
  PRIMARY KEY (ranking_id, rank)
)
```

랭킹은 매 배치마다 새 스냅샷으로 저장 → 시계열 보존(과거 어느 시점의 1위가 누구였는지 추적 가능).

### 4.2 `update_logs`

감사 추적 + 앱의 "마지막 업데이트" 표시 출처.

```sql
update_logs (
  id uuid PK,
  job_id text NOT NULL,            -- 'J1' | 'J2' | 'J3' | 'J4' | 'manual:...'
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL,            -- 'running' | 'success' | 'failed' | 'partial'
  articles_processed int,
  mentions_added int,
  errors_count int,
  error_summary text,
  triggered_by text                -- 'cron' | 'manual:<user>'
)
```

앱이 호출하는 `get_last_update_status()`는 `MAX(finished_at) WHERE status='success' AND job_id='J4'`로 도출.

---

## 5. 앱 ↔ 백엔드 계약

### 5.1 앱이 호출하는 read 엔드포인트 (Supabase RPC 권장)

| RPC | 반환 | 캐시 정책 |
|---|---|---|
| `get_last_update_status()` | `{ last_success_at, basis_label, age_label }` | SWR 30s |
| `get_home_feed()` | `{ today_summary, surge_politicians, top_mentioned, theme_surge, influence_flow, watchlist }` | SWR 60s |
| `get_politician_detail(id)` | `{ profile, flow_14d, keywords, themes, related_articles }` | SWR 120s |
| `get_ranking(type, scope)` | `{ ranking_meta, entries[] }` | SWR 60s |
| `get_search_results(query, person_type)` | `{ results[] }` | no-cache |
| `get_article_mentions(politician_id, limit)` | `{ articles[] }` | SWR 120s |

> 모든 RPC 응답에 `basis_label` (예: "뉴스 언급량 기준") + `as_of` (집계 시각)을 포함시켜 UI가 항상 출처 라벨을 박을 수 있게 한다.

### 5.2 앱 표시 컨트랙트

| UI 요소 | 데이터 소스 | 처리 |
|---|---|---|
| "마지막 업데이트: 2026.05.19 03:20" | `get_last_update_status().last_success_at` | 헤더 또는 푸터 고정 |
| 모든 수치 옆 "뉴스 언급량 기준" | `basis_label` | 자동 표시 |
| "자동 집계" 라벨 | (상수) | 설정 또는 면책 섹션 |
| "근거 기사 보기" 버튼 | `get_article_mentions()` → 외부 URL | `Linking.openURL` |
| "DEMO DATA" 라벨 | `get_last_update_status().age_label` 가 `'no_data'`일 때 표시 | Fake → 실 데이터 전환 신호 |

→ 앱은 빌드 시점에 어떤 데이터가 들어올지 알 필요가 없다. `basis_label`을 신뢰하고 그대로 표시.

---

## 6. 백엔드 기술 선택

### 6.1 Supabase (권장 — MVP)

| 요소 | Supabase 제공 |
|---|---|
| DB | Managed Postgres |
| API | PostgREST 자동 생성 + RPC |
| Auth/RLS | 읽기 전용 정책으로 앱 차단 |
| Scheduler | `pg_cron` extension |
| Workers | Edge Functions (Deno) — HTTP 트리거 / cron 가능 |
| Secrets | Vault (환경 변수) — 빅카인즈/네이버 키 보관 |
| 로그 | Edge Function 로그 + `update_logs` 테이블 |

장점: 단일 콘솔, 인증·DB·잡 통합. 무료 티어로 MVP 검증 가능.
단점: 1시간 미만 주기 / 무거운 NLP 처리는 Edge Function timeout(현재 약 150초)에 걸릴 수 있음 → 고도화 단계에서 외부 워커 고려.

### 6.2 자체 API 서버 (고도화 단계)

준실시간 단계로 가면:
- **Cloud Run / Lambda** + 큐(EventBridge / Pub/Sub) 조합으로 J2/J3를 분리·병렬화
- DB는 Supabase Postgres 그대로 유지 (외부에서 접속) 또는 별도 Postgres로 이관
- 앱은 변함 없음 (같은 RPC를 호출)

**핵심: 이행 시 앱은 손대지 않는다.** RPC 시그니처가 같으면 백엔드 내부 구조 변경은 투명.

---

## 7. 운영 가드레일

| 항목 | 가드레일 |
|---|---|
| API 쿼터 초과 | 잡 안에 토큰 버킷 + `update_logs.status='partial'` 기록 |
| 빅카인즈 다운 | 네이버로 fallback. `error_summary`에 명시 |
| 중복 기사 | URL 정규화 → unique index. ON CONFLICT DO NOTHING |
| NER 오매핑 | `confidence < 0.85` → 검수 큐 (관리자 화면) |
| 잡 누락 | 다음 잡이 윈도우 자동 확장 (last_success_at 기준) |
| 라이선스 | 본문은 저장 최소화, 제목·URL·요약만 노출. AI 요약은 `ai_summary_flag=true` 표시 |
| 선거 기간 | 별도 정책 토글 (예: 변화율 표시 일시 정지) — `system_settings` 테이블 검토 |

---

## 8. 마이그레이션 경로 (현재 Fake Data → 자동 업데이트)

1. **Phase A (현재 상태)** — Fake Data 13명 + RN UI. 백엔드 0.
2. **Phase B** — Supabase 프로젝트 생성 + 스키마 적용 + 인증 키 발급 완료. 앱은 여전히 fake.
3. **Phase C** — J1 (profile_sync) 실행, `politicians` 적재. 앱이 `get_politician_detail` RPC를 사용하도록 어댑터만 교체 (UI 무변경).
4. **Phase D** — J2/J3 실행, news + mention 적재. 앱이 `get_article_mentions` 호출.
5. **Phase E** — J4 실행, daily_metrics + rankings 적재. 홈 화면이 RPC 기반으로 전환.
6. **Phase F** — Fake Data 코드 제거. `src/data/fake*.ts` 삭제 또는 `__tests__`로 이관.

Phase B~E는 앱 UI를 건드리지 않고 진행 가능 — 화면은 그대로, 어댑터 레이어만 fake → RPC로 스위치. 이게 가능하려면 현재 코드의 데이터 접근을 한 곳(예: `src/services/`)으로 모아두는 사전 정리가 필요. **이 정리는 다음 작업 후보**.

---

## 9. 권장 다음 작업 순서

1. **백엔드 사전 작업** (사용자 직접)
   - Supabase 프로젝트 생성
   - data.go.kr 가입 + 선관위 4개 API + 국회 통합 API 활용신청 → 인증키
   - 빅카인즈 OPEN API 신청서 제출 (승인까지 시간 가장 김 — 가장 먼저)
   - 네이버 개발자 등록
2. **앱 코드 정리** (다음 코드 작업)
   - `src/services/` 안에 데이터 접근 어댑터 인터페이스 정의 (`PoliticianRepository`, `MetricsRepository`)
   - 현재 `src/data/fake*` 를 어댑터의 한 구현체로 격리
   - 추후 Supabase RPC 구현체를 같은 인터페이스로 추가
3. **백엔드 스키마 마이그레이션** 작성 (SQL)
4. **J1 (profile_sync)** 작성 + Supabase Edge Function 배포
5. **J2~J4** 단계적 배포

---

## 10. 요약 한 줄

> KPOL = (외부 데이터) → (서버 배치 4개 잡) → (Postgres 11개 테이블) → (Supabase RPC) → (앱 RN/Expo).
> 앱은 화면이고, 서버는 정치 데이터 엔진이다. 잡 주기는 1일/6h부터 시작해 같은 모델에서 1h → 준실시간으로 단축 가능.
