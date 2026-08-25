import { useQuery } from "@tanstack/react-query";
import { apiGet, retryUnlessForbidden } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import { useAuthStore } from "@/store/auth-store";
import type { components } from "@/types/api/hft";

export type Me = components["schemas"]["User"];

// `GET /api/auth/me` — the HFT API validates the Bearer token against the auth service and
// returns the caller's profile. Preferred over the auth service's own `GET /me` because its
// `roles` come from the same `user_roles` mirror the HFT endpoints gate on, so what the UI
// unlocks matches what the API will actually allow.
//
// Under mock there is no HFT backend to ask and no fabricated identity to return, so the query
// stays off and `useAuth` falls back to the session user — sign-in is real either way.
export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<Me>({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<Me>(`${HFT_API_URL}/api/auth/me`),
    enabled: !USE_MOCK && !!accessToken,
    retry: retryUnlessForbidden,
  });
}
