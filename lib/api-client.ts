import { useAuthStore } from "@/store/auth-store";
import type { components } from "@/types/api/xalpha";

// Envelope rule: HFT_API_URL responses are raw (bare arrays/objects) — use
// apiGet/apiPost/apiPut/apiDelete. XALPHA_API_URL[_V2] and AUTH_API_URL
// responses are wrapped in `models.DefaultResponseModel` — use
// apiGetData/apiPostData/apiPutData (and apiGetPage for paginated lists),
// which unwrap `.data` for you. Never unwrap `.data` for HFT.

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function apiGet<T>(
  url: string,
  token: string | undefined = useAuthStore.getState().accessToken ?? undefined,
): Promise<T> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.json() as Promise<T>;
}
export async function apiPost<T>(
  url: string,
  body: unknown,
  token: string | undefined = useAuthStore.getState().accessToken ?? undefined,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  if (res.status === 204) return undefined as T; // no-content responses (e.g. DNSE send-otp) have no body to parse
  return res.json() as Promise<T>;
}
export async function apiPut<T>(
  url: string,
  body: unknown,
  token: string | undefined = useAuthStore.getState().accessToken ?? undefined,
): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.json() as Promise<T>;
}
export async function apiDelete(
  url: string,
  token: string | undefined = useAuthStore.getState().accessToken ?? undefined,
): Promise<void> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
}

// ---- Enveloped-API helpers (XALPHA / AUTH only — do NOT use for HFT) ----

// `models.DefaultResponseModel` — identical shape in types/api/auth.ts and
// types/api/xalpha.ts — narrowed to the payload type T.
type Envelope<T> = components["schemas"]["models.DefaultResponseModel"] & { data?: T };
type Pagination = components["schemas"]["models.Pagination"];

async function throwEnvelopeError(res: Response): Promise<never> {
  const body: { message?: string } | undefined = await res.json().catch(() => undefined);
  throw new ApiError(res.status, body?.message ?? res.statusText);
}

/** GET for enveloped APIs (XALPHA/AUTH). Returns the unwrapped `.data`. */
export async function apiGetData<T>(
  url: string,
  token: string | undefined = useAuthStore.getState().accessToken ?? undefined,
): Promise<T> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) await throwEnvelopeError(res);
  const env: Envelope<T> = await res.json();
  return env.data as T;
}

/** POST for enveloped APIs (XALPHA/AUTH). Returns the unwrapped `.data`. */
export async function apiPostData<T>(
  url: string,
  body: unknown,
  token: string | undefined = useAuthStore.getState().accessToken ?? undefined,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwEnvelopeError(res);
  const env: Envelope<T> = await res.json();
  return env.data as T;
}

/** PUT for enveloped APIs (XALPHA/AUTH). Returns the unwrapped `.data`. */
export async function apiPutData<T>(
  url: string,
  body: unknown,
  token: string | undefined = useAuthStore.getState().accessToken ?? undefined,
): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwEnvelopeError(res);
  const env: Envelope<T> = await res.json();
  return env.data as T;
}

/**
 * GET for paginated enveloped list endpoints (e.g. XALPHA `GET /v1/strategies`).
 * Returns the unwrapped `.data` alongside `.pagination`.
 */
export async function apiGetPage<T>(
  url: string,
  token: string | undefined = useAuthStore.getState().accessToken ?? undefined,
): Promise<{ data: T; pagination?: Pagination }> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) await throwEnvelopeError(res);
  const env: Envelope<T> = await res.json();
  return { data: env.data as T, pagination: env.pagination };
}
