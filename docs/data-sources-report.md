# KPOL 데이터 소스 조사 보고서

작성일: 2026-05-19
대상: KPOL 인물 DB + 뉴스 흐름 계산 레이어의 실 데이터 소스 검증

---

## 0. 결론 요약 (TL;DR)

| 레이어 | 1차 소스 (권장) | 보완 소스 | 비용 / 신청 |
|---|---|---|---|
| **인물 프로필** | 선관위 후보자/당선인 API (data.go.kr) | 국회 열린국회정보 OpenAPI (의원 정보) | 무료 · 활용신청 후 인증키 |
| **선거구 / 정당 코드** | 선관위 코드정보 API | — | 무료 · 인증키 |
| **의정 활동** | 국회 OpenAPI (의안 / 표결 / 발의 / 위원회) | — | 무료 · 인증키 |
| **뉴스 흐름** | 빅카인즈(BIGKinds) OPEN API | 네이버 뉴스 검색 API (보완) | 빅카인즈: 신청 승인 후 발급 / 네이버: 무료 25,000회/일 |
| **NLP (요약/키워드/NER)** | 빅카인즈 LAB API (MIT) | 자체 모델 | 무료 / 오픈소스 |
| **영향력 인물** | (공공 API 없음) — 수동 큐레이션 + 빅카인즈로 언급량 흐름 | — | 수동 |

**핵심 판단**: 선출직(국회의원 / 광역단체장 / 후보자)은 공공데이터로 프로필을 거의 다 충족할 수 있다. 정치 유튜버 / 평론가 / 플랫폼 운영자는 공공 API에 메타데이터가 없으므로 **수동 큐레이션 + 채널 URL / 출처 명시**로 시작하고, 그들의 "흐름"은 빅카인즈 뉴스 언급량에 의존한다.

---

## 1. 사용 가능한 API 카탈로그

### 1.1 중앙선거관리위원회 — 공공데이터포털(data.go.kr) 경유

| 데이터셋 | 엔드포인트 (data.go.kr) | 주요 제공 정보 | KPOL 활용처 |
|---|---|---|---|
| **후보자 정보** | `15000908` | 성명, 생년월일, 성별, 선거구, 학력, 경력, 등록 상태, 정당 | `politicians` 프로필 기초 |
| **당선인 정보** | `15000864` | 선거ID·선거종류코드 입력 → 당선인 명단, 정당, 선거구 | 22대 국회의원·8회 광역단체장 명단 |
| **투·개표 정보** | `15000900` | 선거구별 득표수, 경합 결과 | (옵션) 인물 상세에 "당선 정보" 섹션 |
| **코드 정보** | `15000897` | 선거ID, 선거종류코드, 선거명, 선거구 코드 | 다른 API 호출용 기초 코드 |

- **제공 범위**: 대통령선거 13~21대 / 국회의원선거 14~22대 / 전국동시지방선거 3~8회 / 2010년 이후 재보궐
- **인증**: data.go.kr 회원가입 → 각 API별 "활용신청" → 인증키 발급
- **포맷**: REST API, XML/JSON
- **별도 포털**: 선관위 국가선거정보 개방포털(data.nec.go.kr)에도 같은 데이터 일부가 제공됨
- **데이터 시점**: 선거 종료 후 약 2개월 검증 후 공개. 즉, **현재 임기 중인 인물의 상태(직책 변경, 사망, 의원직 상실 등)는 반영되지 않음** → 국회 OpenAPI로 보강 필요

### 1.2 국회사무처 — 열린국회정보 OpenAPI

| 항목 | 상세 |
|---|---|
| **포털** | https://open.assembly.go.kr |
| **공공데이터포털 통합 ID** | `15125891` (OPEN API 전체 현황), `15126133` (국회의원 정보 통합 API) |
| **인증** | 회원가입 → 인증키 신청 |
| **포맷** | XML (기본) / JSON 일부 |
| **비용** | 무료, 실시간 업데이트 |
| **대표 API** | 의안정보 통합, 본회의 표결정보, 발의법률안, 의안 접수목록, 위원회 정보, 국회의원 정보 통합 |
| **확인되지 않은 항목** | 일일 호출 제한, 의원 프로필 상세 필드 명세 — 공식 PDF(`오픈API활용가이드_국회사무처.pdf`) 확인 필요 |
| **문의처** | 02-6788-3853 / webmaster@assembly.go.kr |

