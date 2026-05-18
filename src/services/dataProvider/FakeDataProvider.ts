/**
 * FakeDataProvider — DataProvider의 demo 모드 구현체.
 *
 * 현재 src/data/fake*.ts를 래핑한다.
 * 모든 응답에 data_mode: 'demo' 라벨을 자동 부착해 UI가 DEMO 표시를 결정한다.
 *
 * 추후 SupabaseDataProvider가 같은 인터페이스로 교체되면 이 파일은 제거 가능.
 */

import { isInfluencePerson } from '../../constants/personType';
import { todayFlowSummary, fakePoliticianFlow } from '../../data/fakeFlow';
import { fakeAvailableTargets, fakeMyInterests, fakeRecommendedInterests } from '../../data/fakeInterests';
import { fakeNews, newsByPolitician } from '../../data/fakeNews';
import { fakePoliticians, findPoliticianById } from '../../data/fakePoliticians';
import { fakeThemes } from '../../data/fakeThemes';
import type { PersonType, RankingType } from '../../db/types';
import type { Politician } from '../../types';
import type {
  ArticleMentions,
  AvailableTargets,
  ComparisonItem,
  DataProvider,
  HomeFeed,
  InterestDetail,
  KeywordSurge,
  LastUpdateStatus,
  MarketSnapshot,
  MyInterests,
  PoliticianCardDTO,
  PoliticianComparison,
  PoliticianDetail,
  RankingSnapshot,
  RecentArticles,
  RecommendedInterests,
  RegionFlow,
  RelatedArticleDTO,
  ResponseMeta,
  SearchFilter,
  SearchResult,
  ThemeDetail,
  ThemeFlowDTO,
} from './types';

const BASIS_LABEL_MENTIONS = '뉴스 언급량 기준';
const BASIS_LABEL_DEMO = '개발 더미 데이터 · 뉴스 언급량 기준';

// Fake mode에서 모든 응답이 가리키는 가상 집계 시각.
// 향후 SupabaseDataProvider에서는 update_logs의 마지막 성공 시각을 사용.
const FAKE_AS_OF = '2026-05-19T03:20:00+09:00';

const fakeMeta = (): ResponseMeta => ({
  basis_label: BASIS_LABEL_DEMO,
  as_of: FAKE_AS_OF,
  data_mode: 'demo',
});

// ─────────────────────────────────────────────────────────────
// Adapter: Politician (legacy fake) → PoliticianCardDTO
// ─────────────────────────────────────────────────────────────
const toCardDTO = (p: Politician): PoliticianCardDTO => ({
  id: p.id,
  name: p.name,
  person_type: p.personType as PersonType,
  party_name: p.party ?? null,
  affiliation: p.affiliation ?? null,
  position_label: p.position,
  region: p.region ?? null,
  mention_count: p.mentionCount,
  mention_change: p.mentionChange,
  keywords: p.keywords,
  themes: p.themes,
});

const toRelatedArticleDTO = (n: ReturnType<typeof newsByPolitician>[number]): RelatedArticleDTO => ({
  id: n.id,
  title: n.title,
  source: n.source,
  published_at: n.publishedAt,
  url: '', // Fake 단계에서는 외부 URL 없음. 실 데이터 적재 시 채워짐.
  ai_summary_flag: false,
});

// ─────────────────────────────────────────────────────────────
// FakeDataProvider
// ─────────────────────────────────────────────────────────────
export class FakeDataProvider implements DataProvider {
  async getLastUpdateStatus(): Promise<LastUpdateStatus> {
    return {
      ...fakeMeta(),
      last_success_at: FAKE_AS_OF,
      job_id: 'J4',
      age_label: '2026.05.19 03:20',
    };
  }

  async getHomeFeed(): Promise<HomeFeed> {
    const electedPool = fakePoliticians.filter((p) => !isInfluencePerson(p.personType));
    const influencePool = fakePoliticians.filter((p) => isInfluencePerson(p.personType));

    const surge = [...electedPool]
      .sort((a, b) => b.mentionChange - a.mentionChange)
      .slice(0, 5)
      .map(toCardDTO);

    const top = [...electedPool]
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 5)
      .map(toCardDTO);

    const themeSurge: ThemeFlowDTO[] = [...fakeThemes]
      .sort((a, b) => b.mentionChange - a.mentionChange)
      .map((t) => ({
        id: t.id,
        name: t.name,
        mention_count: t.mentionCount,
        mention_change: t.mentionChange,
      }));

    const influence = [...influencePool]
      .sort((a, b) => b.mentionChange - a.mentionChange)
      .map(toCardDTO);

