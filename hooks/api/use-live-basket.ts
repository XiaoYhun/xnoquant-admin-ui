import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import type { LiveBasketMember, PromoteRequest } from "@/types/domain";

// The "Alpha pool" screen (Figma 14756:46805) is the live basket: one global set of strategies
// an admin has approved for live trading, each pinned to the exact `strategies.version` that was
// reviewed. Editing the strategy's code bumps `current_version` past `approved_version`, which
// revokes eligibility until someone re-promotes — that is the "any later edit to its code will
// revoke this approval" line in the promote dialog. All three endpoints are admin-only (403).

export function useLiveBasket() {
  return useQuery({
    queryKey: ["live-basket"],
    queryFn: async (): Promise<LiveBasketMember[]> => {
      if (USE_MOCK) return [];
      const data = await apiGet<LiveBasketMember[]>(`${HFT_API_URL}/api/live-basket`);
      // Same contract guard as fetchRuns — the Alpha pool maps this straight into rows.
      return Array.isArray(data) ? data : [];
    },
  });
}

/** A member stays listed after an edit, but can't launch live runs until it's re-promoted. */
export function isApprovalStale(member: LiveBasketMember): boolean {
  return member.current_version !== member.approved_version;
}

export function usePromoteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      strategyId,
      ...body
    }: PromoteRequest & { strategyId: string }): Promise<LiveBasketMember | void> => {
      if (USE_MOCK) return;
      return apiPost<LiveBasketMember>(`${HFT_API_URL}/api/live-basket/${strategyId}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-basket"] }),
  });
}

export function useDemoteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (strategyId: string): Promise<void> => {
      if (USE_MOCK) return;
      await apiDelete(`${HFT_API_URL}/api/live-basket/${strategyId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live-basket"] });
      qc.invalidateQueries({ queryKey: ["live-runs"] });
    },
  });
}