> 의원 프로필의 정확한 필드 목록은 공식 활용가이드 PDF에서 확인해야 한다. 통상 의원실 사이트에는 사진·이력·선거구·소속위원회·소속정당이 있으므로 같은 수준이 API에도 있을 가능성이 크다 — **검증 필요**.

### 1.3 빅카인즈(BIGKinds) — 한국언론진흥재단

뉴스 본문/메타데이터의 1차 소스. 정치 흐름 계산의 핵심.

| 항목 | 상세 |
|---|---|
| **운영** | 한국언론진흥재단 |
| **수록 매체** | 104개 주요 신문·방송 (현재 사용자 매뉴얼 기준) |
| **인증** | OPEN API 사용신청서(HWP) → 구글폼 제출 → 사업단 승인 → 매뉴얼·키 이메일 발급 |
| **공공데이터포털 연계** | RestAPI, JSON/XML |
| **비용/라이선스** | 학술/상업 구분은 신청서에서 결정. **상업 사용은 별도 협의 가능성** → 신청 단계에서 KPOL의 성격(영리 서비스 가능성)을 명시하고 확인 필요 |
| **사용 기간** | 최근 공지 기준 1년 단위 갱신 (2025.10.17 ~ 2026.10.17 사이클) |
| **AI 강화** | 최근 개편으로 AI 요약·멀티턴 분석 기능 추가 (KPOL의 "AI 요약" 표시 정책과 호환) |
| **정치면 분석** | 월별 정치 뉴스 고빈도 명사 추출 등 정량 데이터 제공 |
| **공개 데이터 파일** | 일부 데이터는 data.go.kr에서 파일 형식으로 별도 공개 (예: `15065411` 정치면 고빈도 명사) |

### 1.4 빅카인즈 LAB — 오픈소스 NLP API

| API | 엔드포인트 | 용도 |
|---|---|---|
| 뉴스 분류 (KPF-BERT-CLS) | `http://api2.bigkindslab.or.kr:5002/get_cls` | 기사 카테고리 자동분류 |
| 개체명 인식 (KPF-BERT-NER) | `http://api2.bigkindslab.or.kr:5002/get_ner` | 기사에서 정치인 이름 추출 |
| 기사 요약 (KPF-BERTSum) | `http://api.bigkindslab.or.kr:5002/get_summary` | 근거 기사 AI 요약 |
| 키워드 추출 (KPF-KeyBERT) | `http://api.bigkindslab.or.kr:5002/get_keyword` | 키워드 자동 추출 |
| 형태소 분석 | `http://api.bigkindslab.or.kr:5002/get_tag` | 토큰화 |

- **라이선스**: MIT (오픈소스)
- **호출**: POST + JSON (`text` 또는 `sentences` 필드)
- **주의**: HTTP 엔드포인트 (HTTPS 아님) — 프로덕션 사용 시 자체 호스팅 검토. 모델 가중치는 공개되어 있어 자체 배포 가능
- **활용처**: KPOL의 **정치인 매핑 엔진 / 키워드 추출 엔진 / 기사 요약** 모듈 1차 후보

### 1.5 네이버 뉴스 검색 API

| 항목 | 상세 |
|---|---|
| **엔드포인트** | `https://openapi.naver.com/v1/search/news.json` |
| **인증** | 네이버 개발자 등록 후 Client ID / Secret |
| **일일 한도** | 25,000회/일 (다른 검색 API 공통) |
| **초당 한도** | 10~100회/초 (API별 상이) |
| **반환 필드** | title, originallink, link, description, pubDate |
| **약점** | 정치 분석용 정량 도구가 아님. 검색 결과 상위 1000건 한정 (페이지네이션). 본문 미제공 → 제목+요약(description) 기준 분석만 가능 |
| **상업 사용** | 라이선스 약관 확인 필요 (검색결과 재배포 제약) |

