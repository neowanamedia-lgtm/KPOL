/**
 * KPOL admin route 공통 인증.
 *
 * 3가지 경로 모두 통과:
 *   1) Authorization: Bearer <CRON_SECRET>            ← Vercel Cron 자동
 *   2) Authorization: Bearer <NEXT_PUBLIC_KPOL_ADMIN_KEY>  ← 수동 admin
 *   3) ?key=<NEXT_PUBLIC_KPOL_ADMIN_KEY>              ← /data-test legacy
 *
 * 응답에 어떤 경로로 통과됐는지 source 로 명시 → 운영 진단 가시화.
 */

export type AuthSource = "bearer-cron" | "bearer-admin" | "query-admin";

export type AdminAuthResult =
  | { ok: true; source: AuthSource }
  | { ok: false; status: number; body: { error: string; hint?: string } };

export function checkAdminAuth(req: Request, url: URL): AdminAuthResult {
  const adminKey = process.env.NEXT_PUBLIC_KPOL_ADMIN_KEY;
  const cronSecret = process.env.CRON_SECRET;

  if (!adminKey && !cronSecret) {
    return {
      ok: false,
      status: 500,
      body: {
        error: "NEXT_PUBLIC_KPOL_ADMIN_KEY or CRON_SECRET must be set",
      },
    };
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (cronSecret && token === cronSecret) {
      return { ok: true, source: "bearer-cron" };
    }
    if (adminKey && token === adminKey) {
      return { ok: true, source: "bearer-admin" };
    }
  }

  const qKey = url.searchParams.get("key");
  if (adminKey && qKey && qKey === adminKey) {
    return { ok: true, source: "query-admin" };
  }

  return {
    ok: false,
    status: 403,
    body: {
      error: "forbidden",
      hint:
        "Authorization: Bearer <CRON_SECRET|ADMIN_KEY> 또는 ?key=<ADMIN_KEY>",
    },
  };
}
