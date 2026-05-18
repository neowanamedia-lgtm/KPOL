/**
 * J2 — news_ingest
 * 빅카인즈 + 네이버 검색 API에서 신규 기사 수집.
 *
 * 주기: 6시간마다 (MVP) → 1시간마다 → 15분 (준실시간)
 * 입력: J1이 적재한 politicians 명단
 * 출력: news_articles INSERT (url_normalized UNIQUE로 dedupe) + update_logs
 *
 * 현재 단계: 스텁. 외부 API 호출 없음.
 *
 * TODO(api-keys):
 *   - 빅카인즈 OPEN API 인증키 (가장 오래 걸림 — 신청·승인 필요)
 *   - 네이버 Client ID/Secret
 */

import { runJob, type JobResult } from '../_shared/jobRunner.ts';

export async function runNewsIngest(triggeredBy = 'cron'): Promise<JobResult> {
  return runJob('J2', triggeredBy, async () => {
    // TODO(window): 직전 잡 성공 시각 ~ now() 윈도우 계산
    //   const window = await getIngestWindow(); // last_success_at 기반
    // TODO(politicians): 활성 정치인 명단 불러오기 (이름 + 직책 + 정당 키워드)
    //   const targets = await getActivePoliticians();
    // TODO(bigkinds): 빅카인즈 검색 호출 (정치면 카테고리 필터)
    //   const bigkindsHits = await searchBigkinds(window, targets);
    // TODO(naver): 네이버 검색 보완
    //   const naverHits = await searchNaver(window, targets);
    // TODO(dedupe): url_normalized 키로 dedupe
    //   const articles = dedupeByUrl([...bigkindsHits, ...naverHits]);
    // TODO(insert): news_articles INSERT ... ON CONFLICT (url_normalized) DO NOTHING

    console.log('[J2] news_ingest stub — no external calls');

    return {
      status: 'success',
      articles_processed: 0,
      note: 'stub run — implement after BIGKinds approval + Naver dev registration',
    };
  });
}

// TODO(deno): Deno.serve 래퍼 — profile_sync와 동일 패턴