→ KPOL에서는 **빅카인즈 보완용 / Fallback**으로 사용. 단독으로 흐름 계산하기엔 표본·필드가 부족.

### 1.6 기타 공공데이터 (확장 후순위)

- **국가법령정보센터 OpenAPI** — 법률안 본문/제·개정 이력
- **국회입법조사처** — 정량 보고서 (API 미확인)
- **선관위 정치자금 회계보고** — 정당 운영비, 후원금 (HTML 위주, API 여부 불확실)
- **공공데이터포털 "중앙선거관리위원회 검색" 결과 카탈로그** — 위 표 외에도 다수 (재산공개, 공약 등 일부 데이터셋 존재 가능)

---

## 2. KPOL 필드 매핑

### 2.1 `politicians` 테이블 (인물 프로필)

| KPOL 필드 | 1차 소스 API | 비고 |
|---|---|---|
| `id` | (자체 발급) | UUID |
| `name` (한글) | 선관위 후보자/당선인 + 국회 의원정보 | |
| `name_normalized` | (자체 처리) | 검색용 normalize |
| `aliases[]` | (수동 보강) | 한자, 영문, 별칭 |
| `personType` | (자체 분류) | enum: 선출직/지도부/지역/평론가/유튜버/플랫폼/인플루언서 |
| `birth_year` | 선관위 후보자 (생년월일) | |
| `gender` | 선관위 후보자 (성별) | |
| `national_assembly_term` | 선관위 당선인 (선거ID로 도출) + 국회 의원정보 | 예: 22 |
| `district` (선거구) | 선관위 + 국회 | 한글 명칭 |
| `district_code` | 선관위 코드정보 API | 외부 식별자 |
| `election_count` (선수) | (선관위 당선인 이력 누적) | n선 |
| `region_code` | 선관위 + 행정안전부 행정구역 코드 | 광역단체장용 |
| `current_party_id` | 선관위(당선 당시) + 국회(현재) | **변동성 큼** — 시계열 추적 권장 |
| `current_position` | 국회 / 선관위 / 수동 | 의원/시장/도지사 등 |
| `position_start_date` / `end_date` | 자체 관리 (이벤트 기반) | |
| `profile_image_url` | 국회 의원정보 (예상) | 의원실 사진 / 별도 호스팅 검토 |
| `career_summary` | 선관위 후보자(경력) + 수동 보강 | |
| `education` | 선관위 후보자(학력) | |
| `external_ids` | 선관위 후보자 ID, 국회 의원 ID | 매칭용 |
| `is_active` | (자체 관리) | 의원직 유지 여부 |
| `source_origin` | enum: `nec` / `assembly` / `manual` | 출처 표기 |

### 2.2 영향력 인물 추가 필드

| KPOL 필드 | 1차 소스 | 비고 |
|---|---|---|
| `channel_name` | (수동) | 예: 유튜브 채널명 |
| `channel_url` | (수동) | 검증 가능 URL |
| `outlet_name` | (수동) | 매체명 |
| `outlet_type` | (자체 분류) | 칼럼/방송/SNS 등 |

→ **공공 API에 없음**. 수동 큐레이션 + 채널/매체의 공개 메타데이터(설명문, 운영자 명의)로만 보강 가능. KPOL의 **관리자 검수 화면**에서 등록·갱신.

### 2.3 `parties` 테이블

| 필드 | 소스 |
|---|---|
| `id`, `name`, `short_name` | 선관위 + 수동 |
| `founded_date`, `dissolved_date` | (수동) |
| `predecessor_party_id` | (수동) — 합당/분당 이력 |
| `status` | active / merged / dissolved |

→ **선관위 코드정보 API가 시점별 정당 코드**를 제공할 가능성 큼. 검증 필요.

### 2.4 `articles` 테이블 (뉴스)

