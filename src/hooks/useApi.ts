/**
 * 화면 전용 데이터 훅.
 * DataProvider 메서드를 React 상태로 래핑.
 *
 * MVP에서는 외부 상태 라이브러리를 도입하지 않음 — 단순 useState/useEffect.
 * 후속 단계에서 react-query 등 도입 시 이 훅들의 시그니처를 유지하면 무손실 교체.
 */

import { useEffect, useState } from 'react';

import { useDataProvider } from '../services/dataProvider/ApiProvider';
import type {
  ArticleMentions,
  AvailableTargets,
  HomeFeed,
  KeywordSurge,
  LastUpdateStatus,
  MarketSnapshot,
  PoliticianComparison,
  PoliticianDetail,
  RankingSnapshot,
  RecentArticles,
  RegionFlow,
  SearchFilter,
  SearchResult,
  ThemeDetail,
} from '../services/dataProvider/types';
import type { RankingType } from '../db/types';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

const initial = <T>(): AsyncState<T> => ({ data: null, loading: true, error: null });

export const useLastUpdate = () => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<LastUpdateStatus>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getLastUpdateStatus()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, [provider]);

  return state;
};

export const useHomeFeed = () => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<HomeFeed>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getHomeFeed()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, [provider]);

  return state;
};

export const usePoliticianDetail = (politicianId: string) => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<PoliticianDetail>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getPoliticianDetail(politicianId)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, [provider, politicianId]);

  return state;
};

export const useSearchResults = (query: string, filter: SearchFilter) => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<SearchResult>>(initial);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));
    provider
      .getSearchResults(query, filter)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, [provider, query, filter]);

  return state;
};

export const useRanking = (rankingType: RankingType, scope?: string) => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<RankingSnapshot>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getRanking(rankingType, scope)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, [provider, rankingType, scope]);

  return state;
};

export const useArticleMentions = (politicianId: string, limit?: number) => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<ArticleMentions>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getArticleMentions(politicianId, limit)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, [provider, politicianId, limit]);

  return state;
};

// ── Widget 전용 훅 ─────────────────────────────────────────────

export const usePoliticianComparison = (
  politicianIds: string[],
  options?: {
    compare_mode?: 'general' | 'theme' | 'region' | 'presidential';
    theme_id?: string;
    region_code?: string;
  },
) => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<PoliticianComparison>>(initial);
  const idsKey = politicianIds.join(',');
  const optKey = JSON.stringify(options ?? {});

  useEffect(() => {
    let cancelled = false;
    provider
      .getPoliticianComparison(politicianIds, options)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, idsKey, optKey]);

  return state;
};

export const useThemeDetail = (themeId: string) => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<ThemeDetail>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getThemeDetail(themeId)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => { cancelled = true; };
  }, [provider, themeId]);

  return state;
};

export const useRegionFlow = (regionCode: string, regionLabel?: string) => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<RegionFlow>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getRegionFlow(regionCode, regionLabel)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => { cancelled = true; };
  }, [provider, regionCode, regionLabel]);

  return state;
};

export const useKeywordSurge = (limit?: number) => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<KeywordSurge>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getKeywordSurge(limit)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => { cancelled = true; };
  }, [provider, limit]);

  return state;
};

export const useMarketSnapshot = (market: 'central' | 'parties' | 'policy' | 'region') => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<MarketSnapshot>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getMarketSnapshot(market)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => { cancelled = true; };
  }, [provider, market]);

  return state;
};

export const useRecentArticles = (limit?: number, themeId?: string) => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<RecentArticles>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getRecentArticles(limit, themeId)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => { cancelled = true; };
  }, [provider, limit, themeId]);

  return state;
};

// ── Interest Target ─────────────────────────────────────────────

export const useAvailableTargets = () => {
  const provider = useDataProvider();
  const [state, setState] = useState<AsyncState<AvailableTargets>>(initial);

  useEffect(() => {
    let cancelled = false;
    provider
      .getAvailableTargets()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => { cancelled = true; };
  }, [provider]);

  return state;
};
