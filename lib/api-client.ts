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

// Raw HFT error bodies aren't enveloped and their shape varies (`{message}`, `{error}`,
// `{detail}`, or a bare string). Extract the best message so 422 business-rule rejections
// surface their caller-facing text instead of a generic reason phrase.
async function throwHftError(res: Response): Promise<never> {
  const text = await res.text().catch(() => "");
  let message = res.statusText;
  if (text) {
    try {
      const body: unknown = JSON.parse(text);
      if (typeof body === "string") message = body;
      else if (body && typeof body === "object") {
        const o = body as { message?: string; error?: string; detail?: string };
        message = o.message ?? o.error ?? o.detail ?? res.statusText;
      }
    } catch {
      message = text;
    }
  }
  throw new ApiError(res.status, message);
}

// Human-facing message for a failed accounts/strategies/runs call, per the RBAC status
// contract (docs/plans/rbac-frontend-plan.html §3): 403 = no access to the whole family;
// 404 = missing OR hidden from you (render as "not found", never "forbidden"); 422 = a
// caller-facing business-rule rejection whose server message is shown verbatim.
export function resourceErrorMessage(err: unknown, resource = "this section"): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return `You don't have access to ${resource}.`;
    if (err.status === 404) return "Not found.";
    if (err.status === 422) return err.message;
  }
  return err instanceof Error && err.message ? err.message : "Something went wrong.";
}
/**
 * React Query retry predicate. 403 (no access to the family) and 404 (missing / hidden from
 * you — see docs/plans/rbac-frontend-plan.html §3) are terminal: retrying can't change them and
 * only delays the empty/error UI. Everything else keeps the normal budget.
 */
export function retryUnlessForbidden(failureCount: number, error: unknown, max = 3): boolean {
  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return false;
  return failureCount < max;
}

export async function apiGet<T>(
  url: string,
  token: string | undefined = useAuthStore.getState().accessToken ?? undefined,
): Promise<T> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) await throwHftError(res);
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
  if (!res.ok) await throwHftError(res);
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
  if (!res.ok) await throwHftError(res);
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
  if (!res.ok) await throwHftError(res);
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
