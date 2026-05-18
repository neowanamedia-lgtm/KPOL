/**
 * DataProvider 활성 모드 설정.
 *
 * 내일 Supabase 발급 후:
 *   1. .env에 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 추가
 *   2. ACTIVE_MODE를 'supabase'로 변경
 *   3. 아래 supabaseConfig가 env에서 읽어 동작
 */

import type { DataProviderConfig, DataProviderMode } from './index';

// TODO(supabase): 'fake' → 'supabase' 로 전환
export const ACTIVE_MODE: DataProviderMode = 'fake';

// TODO(supabase): expo env에서 읽기 — process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

export const activeConfig: DataProviderConfig = {
  mode: ACTIVE_MODE,
  supabase: ACTIVE_MODE === 'supabase'
    ? { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }
    : undefined,
};
