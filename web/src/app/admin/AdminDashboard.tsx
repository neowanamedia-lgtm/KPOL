"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface LogRow {
  id: string;
  event_type: string;
  event_target: string | null;
  created_at: string;
  is_pwa: boolean | null;
}

interface Stats {
  shareToday: number;
  pwaToday: number;
  categoryTotalToday: number;
  categoryByTarget: Record<string, number>;
  recent: LogRow[];
}

const CATEGORIES = [
  { key: "person", label: "인물" },
  { key: "media", label: "미디어" },
  { key: "by_election", label: "보궐선거" },
  { key: "local_election", label: "지방선거" },
] as const;

const POLL_INTERVAL_MS = 30000;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function todayStartISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function fetchStats(sb: SupabaseClient): Promise<Stats> {
  const since = todayStartISO();
  const baseToday = (eventType: string) =>
    sb
      .from("event_logs")
      .select("*", { count: "exact", head: true })
      .eq("event_type", eventType)
      .gte("created_at", since);

  const [shareRes, pwaRes, catTotalRes] = await Promise.all([
    baseToday("share_click"),
    baseToday("pwa_launch"),
    baseToday("category_click"),
  ]);

  const catEntries = await Promise.all(
    CATEGORIES.map(async (c) => {
      const { count } = await sb
        .from("event_logs")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "category_click")
        .eq("event_target", c.key)
        .gte("created_at", since);
      return [c.key, count ?? 0] as const;
    }),
  );

  const recentRes = await sb
    .from("event_logs")
    .select("id,event_type,event_target,created_at,is_pwa")
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    shareToday: shareRes.count ?? 0,
    pwaToday: pwaRes.count ?? 0,
    categoryTotalToday: catTotalRes.count ?? 0,
    categoryByTarget: Object.fromEntries(catEntries),
    recent: (recentRes.data ?? []) as LogRow[],
  };
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!URL || !ANON) {
      setError("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정");
      return;
    }
    try {
      const sb = createClient(URL, ANON, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const s = await fetchStats(sb);
      setStats(s);
      setLastFetchAt(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <main className="min-h-dvh bg-bg text-fg p-6 font-mono text-[13px] leading-relaxed">
      <header className="flex items-baseline justify-between mb-6">
        <h1 className="text-[20px] font-medium">KPOL Admin</h1>
        <div className="text-fg-dim text-[11px]">
          {lastFetchAt
            ? `갱신 ${lastFetchAt.toLocaleTimeString("ko-KR")} · ${POLL_INTERVAL_MS / 1000}s 폴링`
            : "—"}
        </div>
      </header>

      {error ? (
        <div className="mb-6 p-3 border border-signal-up text-signal-up rounded">
          {error}
        </div>
      ) : null}

      {!stats && !error ? (
        <p className="text-fg-dim">불러오는 중…</p>
      ) : null}

      {stats ? (
        <>
          {/* 오늘 요약 3종 */}
          <section className="grid grid-cols-3 gap-3 mb-8">
            <Stat label="오늘 공유" value={stats.shareToday} />
            <Stat label="오늘 PWA 실행" value={stats.pwaToday} />
            <Stat label="오늘 카테고리 클릭" value={stats.categoryTotalToday} />
          </section>

          {/* 카테고리별 */}
          <section className="mb-8">
            <h2 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
              카테고리별 클릭 (오늘)
            </h2>
            <table className="w-full">
              <tbody>
                {CATEGORIES.map((c) => (
                  <tr key={c.key} className="border-b border-border/40">
                    <td className="py-2 text-fg">{c.label}</td>
                    <td className="py-2 text-fg-dim text-[11px]">{c.key}</td>
                    <td className="py-2 text-right tabular-nums">
                      {stats.categoryByTarget[c.key] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 최근 이벤트 50개 */}
          <section>
            <h2 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
              최근 이벤트 (50)
            </h2>
            <table className="w-full">
              <thead>
                <tr className="text-fg-dim text-[11px] border-b border-border">
                  <th className="text-left py-1.5 font-normal">created_at</th>
                  <th className="text-left py-1.5 font-normal">event_type</th>
                  <th className="text-left py-1.5 font-normal">event_target</th>
                  <th className="text-left py-1.5 font-normal">is_pwa</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((r) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="py-1.5 text-fg-dim tabular-nums">
                      {new Date(r.created_at).toLocaleString("ko-KR", {
                        hour12: false,
                      })}
                    </td>
                    <td className="py-1.5 text-fg">{r.event_type}</td>
                    <td className="py-1.5 text-fg-muted">{r.event_target ?? "—"}</td>
                    <td className="py-1.5 text-fg-muted">
                      {r.is_pwa ? "Y" : r.is_pwa === false ? "N" : "—"}
                    </td>
                  </tr>
                ))}
                {stats.recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-fg-dim text-center">
                      이벤트 없음
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded p-3">
      <div className="text-fg-dim text-[11px] mb-1">{label}</div>
      <div className="text-fg text-[22px] tabular-nums font-medium">{value}</div>
    </div>
  );
}
