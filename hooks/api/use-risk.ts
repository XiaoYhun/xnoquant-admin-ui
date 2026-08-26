import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut, retryUnlessForbidden } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import type {
  AccountRiskThreshold,
  PortfolioRiskThreshold,
  ResetRiskRequest,
  RiskAuditEntry,
  RiskStatusResponse,
  RiskThresholdsResponse,
} from "@/types/domain";

// Risk management screen (Figma 14975:41599 / 14975:44103). Raw HFT payloads — no envelope.
//
// Two families with different visibility: `/risk/status` follows the same rule as
// `GET /api/accounts` (you see the accounts you have access to), while `/risk/thresholds`,
// `/risk/audit-log` and every mutation are admin-only and answer 403 otherwise. The screen keeps
// working for a non-admin on status alone — Capital and the log just stay empty.
//
// No mock branch: there is no mock risk store, and the endpoints are the whole point of the
// screen. In mock mode the queries stay disabled so they can't fire at a stub backend.
const EMPTY_STATUS: RiskStatusResponse = {
  portfolio: { level: "ok", drawdown_pct: 0, halted: false },
  accounts: [],
};

/** Live portfolio + per-account drawdown. Recomputed server-side on every call. */
export function useRiskStatus() {
  return useQuery({
    queryKey: ["risk-status"],
    queryFn: () => apiGet<RiskStatusResponse>(`${HFT_API_URL}/api/risk/status`),
    enabled: !USE_MOCK,
    retry: retryUnlessForbidden,
    // Drawdown moves with the running strategies; the monitor recomputes continuously.
    refetchInterval: 5_000,
    placeholderData: EMPTY_STATUS,
  });
}

/** Admin view of every configured threshold — the only source of each account's Capital. */
export function useRiskThresholds() {
  return useQuery({
    queryKey: ["risk-thresholds"],
    queryFn: () => apiGet<RiskThresholdsResponse>(`${HFT_API_URL}/api/risk/thresholds`),
    enabled: !USE_MOCK,
    retry: retryUnlessForbidden,
  });
}

/** The 100 most recent breach/reset events, newest first. */
export function useRiskAuditLog() {
  return useQuery({
    queryKey: ["risk-audit-log"],
    queryFn: () => apiGet<RiskAuditEntry[]>(`${HFT_API_URL}/api/risk/audit-log`),
    enabled: !USE_MOCK,
    retry: retryUnlessForbidden,
  });
}

/**
 * Every mutation invalidates status, thresholds and the log together: a threshold write moves
 * the account's level on the next monitor pass, and a reset lifts the halt and appends audit rows.
 */
function useRiskInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["risk-status"] });
    qc.invalidateQueries({ queryKey: ["risk-thresholds"] });
    qc.invalidateQueries({ queryKey: ["risk-audit-log"] });
  };
}

/**
 * The single portfolio-wide Red threshold. `baseline_equity` is required by the API and is the
 * admin's confirmed total capital — callers pass the existing one back unless they're changing
 * it, since the server only seeds `peak_equity` from it on first creation and leaves the
 * watermark alone afterwards.
 */
export function useSetPortfolioThreshold() {
  const invalidate = useRiskInvalidation();
  return useMutation({
    mutationFn: (body: { red_drawdown_pct: number; baseline_equity: number }) =>
      apiPut<PortfolioRiskThreshold>(`${HFT_API_URL}/api/risk/thresholds/portfolio`, body),
    onSuccess: invalidate,
  });
}

/** Create or update one account's Yellow threshold. Same watermark rule as the portfolio one. */
export function useSetAccountThreshold() {
  const invalidate = useRiskInvalidation();
  return useMutation({
    mutationFn: ({
      accountId,
      ...body
    }: {
      accountId: string;
      yellow_drawdown_pct: number;
      baseline_equity: number;
    }) => apiPut<AccountRiskThreshold>(`${HFT_API_URL}/api/risk/thresholds/accounts/${accountId}`, body),
    onSuccess: invalidate,
  });
}

/** Stop monitoring an account — removes its threshold row entirely. */
export function useDeleteAccountThreshold() {
  const invalidate = useRiskInvalidation();
  return useMutation({
    mutationFn: (accountId: string) =>
      apiDelete(`${HFT_API_URL}/api/risk/thresholds/accounts/${accountId}`),
    onSuccess: invalidate,
  });
}

/**
 * Lift a Red halt. Only callable while the portfolio is actually halted (422 otherwise) — the
 * admin re-baselines the portfolio and every affected account to the real capital they hold after
 * the stop/flatten, which becomes both the new baseline and the new high-water mark.
 */
export function useResetRisk() {
  const invalidate = useRiskInvalidation();
  return useMutation({
    mutationFn: (body: ResetRiskRequest) => apiPost<void>(`${HFT_API_URL}/api/risk/reset`, body),
    onSuccess: invalidate,
  });
}
