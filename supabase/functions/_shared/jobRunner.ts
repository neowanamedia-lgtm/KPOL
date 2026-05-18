/**
 * 배치 잡 공통 러너.
 * 모든 잡(J1~J4)은 이 러너로 감싸서 update_logs 기록을 일관되게 처리한다.
 *
 * 현재 단계: 스텁 — Supabase 클라이언트 호출은 TODO.
 * 내일 Supabase 프로젝트 생성 후 service_role 키로 createClient 후 INSERT.
 */

export type JobStatus = 'running' | 'success' | 'failed' | 'partial';

export interface JobResult {
  status: JobStatus;
  articles_processed?: number;
  mentions_added?: number;
  errors_count?: number;
  error_summary?: string;
  note?: string;
}

export interface JobContext {
  jobId: 'J1' | 'J2' | 'J3' | 'J4';
  triggeredBy: string; // 'cron' | 'manual:<user>'
  startedAt: Date;
}

/**
 * 잡 실행을 감싸 update_logs INSERT를 자동화한다.
 *
 * TODO(supabase):
 *   1. import { createClient } from '@supabase/supabase-js'
 *   2. const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
 *   3. 시작 시 update_logs INSERT (status='running', finished_at=null)
 *   4. 종료 시 UPDATE (status, finished_at, articles_processed, ...)
 *   5. 실패 시 status='failed', error_summary 채움
 */
export async function runJob(
  jobId: JobContext['jobId'],
  triggeredBy: string,
  body: (ctx: JobContext) => Promise<JobResult>,
): Promise<JobResult> {
  const ctx: JobContext = {
    jobId,
    triggeredBy,
    startedAt: new Date(),
  };

  // TODO(supabase): INSERT INTO update_logs (job_id, started_at, status, triggered_by)
  //                 VALUES (jobId, now(), 'running', triggeredBy)
  //                 RETURNING id;
  // const logId = ...
  console.log(`[${jobId}] started by ${triggeredBy} at ${ctx.startedAt.toISOString()}`);

  try {
    const result = await body(ctx);
    // TODO(supabase): UPDATE update_logs SET finished_at=now(), status=..., articles_processed=..., mentions_added=..., errors_count=...
    console.log(`[${jobId}] finished: ${JSON.stringify(result)}`);
    return result;
  } catch (err) {
    const errorSummary = err instanceof Error ? err.message : String(err);
    // TODO(supabase): UPDATE update_logs SET finished_at=now(), status='failed', error_summary=:errorSummary
    console.error(`[${jobId}] failed: ${errorSummary}`);
    return {
      status: 'failed',
      errors_count: 1,
      error_summary: errorSummary,
    };
  }
}
