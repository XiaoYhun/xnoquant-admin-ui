const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://api.dev.xnoquant.io";
export const AUTH_API_URL = `${baseUrl}/auth/v1`;
export const XALPHA_API_URL = `${baseUrl}/xalpha-api/v1`;
export const XALPHA_API_URL_V2 = `${baseUrl}/xalpha-api/v2`;
// Same-origin proxy path (see next.config.ts `rewrites`): the browser hits `/hft/*` on the
// Next server, which forwards to the HFT API upstream (NEXT_PUBLIC_HFT_URL). Avoids CORS since
// HFT sends no headers. Fixed path — coupled to the rewrite `source`, not env-configurable.
export const HFT_API_URL = "/hft";
export const USE_MOCK = (process.env.NEXT_PUBLIC_USE_MOCK ?? "true") === "true";
