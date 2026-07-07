const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://api.dev.xnoquant.io";
export const AUTH_API_URL = `${baseUrl}/auth/v1`;
export const XALPHA_API_URL = `${baseUrl}/xalpha-api/v1`;
export const XALPHA_API_URL_V2 = `${baseUrl}/xalpha-api/v2`;
export const HFT_API_URL = process.env.NEXT_PUBLIC_HFT_URL ?? "https://hft-dev.xnoquant.io";
export const USE_MOCK = (process.env.NEXT_PUBLIC_USE_MOCK ?? "true") === "true";