| KPOL 필드 | 1차 소스 |
|---|---|
| `external_id` | 빅카인즈 기사 ID |
| `title` | 빅카인즈 / 네이버 |
| `source` (언론사) | 빅카인즈 / 네이버 |
| `published_at` | 빅카인즈 / 네이버 (`pubDate`) |
| `url` | 빅카인즈 / 네이버 (`originallink`) |
| `summary` | 빅카인즈 LAB `get_summary` (AI 요약 — UI에 "AI 요약" 표시) |
| `extracted_keywords[]` | 빅카인즈 LAB `get_keyword` |
| `extracted_entities[]` | 빅카인즈 LAB `get_ner` |
| `category` | 빅카인즈 LAB `get_cls` |
| `collected_at` | (자체) |

### 2.5 `article_politician_mentions` 매핑 테이블

| 필드 | 설명 |
|---|---|
| `article_id` | FK |
| `politician_id` | FK |
| `confidence` | 자동 매핑 신뢰도 (0~1) |
| `matched_by` | NER 결과 / 별칭 매칭 / 수동 |
| `reviewed_at` | 관리자 검수 시각 |
| `reviewed_by` | 검수자 |

→ 동명이인 대응 위해 직책·지역·정당 키워드를 보조 매칭 신호로 사용.

### 2.6 `daily_mention_metrics` 집계 테이블

| 필드 | 설명 |
|---|---|
| `politician_id` | FK |
| `date` | 일자 |
| `mention_count` | 당일 매핑 기사 수 |
| `source_count` | 당일 매핑 매체 수 (다양성 지표) |
| `theme_distribution` | JSON (테마ID → 건수) |

→ 변화율은 VIEW 또는 application-level 계산 (전일 대비 / 7일 평균 대비).
→ KPOL UI의 "뉴스 언급량 기준" 라벨은 이 테이블에 직접 연결되어야 한다.

---

## 3. 초기 DB 스키마 안

```text
politicians (
  id uuid PK,
  name text NOT NULL,
  name_normalized text NOT NULL,
  aliases jsonb,
  person_type text NOT NULL,        -- enum 7종
  birth_year int,
  gender text,
  profile_image_url text,
  career_summary text,
  education text,
  external_nec_id text,
  external_assembly_id text,
  is_active boolean DEFAULT true,
  source_origin text NOT NULL,
  created_at timestamptz,
  updated_at timestamptz
)

politician_positions (
  id uuid PK,
  politician_id uuid FK -> politicians,
  party_id uuid FK -> parties (nullable),
  position text NOT NULL,            -- 의원/시장/도지사/평론가 등
  national_assembly_term int,
  district text,
  district_code text,
  region_code text,
  election_count int,
  start_date date NOT NULL,
  end_date date,
  source_origin text,
  notes text
)

politician_affiliations (         -- 영향력 인물 전용
  id uuid PK,
  politician_id uuid FK,
  channel_name text,
  channel_url text,
  outlet_name text,
  outlet_type text,
  start_date date,
  end_date date,
  verified_at timestamptz
)

parties (
  id uuid PK,
  name text NOT NULL,
  short_name text,
  founded_date date,
  dissolved_date date,
  predecessor_party_id uuid,
  status text             -- active/merged/dissolved
)

themes (
  id text PK,             -- 'realestate', 'ai_tech', ...
  name_ko text NOT NULL,
  description text
)

articles (
  id uuid PK,
  external_id text,
  source_provider text,    -- 'bigkinds' / 'naver' / ...
  title text NOT NULL,
  source text NOT NULL,    -- 언론사명
  published_at timestamptz NOT NULL,
  url text NOT NULL,
  summary text,            -- AI 요약일 경우 ai_summary_flag = true
  ai_summary_flag boolean DEFAULT false,
  category text,
  collected_at timestamptz
)

article_politician_mentions (
  article_id uuid FK,
  politician_id uuid FK,
  confidence numeric,
  matched_by text,         -- ner/alias/manual
  reviewed_at timestamptz,
  reviewed_by text,
  PRIMARY KEY (article_id, politician_id)
)

article_themes (
  article_id uuid FK,
  theme_id text FK,
  PRIMARY KEY (article_id, theme_id)
)

daily_mention_metrics (
  politician_id uuid FK,
  date date,
  mention_count int,
  source_count int,
  theme_distribution jsonb,
  PRIMARY KEY (politician_id, date)
)

daily_theme_metrics (
  theme_id text FK,
  date date,
  mention_count int,
  PRIMARY KEY (theme_id, date)
)
```

