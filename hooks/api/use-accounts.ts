import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { Account } from "@/types/domain";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => (USE_MOCK ? mockApi.listAccounts() : apiGet<Account[]>(`${HFT_API_URL}/api/accounts`)),
  });
}

// Matches HFT `NewAccount` (`fee`/`risk` are optional and left to server defaults here).
export type NewAccountInput = {
  name: string;
  venue_id: string;
  account_type: Account["account_type"];
  api_key: string;
  secret_key: string;
};

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewAccountInput) =>
      USE_MOCK ? mockApi.createAccount(input) : apiPost<Account>(`${HFT_API_URL}/api/accounts`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

// Matches HFT `UpdateAccount` — api_key/secret_key omitted (or blank) keep the stored credentials.
export type UpdateAccountInput = {
  id: string;
  name: string;
  venue_id: string;
  account_type: Account["account_type"];
  api_key?: string;
  secret_key?: string;
};

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateAccountInput) =>
      USE_MOCK ? mockApi.updateAccount(id, input) : apiPut<Account>(`${HFT_API_URL}/api/accounts/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      USE_MOCK ? mockApi.deleteAccount(id) : apiDelete(`${HFT_API_URL}/api/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

// DNSE-venue accounts only — emails a one-time passcode to the account owner, consumed by
// `LaunchRequest.otp_passcode` when launching a DNSE live run. Side-effect only (no stored
// state to invalidate), 204/no body.
export function useSendDnseOtp() {
  return useMutation({
    mutationFn: (id: string) =>
      USE_MOCK ? Promise.resolve() : apiPost<void>(`${HFT_API_URL}/api/accounts/${id}/dnse/send-otp`, undefined),
  });
}
