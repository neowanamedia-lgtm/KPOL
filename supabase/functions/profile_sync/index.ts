/**
 * J1 — profile_sync
 * 선관위 + 국회 OpenAPI에서 인물 프로필 동기화.
 *
 * 주기: 주 1회 (MVP) → 일 1회 (고도화)
 * 입력: 22대 국회의원 명단, 8회→9회 광역단체장 명단
 * 출력: politicians / politician_positions / parties 갱신 + update_logs 기록
 *
 * 현재 단계: 스텁. 외부 API 호출 없음.
 *
 * TODO(api-keys):
 *   - data.go.kr 인증키 (선관위 후보자/당선인 API)
 *   - open.assembly.go.kr 인증키 (국회의원 정보 통합)
 */

import { runJob, type JobResult } from '../_shared/jobRunner.ts';

export async function runProfileSync(triggeredBy = 'cron'): Promise<JobResult> {
  return runJob('J1', triggeredBy, async () => {
    // TODO(nec): 선관위 당선인 정보 호출 (선거ID=22대 국회의원, 8회 지방선거)
    //   const candidates = await fetchNecCandidates({ ... });
    // TODO(assembly): 국회 의원 정보 호출
    //   const members = await fetchAssemblyMembers();
    // TODO(merge): 양쪽 데이터 매칭 (이름 + 선거구 + 정당)
    //   const merged = mergeProfiles(candidates, members);
    // TODO(upsert): politicians UPSERT + politician_positions 이력 추가
    //   const { upserted } = await upsertPoliticians(merged);

    console.log('[J1] profile_sync stub — no external calls');

    return {
      status: 'success',
      articles_processed: 0,
      mentions_added: 0,
      note: 'stub run — implement after data.go.kr / open.assembly.go.kr key issuance',
    };
  });
}

// TODO(deno): Supabase Edge Function 진입점 — Deno.serve 래퍼로 감싸기
// Deno.serve(async (req) => {
//   const triggeredBy = req.headers.get('x-triggered-by') ?? 'cron';
//   const result = await runProfileSync(triggeredBy);
//   return new Response(JSON.stringify(result), {
//     status: 200,
//     headers: { 'content-type': 'application/json' },
//   });
// });
