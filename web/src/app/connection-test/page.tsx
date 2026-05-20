"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface TestResult {
  table: string;
  ok: boolean;
  count: number | null;
  message: string;
}

const TABLES = [
  "people_rankings",
  "by_election_rankings",
  "local_election_rankings",
  "media_rankings",
];

export default function ConnectionTestPage() {
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [envOk, setEnvOk] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    // env 값을 mount 후 sync (SSR/CSR 일치 보장)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnvOk(isSupabaseConfigured);
    if (!isSupabaseConfigured) return;

    (async () => {
      const out: TestResult[] = [];
      for (const table of TABLES) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .order("rank", { ascending: true })
            .limit(5);
          if (error) {
            out.push({ table, ok: false, count: null, message: error.message });
          } else {
            out.push({
              table,
              ok: true,
              count: data?.length ?? 0,
              message: `OK · ${data?.length ?? 0} rows (limit 5)`,
            });
          }
        } catch (e) {
          out.push({
            table,
            ok: false,
            count: null,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      setResults(out);
    })();
  }, []);

  return (
    <main className="min-h-dvh bg-bg text-fg p-6 font-mono text-[13px] leading-relaxed">
      <h1 className="text-[18px] font-medium mb-4">Supabase Connection Test</h1>

      <section className="mb-6">
        <div className="text-fg-dim text-[11px] uppercase tracking-wider mb-1">env</div>
        <div className={envOk ? "text-accent-green" : "text-signal-up"}>
          {envOk ? "OK · URL + ANON KEY set" : "FAIL · env not set"}
        </div>
      </section>

      <section>
        <div className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
          tables (select limit 5, order by rank)
        </div>
        {!envOk ? (
          <p className="text-fg-dim">env 설정 후 새로고침하세요.</p>
        ) : !results ? (
          <p className="text-fg-dim">테스트 중…</p>
        ) : (
          <table className="w-full">
            <tbody>
              {results.map((r) => (
                <tr key={r.table} className="border-b border-border/40">
                  <td className="py-2 text-fg">{r.table}</td>
                  <td className="py-2 text-fg-dim text-[11px]">
                    {r.ok ? (
                      <span className="text-accent-green">{r.message}</span>
                    ) : (
                      <span className="text-signal-up">FAIL · {r.message}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
