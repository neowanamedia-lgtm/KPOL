import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * KPOL env presence 진단 — admin 전용.
 *
 * 코드가 의존하는 모든 server-side env 가 set 되어 있는지 boolean 으로 확인.
 * 값은 노출 ✗ (보안). 길이만 hint 로 노출 — 빈 문자열 set 한 경우 구분.
 *
 * 호출:
 *   GET  /api/health/env  (Authorization: Bearer or ?key=)
 *
 * 응답:
 *   {
 *     authSource, env: { KEY: { present: bool, length: number }, ... },
 *     missing: [...], counts: { total, present, missing }
 *   }
 */

interface EnvKeySpec {
  key: string;
  required: "runtime" | "apply-only" | "cron-only";
  description: string;
}

const ENV_SPECS: EnvKeySpec[] = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: "runtime",
    description: "Supabase project URL (client+server).",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: "runtime",
    description: "Supabase anon key (client+server).",
  },
  {
    key: "NEXT_PUBLIC_KPOL_ADMIN_KEY",
    required: "runtime",
    description: "/data-test admin 인증 + Bearer fallback.",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: "apply-only",
    description: "media_rankings rebuild apply 전용 (server-only).",
  },
  {
    key: "YOUTUBE_API_KEY",
    required: "runtime",
    description: "YouTube Data API v3 serviceKey (server-only).",
  },
  {
    key: "NEC_API_KEY",
    required: "runtime",
    description: "NEC 공공데이터포털 serviceKey (server-only).",
  },
  {
    key: "CRON_SECRET",
    required: "cron-only",
    description: "Vercel Cron 자동 인증용 (server-only).",
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = checkAdminAuth(req, url);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const env: Record<
    string,
    { present: boolean; length: number; required: string; description: string }
  > = {};
  const missing: string[] = [];
  const missingRuntime: string[] = [];

  for (const spec of ENV_SPECS) {
    const v = process.env[spec.key];
    const present = typeof v === "string" && v.length > 0;
    env[spec.key] = {
      present,
      length: typeof v === "string" ? v.length : 0,
      required: spec.required,
      description: spec.description,
    };
    if (!present) {
      missing.push(spec.key);
      if (spec.required === "runtime") missingRuntime.push(spec.key);
    }
  }

  const presentCount = ENV_SPECS.length - missing.length;

  return NextResponse.json({
    authSource: auth.source,
    env,
    missing,
    missingRuntime,
    counts: {
      total: ENV_SPECS.length,
      present: presentCount,
      missing: missing.length,
    },
    health:
      missingRuntime.length === 0
        ? "ok"
        : `missing runtime env: ${missingRuntime.join(", ")}`,
    timestamp: new Date().toISOString(),
  });
}
