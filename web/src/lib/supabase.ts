import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * KPOL Supabase 단일 클라이언트.
 *
 * env (web/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *
 * env 미설정 시 placeholder로 client는 생성되나 실제 호출 시 에러 →
 * 호출부에서 try/catch (analytics는 silent, admin은 화면에 표시).
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(URL && ANON);

export const supabase: SupabaseClient = createClient(
  URL || "https://placeholder.supabase.co",
  ANON || "placeholder-anon-key",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
