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
  // Next.js dev indicator(좌하단 N 배지) 숨김 — 사용자 화면에 개발 흔적 ✗
  devIndicators: false,
  // dev 외부 접근(HMR 포함) 허용 — 모바일이 같은 LAN의 PC IP로 접근 시 필요.
  // 와일드카드로 사설망 흔한 대역 모두 허용 (172.16-31.x, 192.168.x, 10.x).
  allowedDevOrigins: [
    "172.30.1.53",
    "172.30.1.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
    "192.168.*.*",
    "10.*.*.*",
  ],
};

export default withSerwist(nextConfig);
