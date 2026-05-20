/**
 * KPOL 1차 사용량 카운팅 — 익명 fire-and-forget.
 *
 * - Supabase env 미설정 시 silent noop
 * - insert 실패 silent
 * - 개인정보 ✗
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type EventType = "share_click" | "category_click" | "pwa_launch";
export type CategoryTarget =
  | "person"
  | "media"
  | "by_election"
  | "local_election";

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
  if (!isSupabaseConfigured) return;

  const payload = {
    event_type: type,
    event_target: opts.event_target ?? null,
    path: typeof location !== "undefined" ? location.pathname : null,
    user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
    is_pwa: detectPwa(),
  };

  void (async () => {
    try {
      await supabase.from("event_logs").insert(payload);
    } catch {
      // silent
    }
  })();
}
