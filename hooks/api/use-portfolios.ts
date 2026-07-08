import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";

// GAP-1: Portfolios have NO backend on HFT/XALPHA/AUTH (`domain.Portfolio` is UI-only). These
// three hooks stay on mock regardless of USE_MOCK until a portfolio resource exists — see
// docs/plans/api-integration.md §6 GAP-1. Pointing them at `/api/portfolios` returns 503/404.
export function usePortfolios() {
  return useQuery({
    queryKey: ["portfolios"],
    queryFn: () => mockApi.listPortfolios(),
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; sources: { account_id: string; amount: number }[] }) =>
      mockApi.createPortfolio(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolios"] }),
  });
}

export function useDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mockApi.deletePortfolio(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolios"] }),
  });
}
