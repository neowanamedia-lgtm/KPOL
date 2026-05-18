/**
 * SupabaseDataProvider — DataProvider의 live 모드 구현체 (스텁).
 *
 * 내일 사용자가 Supabase URL/anon key를 발급 받으면:
 *   1. @supabase/supabase-js 설치
 *   2. createClient() 호출
 *   3. 각 메서드에서 RPC 또는 from().select() 호출로 교체
 *
 * 현재는 컴파일만 통과하는 스텁이다. 호출 시 명시적으로 NotImplementedError.
 */

import type { RankingType } from '../../db/types';
import type {
  ArticleMentions,
  AvailableTargets,
  DataProvider,
  HomeFeed,
  InterestDetail,
  KeywordSurge,
  LastUpdateStatus,
  MarketSnapshot,
  MyInterests,
  PoliticianComparison,
  PoliticianDetail,
  RankingSnapshot,
  RecentArticles,
  RecommendedInterests,
  RegionFlow,
  SearchFilter,
  SearchResult,
  ThemeDetail,
} from './types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`SupabaseDataProvider.${method} is not implemented yet. Provide Supabase credentials and wire RPC calls.`);
    this.name = 'NotImplementedError';
  }
}

export class SupabaseDataProvider implements DataProvider {
  // TODO: @supabase/supabase-js 의존성 추가 후 SupabaseClient 인스턴스 보관
  // private client: SupabaseClient;

  constructor(_config: SupabaseConfig) {
    // TODO: this.client = createClient(_config.url, _config.anonKey);
  }

  async getLastUpdateStatus(): Promise<LastUpdateStatus> {
    // TODO: select * from update_logs where status='success' and job_id='J4' order by finished_at desc limit 1
    throw new NotImplementedError('getLastUpdateStatus');
  }

  async getHomeFeed(): Promise<HomeFeed> {
    // TODO: rpc('get_home_feed')
    throw new NotImplementedError('getHomeFeed');
  }

  async getPoliticianDetail(_politicianId: string): Promise<PoliticianDetail | null> {
    // TODO: rpc('get_politician_detail', { p_id: _politicianId })
    throw new NotImplementedError('getPoliticianDetail');
  }

  async getSearchResults(_query: string, _filter: SearchFilter): Promise<SearchResult> {
    // TODO: rpc('get_search_results', { p_query: _query, p_filter: _filter })
    throw new NotImplementedError('getSearchResults');
  }

  async getRanking(_rankingType: RankingType, _scope?: string): Promise<RankingSnapshot> {
    // TODO: rpc('get_ranking', { p_type: _rankingType, p_scope: _scope })
    throw new NotImplementedError('getRanking');
  }

  async getArticleMentions(_politicianId: string, _limit?: number): Promise<ArticleMentions> {
    // TODO: rpc('get_article_mentions', { p_id: _politicianId, p_limit: _limit })
    throw new NotImplementedError('getArticleMentions');
  }

  // ── Widget 전용 ─────────────────────────────────────────────

  async getPoliticianComparison(
    _politicianIds: string[],
    _options?: {
      compare_mode?: 'general' | 'theme' | 'region' | 'presidential';
      theme_id?: string;
      region_code?: string;
    },
  ): Promise<PoliticianComparison> {
    // TODO: rpc('get_politician_comparison', { p_ids: _politicianIds, p_options: _options })
    throw new NotImplementedError('getPoliticianComparison');
  }

  async getThemeDetail(_themeId: string): Promise<ThemeDetail | null> {
    // TODO: rpc('get_theme_detail', { p_theme_id: _themeId })
    throw new NotImplementedError('getThemeDetail');
  }

  async getRegionFlow(_regionCode: string, _regionLabel?: string): Promise<RegionFlow> {
    // TODO: rpc('get_region_flow', { p_region_code: _regionCode })
    throw new NotImplementedError('getRegionFlow');
  }

  async getKeywordSurge(_limit?: number): Promise<KeywordSurge> {
    // TODO: rpc('get_keyword_surge', { p_limit: _limit })
    throw new NotImplementedError('getKeywordSurge');
  }

  async getMarketSnapshot(
    _market: 'central' | 'parties' | 'policy' | 'region',
  ): Promise<MarketSnapshot> {
    // TODO: rpc('get_market_snapshot', { p_market: _market })
    throw new NotImplementedError('getMarketSnapshot');
  }

  async getRecentArticles(_limit?: number, _themeId?: string): Promise<RecentArticles> {
    // TODO: rpc('get_recent_articles', { p_limit: _limit, p_theme_id: _themeId })
    throw new NotImplementedError('getRecentArticles');
  }

  // ── Interest Target ─────────────────────────────────────────

  async getMyInterests(): Promise<MyInterests> {
    // TODO: rpc('get_my_interests')
    throw new NotImplementedError('getMyInterests');
  }

  async getRecommendedInterests(_limit?: number): Promise<RecommendedInterests> {
    // TODO: rpc('get_recommended_interests', { p_limit: _limit })
    throw new NotImplementedError('getRecommendedInterests');
  }

  async getInterestDetail(_targetId: string): Promise<InterestDetail | null> {
    // TODO: rpc('get_interest_detail', { p_id: _targetId })
    throw new NotImplementedError('getInterestDetail');
  }

  async getAvailableTargets(): Promise<AvailableTargets> {
    // TODO: rpc('get_available_targets') 또는 client-side 카탈로그
    throw new NotImplementedError('getAvailableTargets');
  }
}
