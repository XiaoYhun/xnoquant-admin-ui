import { useAuthStore } from "@/store/auth-store";

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
