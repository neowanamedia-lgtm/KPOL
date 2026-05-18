/**
 * InterestStore — 사용자의 관심 대상 in-memory 상태.
 *
 * 1차 출시 단계:
 *   - 초기 로드는 DataProvider.getMyInterests() / getRecommendedInterests()
 *   - 추가/제거/고정은 메모리에서만 처리 (persistence 후순위)
 *   - 향후 AsyncStorage / Supabase user_interest_targets 동기화로 확장
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useDataProvider } from '../dataProvider/ApiProvider';
import type {
  AvailableTarget,
  RecommendedTarget as RecommendedTargetResp,
} from '../dataProvider/types';
import type {
  InterestTarget,
  InterestTargetType,
  RecommendedTarget,
} from '../../types/widget';

interface InterestStore {
  myInterests: InterestTarget[];
  recommended: RecommendedTarget[];
  loading: boolean;

  /** 추천 또는 카탈로그에서 홈으로 설치 */
  addTarget: (source: RecommendedTarget | AvailableTarget) => void;

  /** 홈에서 제거 */
  removeTarget: (id: string) => void;

  /** 핀 토글 */
  togglePin: (id: string) => void;

  /** 이미 설치된 대상인지 (type + target_ref 기준) */
  isAdded: (type: InterestTargetType, target_ref: string) => boolean;
}

const InterestStoreContext = createContext<InterestStore | null>(null);

interface ProviderProps {
  children: React.ReactNode;
}

const SOURCE_KIND = (s: RecommendedTarget | AvailableTarget): 'recommended' | 'available' => {
  return 'generated_reason' in s ? 'recommended' : 'available';
};

let installCounter = 0;
const nextLocalId = () => `local_${Date.now()}_${installCounter++}`;

const sortInterests = (list: InterestTarget[]): InterestTarget[] => {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.priority_score - a.priority_score;
  });
};

export const InterestStoreProvider: React.FC<ProviderProps> = ({ children }) => {
  const provider = useDataProvider();
  const [myInterests, setMyInterests] = useState<InterestTarget[]>([]);
  const [recommended, setRecommended] = useState<RecommendedTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // 초기 로드
  useEffect(() => {
    let cancelled = false;
    Promise.all([provider.getMyInterests(), provider.getRecommendedInterests()])
      .then(([my, rec]) => {
        if (cancelled) return;
        setMyInterests(sortInterests(my.targets));
        setRecommended(rec.items);
      })
      .catch(() => {
        if (cancelled) return;
        setMyInterests([]);
        setRecommended([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const isAdded = useCallback(
    (type: InterestTargetType, target_ref: string): boolean =>
      myInterests.some((t) => t.type === type && t.target_ref === target_ref),
    [myInterests],
  );

  const addTarget = useCallback(
    (source: RecommendedTarget | AvailableTarget) => {
      if (isAdded(source.type, source.target_ref)) return;

      const id = 'id' in source && source.id ? `${source.id}_added` : nextLocalId();
      const newTarget: InterestTarget = {
        id,
        type: source.type,
        target_ref: source.target_ref,
        title: source.title,
        subtitle: source.subtitle,
        auto_generated: false,
        pinned: false,
        priority: 'normal',
        priority_score: 60,
        active: true,
        generated_reason: SOURCE_KIND(source) === 'recommended'
          ? (source as RecommendedTarget).generated_reason
          : 'manager_pick',
        reason_metadata: SOURCE_KIND(source) === 'recommended'
          ? (source as RecommendedTarget).reason_metadata
          : undefined,
        panels: [],
        updated_at: new Date().toISOString(),
        preview: source.preview,
      };

      setMyInterests((prev) => sortInterests([...prev, newTarget]));

      // 추천 목록에서 같은 대상 제거
      setRecommended((prev) =>
        prev.filter((r) => !(r.type === source.type && r.target_ref === source.target_ref)),
      );
    },
    [isAdded],
  );

  const removeTarget = useCallback((id: string) => {
    setMyInterests((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const togglePin = useCallback((id: string) => {
    setMyInterests((prev) =>
      sortInterests(
        prev.map((t) => {
          if (t.id !== id) return t;
          const pinned = !t.pinned;
          return {
            ...t,
            pinned,
            priority: pinned ? 'pinned' : 'normal',
            priority_score: pinned ? 100 : 60,
            updated_at: new Date().toISOString(),
          };
        }),
      ),
    );
  }, []);

  const value = useMemo<InterestStore>(
    () => ({
      myInterests,
      recommended,
      loading,
      addTarget,
      removeTarget,
      togglePin,
      isAdded,
    }),
    [myInterests, recommended, loading, addTarget, removeTarget, togglePin, isAdded],
  );

  return (
    <InterestStoreContext.Provider value={value}>
      {children}
    </InterestStoreContext.Provider>
  );
};

export const useInterestStore = (): InterestStore => {
  const ctx = useContext(InterestStoreContext);
  if (!ctx) {
    throw new Error('useInterestStore must be used within <InterestStoreProvider>');
  }
  return ctx;
};
