"use client";
import { useEffect, useRef } from "react";
import { useRiskStatus } from "@/hooks/api/use-risk";
import { diffRiskStatus } from "@/lib/risk-alerts";
import { useToastStore } from "@/store/toast-store";
import type { RiskStatusResponse } from "@/types/domain";

/**
 * Watches `/api/risk/status` for the whole dashboard and raises a toast whenever the risk state
 * moves. Renders nothing.
 *
 * Mounted in the dashboard layout so a breach reaches the admin wherever they are, not only on
 * the Risk Management page. That page calls `useRiskStatus` too, but React Query shares the
 * `["risk-status"]` query — one 5s poll serves both, on any page.
 */
export function RiskAlertWatcher() {
  const { data, isPlaceholderData, isSuccess } = useRiskStatus();
  const push = useToastStore((s) => s.push);
  // The last payload actually fetched, to diff the next one against.
  const previous = useRef<RiskStatusResponse>(undefined);

  useEffect(() => {
    // `useRiskStatus` seeds an empty status as placeholder data. Diffing against that would read
    // every real account as newly appeared, and a recovery to Ok as a change.
    if (!isSuccess || isPlaceholderData || !data) return;
    const alerts = diffRiskStatus(previous.current, data);
    previous.current = data;
    if (alerts.length > 0) push(alerts);
  }, [data, isPlaceholderData, isSuccess, push]);

  return null;
}
