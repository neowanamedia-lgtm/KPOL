/**
 * KPOL 1차 사용량 카운팅 — 익명 fire-and-forget.
 *
 * - Supabase env 미설정 시 silent noop (개발 환경 부담 ✗)
 * - insert 실패 시 사용자 화면 영향 ✗ (모든 throw catch)
 * - 개인정보 ✗ — user_agent / path / is_pwa 정도만 기록
 *
 * env (web/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type EventType = "share_click" | "category_click" | "pwa_launch";
export type CategoryTarget =
  | "person"
  | "media"
  | "by_election"
  | "local_election";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (client) return client;
  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return client;
  } catch {
    return null;
  }
}

function detectPwa(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

interface FireOptions {
  event_target?: string | null;
}

/** fire-and-forget — 항상 즉시 반환, 실패는 silent. */
export function fireEvent(type: EventType, opts: FireOptions = {}): void {
  if (typeof window === "undefined") return;
  const c = getClient();
  if (!c) return; // env 미설정 → noop

  const payload = {
    event_type: type,
    event_target: opts.event_target ?? null,
    path: typeof location !== "undefined" ? location.pathname : null,
    user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
    is_pwa: detectPwa(),
  };

  // fire-and-forget: 실패 silent, 사용자 화면 영향 ✗
  void (async () => {
    try {
      await c.from("event_logs").insert(payload);
    } catch {
      // silent
    }
  })();
}
