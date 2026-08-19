import { useQuery } from "@tanstack/react-query";
import { apiGet, retryUnlessForbidden } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import type { components } from "@/types/api/hft";

export type UserRosterEntry = components["schemas"]["UserRosterEntry"];

// `GET /api/users` — admin-only roster from the local `user_roles` mirror, used to put a name on a
// strategy's `owner_id` (Strategy carries the id only, no username).
//
// The endpoint defaults to `role=trader,pm`, which would leave every other role's strategies
// showing a bare uuid, so every role is requested explicitly. It only lists users who have signed
// in at least once — an accepted limitation of the mirror — so callers must still fall back to the
// raw id.
const ALL_ROLES = "default,contributor,researcher,research-lead,pm,trader,admin";

export function useUserRoster() {
  return useQuery({
    queryKey: ["user-roster"],
    queryFn: async (): Promise<UserRosterEntry[]> => {
      if (USE_MOCK) return [];
      const data = await apiGet<UserRosterEntry[]>(`${HFT_API_URL}/api/users?role=${ALL_ROLES}`);
      return Array.isArray(data) ? data : [];
    },
    retry: retryUnlessForbidden,
    // The roster barely changes and every row on the list reads it.
    staleTime: 5 * 60_000,
  });
}

/** `user_id` → the friendliest label available, falling back to the raw id. */
export function userLabelMap(roster: UserRosterEntry[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const u of roster) {
    const label = u.username?.trim() || u.email?.trim();
    if (label) out.set(u.user_id, label);
  }
  return out;
}
