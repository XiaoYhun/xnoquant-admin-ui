import type { NextConfig } from "next";

// The HFT API (Rust/Axum at hft-dev.xnoquant.io) does not send CORS headers, so the
// browser can't call it directly from the dev origin. Proxy it through the Next server
// (same-origin for the browser) — the same reverse-proxy trick hft-platform uses via
// nginx/Vite. The request (incl. the `Authorization: Bearer` header) is forwarded upstream.
// NEXT_PUBLIC_HFT_URL is the upstream target; the frontend only ever talks to the `/hft` path.
const HFT_UPSTREAM = process.env.NEXT_PUBLIC_HFT_URL ?? "https://hft-dev.xnoquant.io";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/hft/:path*", destination: `${HFT_UPSTREAM}/:path*` }];
  },
};

export default nextConfig;
