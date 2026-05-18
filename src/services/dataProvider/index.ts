/**
 * DataProvider 진입점.
 *
 * 현재는 FakeDataProvider를 기본으로 export.
 * 내일 Supabase 키 발급 후:
 *   1. config.ts에서 SUPABASE_URL / SUPABASE_ANON_KEY 노출
 *   2. createDataProvider()의 분기 조건을 활성화
 */

import { FakeDataProvider } from './FakeDataProvider';
import { SupabaseDataProvider } from './SupabaseDataProvider';
import type { DataProvider } from './types';

export type DataProviderMode = 'fake' | 'supabase';

export interface DataProviderConfig {
  mode: DataProviderMode;
  supabase?: {
    url: string;
    anonKey: string;
  };
}

/**
 * 단일 진입점. 앱은 이 함수의 결과만 의존한다.
 */
export const createDataProvider = (config: DataProviderConfig): DataProvider => {
  if (config.mode === 'supabase') {
    if (!config.supabase) {
      throw new Error('Supabase config (url, anonKey) is required when mode=supabase');
    }
    return new SupabaseDataProvider(config.supabase);
  }
  return new FakeDataProvider();
};

export type { DataProvider } from './types';
export {
  // 재노출 — 화면에서 import 편의
  // 응답 DTO들
} from './types';