**시간 기반 분리 설계**: `politician_positions` / `politician_affiliations`를 별도 테이블로 분리해 "이재명: 더불어민주당 → 무소속 → ..." 같은 이력 변화를 손실 없이 추적할 수 있게 한다. UI 표시용 "현재 직책"은 종료일 NULL인 행으로 도출.

**근거 추적 의무**: KPOL의 데이터 원칙에 따라 모든 `daily_mention_metrics` 행은 `article_politician_mentions`로 역추적 가능해야 한다.

---

## 4. 뉴스 검색 연결 방식 후보

| 방식 | 장점 | 단점 | KPOL 적합도 |
|---|---|---|---|
| **A. 빅카인즈 단독** | 정치 분석 전용 메타데이터, 매체 다양성, 카테고리/AI 요약 | 신청 승인 필요, 상업 사용 별도 협의 가능성, 사용 기간 갱신 | ⭐⭐⭐⭐ |
| **B. 네이버 검색 단독** | 즉시 신청 가능, 무료, 일 25k | 본문 없음, 분석 메타데이터 빈약, 결과 상한 1000 | ⭐⭐ |
| **C. 빅카인즈 + 네이버 보완** | A 한계를 B로 보완, 매체 커버리지 ↑ | 운영 복잡도 ↑, 중복 처리 필요 | ⭐⭐⭐⭐⭐ |
| **D. 자체 크롤링** | 무제한 | 법적 리스크(저작권/이용약관), 운영 부담 | ⭐ (권장 안 함) |

**권장**: C — 빅카인즈를 1차 (분석 깊이) + 네이버를 보완 (실시간 폭). 두 소스에서 동일 기사가 중복되면 `external_id` 또는 `url` 정규화로 제거.

**파이프라인 안**:
```
[빅카인즈 API] ──┐
                 ├─→ articles 적재 (URL 기반 dedupe)
[네이버 API]   ──┘
        │
        ▼
[빅카인즈 LAB NER]  → article_politician_mentions (자동 매핑)
                       │
                       ▼
                  관리자 검수 (낮은 confidence)
                       │
                       ▼
              daily_mention_metrics 일배치
```

---

## 5. 신청·라이선스 절차 체크리스트

| 항목 | 절차 | 소요 |
|---|---|---|
| data.go.kr 회원가입 | 본인인증 | 즉시 |
| 선관위 4개 API 활용신청 | 각 API 페이지에서 신청 | 자동승인 (대부분) |
| 국회 OpenAPI 인증키 | 열린국회정보 포털에서 신청 | 보통 즉시 |
| 빅카인즈 OPEN API | HWP 신청서 작성 → 구글폼 제출 → 사업단 승인 | 영업일 수일~수주 |
| 네이버 개발자 등록 | developers.naver.com 가입 → 앱 등록 | 즉시 |
| 빅카인즈 LAB | 별도 신청 불필요 (오픈소스) | — |

**확인 필요한 라이선스 / 리스크 항목**:
1. **빅카인즈 상업 사용** — 신청서에 "상업 서비스 의도" 명시 후 승인 받기 (한국언론진흥재단 사업단 확인)
2. **네이버 검색 결과 재배포** — 약관 점검. 통상 검색 결과 대량 저장·재배포 제약 존재
3. **뉴스 저작권** — 제목 + 요약 + URL 표시는 일반적으로 인용 범위 / 본문 저장 시 별도 라이선스 필요
4. **선거기간 특별 정책** — 선관위 데이터를 선거기간에 사용할 때의 공직선거법 제108조(여론조사 결과 공표 제한) 등 확인

---

## 6. 검증 필요 항목 (Open Questions)

다음 항목은 본 보고서 시점에서 100% 확정되지 않은 상태이므로 실 구현 진입 전 검증 필요.

