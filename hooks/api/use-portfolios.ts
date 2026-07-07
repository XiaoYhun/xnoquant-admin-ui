import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { Portfolio } from "@/types/domain";

export function usePortfolios() {
  return useQuery({
    queryKey: ["portfolios"],
    queryFn: () => (USE_MOCK ? mockApi.listPortfolios() : apiGet<Portfolio[]>(`${HFT_API_URL}/api/portfolios`)),
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; sources: { account_id: string; amount: number }[] }) =>
      USE_MOCK ? mockApi.createPortfolio(input) : apiPost<Portfolio>(`${HFT_API_URL}/api/portfolios`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolios"] }),
  });
}

export function useDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (USE_MOCK ? mockApi.deletePortfolio(id) : apiDelete(`${HFT_API_URL}/api/portfolios/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolios"] }),
  });
}