    const watchlist = electedPool.slice(0, 3).map(toCardDTO);

    return {
      ...fakeMeta(),
      summary: {
        date: todayFlowSummary.date,
        total_articles: todayFlowSummary.totalArticles,
        total_change: todayFlowSummary.totalChange,
        active_themes: todayFlowSummary.activeThemes,
        headline: todayFlowSummary.headline,
      },
      surge_politicians: surge,
      top_mentioned: top,
      theme_surge: themeSurge,
      influence_flow: influence,
      watchlist,
    };
  }

  async getPoliticianDetail(politicianId: string): Promise<PoliticianDetail | null> {
    const p = findPoliticianById(politicianId);
    if (!p) return null;

    const flow = (fakePoliticianFlow[politicianId] ?? []).map((pt) => ({
      date: pt.date,
      value: pt.value,
    }));

    const related = newsByPolitician(politicianId).map(toRelatedArticleDTO);

    return {
      ...fakeMeta(),
      profile: {
        id: p.id,
        name: p.name,
        person_type: p.personType as PersonType,
        party_name: p.party ?? null,
        affiliation: p.affiliation ?? null,
        position_label: p.position,
        region: p.region ?? null,
      },
      metrics: {
        today_mention_count: p.mentionCount,
        mention_change: p.mentionChange,
        flow_14d: flow,
      },
      // 6대 지표는 실 데이터 연결 후 J4가 채움. Fake에서는 0 + 라벨만 노출.
      indicators: {
        national_exposure: { value: 0, basis: '전국 매체 노출 가중 · DEMO', window_days: 7 },
        regional_exposure: { value: 0, basis: '지역 매체 노출 가중 · DEMO', window_days: 30 },
        policy_keyword_index: { value: 0, basis: '30일 정책 키워드 연결 · DEMO', top: p.keywords },
        issue_concentration: { value: 0, basis: '테마 분포 HHI · DEMO', top_themes_share: {} },
        source_diversity: { value: 0, basis: '매체 엔트로피 · DEMO', distinct_count: 0 },
      },
      keywords: p.keywords,
      themes: p.themes,
      related_articles: related,
    };
  }

  async getSearchResults(query: string, filter: SearchFilter): Promise<SearchResult> {
    const q = query.trim().toLowerCase();
    const filtered = fakePoliticians.filter((p) => {
      if (filter !== 'all' && p.personType !== filter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.party ?? '').toLowerCase().includes(q) ||
        (p.affiliation ?? '').toLowerCase().includes(q) ||
        (p.region ?? '').toLowerCase().includes(q) ||
        p.keywords.some((kw) => kw.toLowerCase().includes(q)) ||
        p.themes.some((t) => t.toLowerCase().includes(q))
      );
    });
    return {
      ...fakeMeta(),
      results: filtered.map(toCardDTO),
      total: filtered.length,
    };
  }

  async getRanking(rankingType: RankingType, scope: string = 'all'): Promise<RankingSnapshot> {
    const electedPool = fakePoliticians.filter((p) => !isInfluencePerson(p.personType));
    const influencePool = fakePoliticians.filter((p) => isInfluencePerson(p.personType));

    let entries: RankingSnapshot['entries'] = [];

    switch (rankingType) {
      case 'today_surge':
        entries = [...electedPool]
          .sort((a, b) => b.mentionChange - a.mentionChange)
          .slice(0, 10)
          .map((p, i) => ({
            rank: i + 1,
            politician: toCardDTO(p),
            metric_value: p.mentionChange,
            metric_change: p.mentionChange,
          }));
        break;
      case 'top_mentioned':
      case 'weekly_mention':
        entries = [...electedPool]
          .sort((a, b) => b.mentionCount - a.mentionCount)
          .slice(0, 10)
          .map((p, i) => ({
            rank: i + 1,
            politician: toCardDTO(p),
            metric_value: p.mentionCount,
            metric_change: p.mentionChange,
          }));
        break;
      case 'theme_surge':
        entries = [...fakeThemes]
          .sort((a, b) => b.mentionChange - a.mentionChange)
          .map((t, i) => ({
            rank: i + 1,
            theme: {
              id: t.id,
              name: t.name,
              mention_count: t.mentionCount,
              mention_change: t.mentionChange,
            },
            metric_value: t.mentionCount,
            metric_change: t.mentionChange,
          }));
        break;
      case 'influence_flow':
        entries = [...influencePool]
          .sort((a, b) => b.mentionChange - a.mentionChange)
          .map((p, i) => ({
            rank: i + 1,
            politician: toCardDTO(p),
            metric_value: p.mentionCount,
            metric_change: p.mentionChange,
          }));
        break;
    }

    return {
      ...fakeMeta(),
      ranking_type: rankingType,
      scope,
      entries,
    };
  }

  async getArticleMentions(politicianId: string, limit?: number): Promise<ArticleMentions> {
    const all = newsByPolitician(politicianId).map(toRelatedArticleDTO);
    const sliced = typeof limit === 'number' ? all.slice(0, limit) : all;
    return {
      ...fakeMeta(),
      politician_id: politicianId,
      articles: sliced,
      total: all.length,
    };
  }

  // ── Widget 전용 ─────────────────────────────────────────────

  async getPoliticianComparison(
    politicianIds: string[],
    options?: {
      compare_mode?: 'general' | 'theme' | 'region' | 'presidential';
      theme_id?: string;
      region_code?: string;
    },
  ): Promise<PoliticianComparison> {
    const items: ComparisonItem[] = politicianIds
      .map((id) => findPoliticianById(id))
      .filter((p): p is Politician => Boolean(p))
      .map((p) => {
        const flow = (fakePoliticianFlow[p.id] ?? []).slice(-7).map((pt) => ({
          date: pt.date,
          value: pt.value,
        }));
        return {
          id: p.id,
          name: p.name,
          person_type: p.personType as PersonType,
          party_name: p.party ?? null,
          affiliation: p.affiliation ?? null,
          position_label: p.position,
          region: p.region ?? null,
          mention_change: p.mentionChange,
          mention_count: p.mentionCount,
          flow_7d: flow,
          keywords: p.keywords,
          indicators_lite: {
            national_exposure: { value: 0, basis: '전국 매체 노출 · DEMO' },
            policy_keyword_index: { value: 0, basis: '정책 키워드 · DEMO' },
            issue_concentration: { value: 0, basis: '테마 분포 · DEMO' },
            source_diversity: { value: 0, basis: '매체 다양성 · DEMO' },
          },
        };
      });

    const mode = options?.compare_mode ?? 'general';
    let context: string | undefined;
    if (mode === 'theme' && options?.theme_id) {
      const theme = fakeThemes.find((t) => t.id === options.theme_id);
      context = theme ? `${theme.name} 흐름 안에서` : undefined;
    } else if (mode === 'region' && options?.region_code) {
      context = `${options.region_code} 정치 안에서`;
    } else if (mode === 'presidential') {
      context = '대권주자군 흐름';
    }

    return {
      ...fakeMeta(),
      items,
      compare_mode: mode,
      context_label: context,
    };
  }

  async getThemeDetail(themeId: string): Promise<ThemeDetail | null> {
    const theme = fakeThemes.find((t) => t.id === themeId);
    if (!theme) return null;

    // 더미 14일 흐름 — 마지막 값이 mentionCount와 일치
    const flow = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date('2026-05-19');
      d.setDate(d.getDate() - (13 - i));
      return {
        date: d.toISOString().slice(0, 10),
        value: Math.round(theme.mentionCount * (0.6 + (i / 13) * 0.4)),
      };
    });

    const related = fakePoliticians
      .filter((p) => p.themes.some((t) => t === theme.name))
      .slice(0, 5)
      .map(toCardDTO);

    return {
      ...fakeMeta(),
      id: theme.id,
      name: theme.name,
      description: null,
      mention_count: theme.mentionCount,
      mention_change: theme.mentionChange,
      flow_14d: flow,
      top_politicians: related,
    };
  }

  async getRegionFlow(regionCode: string, regionLabel?: string): Promise<RegionFlow> {
    // Fake에서는 region_code를 region 문자열 prefix로 해석
    const matched = fakePoliticians.filter((p) =>
      p.region ? p.region.startsWith(regionCode) : false,
    );
    const cards = matched
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .map(toCardDTO);

    return {
      ...fakeMeta(),
      region_code: regionCode,
      region_label: regionLabel ?? `${regionCode} 정치시장`,
      politicians: cards,
      total_articles: matched.reduce((sum, p) => sum + p.mentionCount, 0),
    };
  }

  async getKeywordSurge(limit: number = 10): Promise<KeywordSurge> {
    // 모든 fake 정치인의 키워드를 빈도별로 집계
    const counts = new Map<string, { mc: number; themes: Set<string>; chg: number[] }>();
    for (const p of fakePoliticians) {
      for (const kw of p.keywords) {
        const entry = counts.get(kw) ?? { mc: 0, themes: new Set(), chg: [] };
        entry.mc += p.mentionCount;
        for (const t of p.themes) entry.themes.add(t);
        entry.chg.push(p.mentionChange);
        counts.set(kw, entry);
      }
    }
    const items = Array.from(counts.entries())
      .map(([keyword, v]) => ({
        keyword,
        mention_count: v.mc,
        mention_change:
          v.chg.length > 0 ? Number((v.chg.reduce((a, b) => a + b, 0) / v.chg.length).toFixed(1)) : 0,
        related_themes: Array.from(v.themes).slice(0, 3),
      }))
      .sort((a, b) => b.mention_change - a.mention_change)
      .slice(0, limit);

    return {
      ...fakeMeta(),
      items,
    };
  }

  async getMarketSnapshot(
    market: 'central' | 'parties' | 'policy' | 'region',
  ): Promise<MarketSnapshot> {
    let items: MarketSnapshot['items'] = [];
    let label = '';
    let headline = '';

    if (market === 'central') {
      label = '중앙정치시장';
      const elected = fakePoliticians.filter((p) => p.personType === 'elected_official');
      items = [
        { label: '활성 의원', value: elected.length, change: null, note: null },
        {
          label: '총 언급',
          value: elected.reduce((s, p) => s + p.mentionCount, 0),
          change: null,
          note: null,
        },
        {
          label: '평균 변화율',
          value: Number(
            (elected.reduce((s, p) => s + p.mentionChange, 0) / Math.max(1, elected.length)).toFixed(1),
          ),
          change: null,
          note: '% (7d)',
        },
      ];
      headline = '중앙 선출직 흐름 집계 · 뉴스 언급량 기준';
    } else if (market === 'parties') {
      label = '정당시장';
      const byParty = new Map<string, number>();
      for (const p of fakePoliticians) {
        if (p.party) byParty.set(p.party, (byParty.get(p.party) ?? 0) + p.mentionCount);
      }
      items = Array.from(byParty.entries()).map(([name, count]) => ({
        label: name,
        value: count,
        change: null,
        note: null,
      }));
      headline = '정당별 누적 언급량 · 뉴스 기준';
    } else if (market === 'policy') {
      label = '정책시장';
      items = fakeThemes.slice(0, 5).map((t) => ({
        label: t.name,
        value: t.mentionCount,
        change: t.mentionChange,
        note: null,
      }));
      headline = '정책 테마별 언급 흐름 · 뉴스 기준';
    } else {
      label = '지역시장';
      const byRegion = new Map<string, number>();
      for (const p of fakePoliticians) {
        if (!p.region) continue;
        const key = p.region.split(' ')[0]; // "서울 강남갑" → "서울"
        byRegion.set(key, (byRegion.get(key) ?? 0) + p.mentionCount);
      }
      items = Array.from(byRegion.entries()).map(([name, count]) => ({
        label: name,
        value: count,
        change: null,
        note: null,
      }));
      headline = '지역별 정치 언급 흐름 · 뉴스 기준';
    }

    return {
      ...fakeMeta(),
      market,
      market_label: label,
      items,
      headline,
    };
  }

  // ── Interest Target ─────────────────────────────────────────

  async getMyInterests(): Promise<MyInterests> {
    return {
      ...fakeMeta(),
      targets: fakeMyInterests,
    };
  }

  async getRecommendedInterests(limit: number = 6): Promise<RecommendedInterests> {
    return {
      ...fakeMeta(),
      items: fakeRecommendedInterests.slice(0, limit),
    };
  }

  async getInterestDetail(targetId: string): Promise<InterestDetail | null> {
    const t = fakeMyInterests.find((x) => x.id === targetId);
    if (!t) return null;
    // C6에서 패널별 데이터를 채운다. 현재는 빈 컨테이너.
    return {
      ...fakeMeta(),
      target: t,
      panels_data: {},
    };
  }

  async getAvailableTargets(): Promise<AvailableTargets> {
    return {
      ...fakeMeta(),
      targets: fakeAvailableTargets,
    };
  }

  async getRecentArticles(limit: number = 10, themeId?: string): Promise<RecentArticles> {
    let articles = fakeNews.slice();
    if (themeId) {
      // Fake 뉴스는 themes 매핑이 별도로 없으므로 keywords로 보조 필터
      const theme = fakeThemes.find((t) => t.id === themeId);
      if (theme) {
        articles = articles.filter((n) =>
          n.keywords.some((kw) => kw === theme.name) ||
          fakePoliticians.some(
            (p) =>
              n.politicianIds.includes(p.id) &&
              p.themes.some((t) => t === theme.name),
          ),
        );
      }
    }
    const sliced = articles
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
      .slice(0, limit)
      .map(toRelatedArticleDTO);

    return {
      ...fakeMeta(),
      articles: sliced,
      total: articles.length,
    };
  }
}
