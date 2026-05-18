/**
 * J4 — aggregate_and_rank
 * 일배치 집계 + 다축 랭킹 스냅샷.
 *
 * 주기: 일 1회 결산 (J3 직후)
 * 입력: article_mentions
 * 출력:
 *   - daily_metrics (politician × date)
 *   - daily_theme_metrics (theme × date)
 *   - rankings + ranking_entries (스냅샷)
 *   - update_logs (이 잡의 finished_at이 앱 "마지막 업데이트" 표시 출처)
 *
 * 현재 단계: 스텁.
 */

import { runJob, type JobResult } from '../_shared/jobRunner.ts';

export async function runAggregateAndRank(triggeredBy = 'cron'): Promise<JobResult> {
  return runJob('J4', triggeredBy, async () => {
    // TODO(metrics): daily_metrics UPSERT (politician_id, date, mention_count, source_count, theme_distribution)
    //   INSERT INTO daily_metrics ...
    //   ON CONFLICT (politician_id, date) DO UPDATE ...
    // TODO(theme_metrics): daily_theme_metrics UPSERT
    // TODO(rankings): 다축 랭킹 5종 스냅샷
    //   - today_surge   : v_politician_change 기준
    //   - top_mentioned : daily_metrics.mention_count desc
    //   - weekly_mention: 7일 합산 desc
    //   - theme_surge   : daily_theme_metrics 변화율
    //   - influence_flow: person_type IN (influence types) 한정
    //   각 랭킹마다 rankings INSERT + ranking_entries INSERT
    // TODO(basis): basis_label = '뉴스 언급량 기준' (랭킹별 차별화 가능)

    console.log('[J4] aggregate_and_rank stub — no DB writes');

    return {
      status: 'success',
      note: 'stub run — implement after metrics pipeline ready',
    };
  });
}

// TODO(deno): Deno.serve 래퍼
