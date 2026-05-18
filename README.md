# KPOL

대한민국 정치 흐름 터미널 — 뉴스 데이터 기반의 모바일 정치 정보 인터페이스.

## 정체성

- 정치 커뮤니티 / 토론 플랫폼 / 뉴스 사이트가 아닙니다.
- 운영자/사용자 의견, 댓글, 좋아요, 평가 기능 없음.
- 뉴스·공개 데이터 기반의 흐름 시각화에만 집중합니다.

## 현재 상태 — v0.1 MVP (Demo Data 단계)

- Expo + React Native + TypeScript UI 완성
- DataProvider 추상화 완료 — `FakeDataProvider`가 기본 구현체
- 내일 Supabase URL/anon key 발급 후 `SupabaseDataProvider`로 한 줄 교체 예정
- 백엔드 스키마 SQL 초안 + 배치 잡 스켈레톤 작성 완료 (`supabase/`)

## 아키텍처

```
앱 (RN/Expo)
  └─ src/hooks/useApi.ts            화면용 데이터 훅
      └─ src/services/dataProvider/  DataProvider 인터페이스
          ├─ FakeDataProvider       (현재 활성)
          └─ SupabaseDataProvider   (스텁 — 내일 활성화)

백엔드 (예정 — Supabase)
  └─ supabase/
      ├─ migrations/
      │   ├─ 0001_initial.sql       11개 테이블 정의
      │   └─ 0002_cron_schedule.sql pg_cron 등록 (스텁)
      └─ functions/
          ├─ profile_sync/          J1 — 선관위·국회 동기화
          ├─ news_ingest/           J2 — 빅카인즈·네이버 수집
          ├─ mapping_engine/        J3 — NER 매핑
          └─ aggregate_and_rank/    J4 — 일배치 집계 + 랭킹
```

## 폴더 구조

```
/src
  /components       Card, MetricChange, Tag, PoliticianCard, ThemeCard,
                    FlowSparkline, FilterChip
    /system         LastUpdatedLabel, BasisFooter
  /screens          Splash / Home / PoliticianDetail / Search / Settings
  /navigation       RootNavigator
  /services
    /dataProvider   types · FakeDataProvider · SupabaseDataProvider · ApiProvider
  /hooks            useApi (useHomeFeed, usePoliticianDetail, useSearchResults, …)
  /db               types.ts — SQL ↔ TS 매핑
  /data             fake* — FakeDataProvider 전용 (실 데이터 적재 후 제거)
  /constants        theme, strings, personType
  /utils            format

/supabase
  /migrations       SQL 파일
  /functions        Edge Function 스켈레톤
  /functions/_shared jobRunner (update_logs 자동 기록)

/docs
  data-sources-report.md      외부 API 조사
  auto-update-architecture.md 자동 업데이트 아키텍처
```

## 시작하기

의존성 설치:

```bash
npm install
```

iOS 실행:

```bash
npm run ios
```

타입 체크:

```bash
npm run typecheck
```

## 내일 작업 (실 데이터 연결)

1. data.go.kr 회원가입 → 선관위 4종 + 국회 통합 API 활용신청 → 인증키
2. 빅카인즈 OPEN API 신청서 제출 (가장 오래 걸림 — **가장 먼저**)
3. 네이버 개발자 등록 → Client ID/Secret
4. Supabase 프로젝트 생성 → URL/anon/service_role 키 확보
5. `supabase db push` → `0001_initial.sql` 적용
6. `src/services/dataProvider/config.ts` → `ACTIVE_MODE = 'supabase'` + env 주입
7. `SupabaseDataProvider` TODO 채우기 (RPC 호출)
8. Edge Functions의 TODO 채우기 (외부 API 호출 → DB INSERT)
9. `0002_cron_schedule.sql` 활성화 → pg_cron 등록

UI는 손대지 않는다. `DataProvider` 인터페이스가 같은 모양이라면 화면은 무변경.

## 디자인 원칙

Bloomberg Terminal / TradingView 감성:

- 베이스: `#0A0A0A` 블랙 / `#141414` 카드 / 화이트 톤 텍스트
- 변화량: 차분한 amber 단일 포인트 컬러 (`#E0B341`)
- 정당-색 1:1 매핑 금지
- 모든 수치 옆에 "뉴스 언급량 기준" 라벨
- 헤더에 "마지막 업데이트" + DEMO 단계에서는 DEMO 배지
- 푸터에 시스템 메타데이터 (`Sample data for interface validation`)

## 금지 / 허용

| 금지 | 허용 |
| --- | --- |
| 댓글, 토론, 좋아요 | 뉴스 언급량 |
| 정치인 평가, 좋다/나쁘다 | 기사량 변화 |
| 선거 예측, 승패 표현 | 연결 키워드 / 테마 |
| 영향력 우열·신뢰도 표현 | 흐름 시각화 |
| 정치 유튜브/커뮤니티 톤 | 자동 집계 / 근거 기사 |
