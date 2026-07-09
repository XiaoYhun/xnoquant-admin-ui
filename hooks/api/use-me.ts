import { useQuery } from "@tanstack/react-query";
import { fetchMe, type User } from "@/lib/auth-api";
import { useAuthStore } from "@/store/auth-store";

// T19 — GET /auth/v1/me (current user + `roles`). Enabled once the backend access token exists.
// Reusable for later role-gating; `AuthProvider` also logs/exposes the result for browser inspection.
export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<User>({
    queryKey: ["auth", "me"],
    queryFn: () => fetchMe(accessToken as string),
    enabled: !!accessToken,
  });
}
