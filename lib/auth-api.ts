import { AUTH_API_URL } from "@/lib/constant";
import type { components } from "@/types/api/auth";

export type User = components["schemas"]["models.User"];
export type TokenData = components["schemas"]["models.TokenData"];

type ApiEnvelope<T> = { data?: T; success?: boolean; message?: string };

async function unwrap<T>(res: Response): Promise<T> {
  const body: ApiEnvelope<T> = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false || body.data === undefined) {
    throw new Error(body.message || res.statusText || "Request failed");
  }
  return body.data;
}

/** GET /auth/token — exchange a Firebase JWT for the backend xq_ access token. */
export async function exchangeToken(firebaseJWT: string): Promise<TokenData> {
  const res = await fetch(`${AUTH_API_URL}/auth/token`, {
    headers: { Authorization: `Bearer ${firebaseJWT}` },
  });
  return unwrap<TokenData>(res);
}

/** DELETE /auth/revoke — revoke the backend access token. Caller should treat as best-effort. */
export async function revokeToken(accessToken: string): Promise<void> {
  await fetch(`${AUTH_API_URL}/auth/revoke`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** GET /me — current authenticated user. */
export async function fetchMe(accessToken: string): Promise<User> {
  const res = await fetch(`${AUTH_API_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<User>(res);
}
