import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import type { PromoteRequest, PromotionStage, StrategyPromotion } from "@/types/domain";

// Promotion baskets — `GET/POST/DELETE /api/promotions/{stage}[/{strategy_id}]`, all admin-only
// (403 otherwise). Replaces the old `/api/live-basket` family, which the API has removed.
//
// A promotion approves a strategy for one STAGE and pins it to the exact `strategies.version`
// that was reviewed. Editing the code bumps `current_version` past `approved_version`, which
// revokes eligibility until someone re-promotes — the "any later edit revokes this approval"
// line in the promote dialog.
//
// The server enforces the whole ladder, so these calls can 422 on sequence as well as on input:
// promoting to `paper` needs a completed backtest run at this exact version, and promoting to
// `live` needs a version-matching `paper` promotion already in place.

/** Every strategy currently promoted to a stage, most recently promoted first. */
export function usePromotions(stage: PromotionStage) {
  return useQuery({
    queryKey: ["promotions", stage],
    queryFn: async (): Promise<StrategyPromotion[]> => {
      if (USE_MOCK) return [];
      const data = await apiGet<StrategyPromotion[]>(`${HFT_API_URL}/api/promotions/${stage}`);
      // Same contract guard as fetchRuns — the Alpha pool maps this straight into rows.
      return Array.isArray(data) ? data : [];
    },
  });
}

/** A promotion stays listed after an edit, but can't launch runs until it's re-promoted. */
export function isApprovalStale(promotion: StrategyPromotion): boolean {
  return promotion.current_version !== promotion.approved_version;
}

export function usePromoteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stage,
      strategyId,
      ...body
    }: PromoteRequest & { stage: PromotionStage; strategyId: string }): Promise<StrategyPromotion | void> => {
      if (USE_MOCK) return;
      return apiPost<StrategyPromotion>(`${HFT_API_URL}/api/promotions/${stage}/${strategyId}`, body);
    },
    // Both baskets are invalidated: promoting to `live` is only legal off a `paper` promotion, so
    // the two lists move together often enough that narrowing this would just cause stale views.
    //
    // The STRATEGY record matters just as much: `paper_approved_version` / `live_approved_version`
    // live on it, and they drive the header stage badge, the Simulate modal's derived mode, the
    // promoted-edit lock and this very button's next rung. Without these the UI keeps claiming
    // "Backtesting" and offering "Promote to paper" after a successful promotion.
    onSuccess: (_promotion, { strategyId }) => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
      qc.invalidateQueries({ queryKey: ["hft-strategies"] });
      qc.invalidateQueries({ queryKey: ["hft-strategy", strategyId] });
    },
  });
}

export function useDemoteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stage, strategyId }: { stage: PromotionStage; strategyId: string }): Promise<void> => {
      if (USE_MOCK) return;
      await apiDelete(`${HFT_API_URL}/api/promotions/${stage}/${strategyId}`);
    },
    // Demoting clears the approval on the strategy record too, so the same views have to refetch.
    onSuccess: (_void, { strategyId }) => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
      qc.invalidateQueries({ queryKey: ["live-runs"] });
      qc.invalidateQueries({ queryKey: ["hft-strategies"] });
      qc.invalidateQueries({ queryKey: ["hft-strategy", strategyId] });
    },
  });
}
