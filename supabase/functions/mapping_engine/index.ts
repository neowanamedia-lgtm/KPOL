/**
 * J3 — mapping_engine
 * 빅카인즈 LAB NER로 신규 기사에서 정치인 엔티티 추출 → article_mentions 적재.
 *
 * 주기: J2 직후
 * 입력: J2가 적재한 신규 news_articles
 * 출력: article_mentions (confidence 포함) + article_themes 자동 태깅
 *
 * 매핑 규칙:
 *   - aliases / 동명이인은 직책·지역·정당 키워드 보조 매칭
 *   - confidence >= 0.85 → 자동 확정
 *   - 0.5 ≤ confidence < 0.85 → reviewed_at IS NULL로 검수 큐 진입
 *
 * 현재 단계: 스텁.
 *
 * TODO(host): 빅카인즈 LAB NER 자체 호스팅 또는 외부 호출 정책 결정
 */

import { runJob, type JobResult } from '../_shared/jobRunner.ts';

export async function runMappingEngine(triggeredBy = 'cron'): Promise<JobResult> {
  return runJob('J3', triggeredBy, async () => {
    // TODO(fetch): 신규 미매핑 기사 조회
    //   const articles = await getUnmappedArticles();
    // TODO(ner): 각 기사 본문/제목에 NER 호출
    //   const entities = await callNer(articles);
    // TODO(match): aliases 매칭 + 동명이인 보정 (직책/지역/정당 키워드 가중치)
    //   const matches = matchPoliticians(entities, knownPoliticians);
    // TODO(theme): 키워드 기반 테마 자동 태깅
    //   const themeTags = tagThemes(articles);
    // TODO(insert): article_mentions + article_themes UPSERT
    //   await upsertMentionsAndThemes(matches, themeTags);

    console.log('[J3] mapping_engine stub — no NER calls');

    return {
      status: 'success',
      mentions_added: 0,
      note: 'stub run — implement after NER host decision',
    };
  });
}

// TODO(deno): Deno.serve 래퍼
