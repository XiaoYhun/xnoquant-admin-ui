import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete, retryUnlessForbidden } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import type { components } from "@/types/api/hft";

export type AccountAssignment = components["schemas"]["AccountAssignment"];

const assignmentsKey = (accountId: string) => ["account-assignments", accountId] as const;

const fetchAssignments = (accountId: string) =>
  USE_MOCK
    ? Promise.resolve<AccountAssignment[]>([])
    : apiGet<AccountAssignment[]>(`${HFT_API_URL}/api/accounts/${accountId}/assignments`);

/** `GET /api/accounts/:id/assignments` — who currently has access to this account (admin-only). */
export function useAccountAssignments(accountId: string | undefined) {
  return useQuery({
    queryKey: assignmentsKey(accountId ?? ""),
    queryFn: () => fetchAssignments(accountId!),
    enabled: !!accountId,
    retry: retryUnlessForbidden,
  });
}

/**
 * How many accounts each user is assigned to, EXCLUDING `exceptAccountId` (the account being
 * edited — its own pending selection is what decides that side of the count).
 *
 * There is no per-user assignments endpoint, so this fans out one request per account and
 * aggregates client-side. Fine for the admin account list (tens of accounts); revisit if the
 * roster grows. Shares `assignmentsKey` with `useAccountAssignments`, so the open account's
 * list is fetched once.
 */
export function useAssignmentCountsByUser(accountIds: string[], exceptAccountId: string | undefined, enabled: boolean) {
  return useQueries({
    queries: accountIds.map((id) => ({
      queryKey: assignmentsKey(id),
      queryFn: () => fetchAssignments(id),
      enabled,
      retry: retryUnlessForbidden,
      staleTime: 60_000,
    })),
    combine: (results) => {
      const counts = new Map<string, number>();
      results.forEach((r, i) => {
        if (accountIds[i] === exceptAccountId) return;
        for (const a of r.data ?? []) counts.set(a.user_id, (counts.get(a.user_id) ?? 0) + 1);
      });
      return { counts, isPending: results.some((r) => r.isPending) };
    },
  });
}

export function useAssignAccount(accountId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      USE_MOCK
        ? Promise.resolve({} as AccountAssignment)
        : apiPost<AccountAssignment>(`${HFT_API_URL}/api/accounts/${accountId}/assignments`, { user_id: userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account-assignments"] }),
  });
}

export function useRevokeAssignment(accountId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      USE_MOCK
        ? Promise.resolve()
        : apiDelete(`${HFT_API_URL}/api/accounts/${accountId}/assignments/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account-assignments"] }),
  });
}
