import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // 개발 중 PWA 비활성 (서비스 워커 캐시로 인한 hot reload 방해 회피).
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Next.js 16 Turbopack 기본 — Serwist는 production build에서만 동작하므로
  // dev에서 webpack/turbopack 충돌 경고를 막기 위해 빈 turbopack 설정 명시.
  turbopack: {},
};

export default withSerwist(nextConfig);