1. **국회 OpenAPI 의원정보 필드 명세** — 사진/위원회/약력 필드가 실제로 어떤 키로 제공되는지 PDF 가이드 확인
2. **빅카인즈 OPEN API 엔드포인트 / 필드 / 쿼터** — 신청서 제출 후 받는 매뉴얼에서 확인 (외부 공개 문서가 제한적)
3. **빅카인즈 상업 사용 가능 범위** — 신청 단계에서 사업단과 직접 확인
4. **선관위 코드정보 API의 시점별 정당 코드** — 합당/분당 이력이 코드 단위로 보존되는지 확인
5. **국회 의원의 의원직 상실/이력 변경 반영 속도** — open.assembly.go.kr가 실시간이라 하지만 실제 지연 시간 확인
6. **광역단체장 데이터의 임기 종료 후 갱신 시점** — 8회(~2026.6) ↔ 9회(2026.6~) 전환 시 데이터 가용성

---

## 7. 권장 다음 단계

1. **계정/신청 사전 작업** (사용자 직접)
   - data.go.kr 회원가입 및 선관위 4개 API + 국회 통합 API 활용신청 → 인증키 발급
   - 빅카인즈 OPEN API 신청서 작성 및 구글폼 제출 (소요 시간 가장 김)
   - 네이버 개발자 등록 → Client ID/Secret 발급
2. **로컬 환경 변수 설정** (KPOL 프로젝트)
   - `.env` 파일에 발급받은 키 저장 (Git에 커밋 금지)
3. **인물 DB 초기 적재 스크립트** 작성
   - 22대 당선인 + 8회 광역단체장 인입
   - `politicians` + `politician_positions` 채우기
4. **뉴스 적재 + 매핑 파이프라인** 프로토타입
   - 빅카인즈 단건 호출 → articles 적재 → NER 매핑 → metrics 일배치
5. **현재 Fake Data 코드 정리 전략 수립**
   - 실 데이터 도입과 함께 `src/data/fake*.ts` 단계적 제거 또는 dev-only 분기

이 5단계 중 1번이 모든 후속 단계의 선행 조건이다. **빅카인즈 신청은 승인까지 시간이 가장 오래 걸리므로 다른 어떤 작업보다 먼저 제출**하는 것이 효율적이다.

---

## Sources

- [중앙선거관리위원회 후보자 정보 (data.go.kr)](https://www.data.go.kr/data/15000908/openapi.do)
- [중앙선거관리위원회 당선인 정보 (data.go.kr)](https://www.data.go.kr/data/15000864/openapi.do)
- [중앙선거관리위원회 투·개표 정보 (data.go.kr)](https://www.data.go.kr/data/15000900/openapi.do)
- [중앙선거관리위원회 코드정보 (data.go.kr)](https://www.data.go.kr/data/15000897/openapi.do)
- [중앙선거관리위원회 국가선거정보 개방포털](http://data.nec.go.kr/)
- [열린국회정보 정보공개포털 Open API](https://open.assembly.go.kr/portal/openapi/main.do)
- [국회사무처 OPEN API 전체 현황 (data.go.kr)](https://www.data.go.kr/data/15125891/openapi.do)
- [국회사무처 국회의원 정보 통합 API (data.go.kr)](https://www.data.go.kr/data/15126133/openapi.do)
- [빅카인즈 (BIGKinds)](https://www.bigkinds.or.kr/)
- [한국언론진흥재단 빅카인즈 AI 기반 전면개편 (한국기자협회)](https://www.journalist.or.kr/news/article.html?no=58284)
- [빅카인즈 OPEN API 사용 신청 안내](https://swknu.kongju.ac.kr/community/noticedetail.do?seq=134)
- [BIGKINDS-LAB (GitHub, MIT)](https://github.com/KPF-bigkinds/BIGKINDS-LAB)
- [한국언론진흥재단 뉴스빅데이터 고빈도사용명사 정치면 (data.go.kr)](https://www.data.go.kr/data/15065411/fileData.do)
- [네이버 Developers API 가이드 (n8n wikidocs)](https://wikidocs.net/312068)
