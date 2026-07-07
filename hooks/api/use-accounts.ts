import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGet } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { Account } from "@/types/domain";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => (USE_MOCK ? mockApi.listAccounts() : apiGet<Account[]>(`${HFT_API_URL}/api/accounts`)),
  });
}
