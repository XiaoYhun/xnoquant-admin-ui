import type { RiskLevel, RiskStatusResponse } from "@/types/domain";
// The one place the app's "-6.4%" drawdown convention lives (fractions of the high-water mark,
// always rendered as a loss). Imported rather than re-derived so the toasts can't drift from the
// Risk Management table they mirror.
import { pctLabel } from "@/app/(dashboard)/risk-management/risk-bits";

// Event detection for the `/api/risk/status` poll (hooks/api/use-risk.ts, every 5s).
//
// The endpoint reports state, not events — it answers "where is the drawdown right now", and the
// same breach stays in the payload for as long as it lasts. So an alert is an *edge*: it fires on
// the poll where a value changed, and never again until it changes back. Everything here is a
// pure function of two consecutive payloads so it can be tested without a clock or a network.

export type RiskAlert = {
  /** Stable within a batch — used to key the toast and to drop same-poll duplicates. */
  key: string;
  /** Same three levels the API reports; `ok` is a recovery, and reads as good news. */
  severity: RiskLevel;
  title: string;
  detail: string;
};

/**
 * How close to its Yellow threshold an account gets before it earns an early warning. The API has
 * no field for this — it only reports a breach once it has happened — so the near-miss band is
 * derived here: 80% of the configured threshold, e.g. -4% against a -5% limit.
 */
export const NEAR_THRESHOLD_RATIO = 0.8;

const LEVEL_LABEL: Record<RiskLevel, string> = { ok: "Normal", yellow: "Yellow alert", red: "Red alert" };

function drawdownDetail(drawdown: number, threshold: number | null | undefined): string {
  const dd = pctLabel(drawdown) ?? "—";
  const limit = pctLabel(threshold);
  return limit ? `Drawdown ${dd} against a ${limit} threshold` : `Drawdown ${dd}`;
}

/**
 * Every risk event between two consecutive `/api/risk/status` payloads.
 *
 * `prev` is the last payload actually fetched — pass `undefined` on the first one, which
 * establishes the baseline silently. Alerting on first sight instead would fire a wall of toasts
 * for pre-existing breaches on every page load.
 */
export function diffRiskStatus(
  prev: RiskStatusResponse | undefined,
  next: RiskStatusResponse,
): RiskAlert[] {
  if (!prev) return [];
  const alerts: RiskAlert[] = [];

  const before = prev.portfolio;
  const after = next.portfolio;

  // A halt is the severe event: every running strategy was stopped and flattened.
  const halted = after.halted && !before.halted;
  if (halted) {
    alerts.push({
      key: `portfolio-halted-${after.halted_at ?? ""}`,
      severity: "red",
      title: "Portfolio halted",
      detail: after.halted_reason ?? drawdownDetail(after.drawdown_pct, after.red_threshold_pct),
    });
  } else if (before.halted && !after.halted) {
    alerts.push({
      key: "portfolio-resumed",
      severity: "ok",
      title: "Portfolio halt lifted",
      detail: "Trading has resumed.",
    });
  }

  // The halt already said "the portfolio went Red", so don't say it twice on the poll that
  // carries both.
  if (after.level !== before.level && !halted) {
    alerts.push({
      key: `portfolio-level-${after.level}`,
      severity: after.level,
      title: after.level === "ok" ? "Portfolio back to Normal" : `Portfolio → ${LEVEL_LABEL[after.level]}`,
      detail: drawdownDetail(after.drawdown_pct, after.red_threshold_pct),
    });
  }

  const seen = new Map(prev.accounts.map((a) => [a.account_id, a]));
  for (const account of next.accounts) {
    const was = seen.get(account.account_id);
    // Absent from the previous payload: newly created, or newly visible to this caller. Same
    // reasoning as the first-payload baseline — its current state is not an event.
    if (!was) continue;

    if (account.level !== was.level) {
      alerts.push({
        key: `account-${account.account_id}-level-${account.level}`,
        severity: account.level,
        title:
          account.level === "ok"
            ? `${account.account_name} back to Normal`
            : `${account.account_name} → ${LEVEL_LABEL[account.level]}`,
        detail: drawdownDetail(account.drawdown_pct, account.yellow_threshold_pct),
      });
      continue;
    }

    // Early warning, and only while the account is still clean — once it breaches, the level
    // change above is the event worth showing.
    if (account.level === "ok" && account.yellow_threshold_pct != null) {
      const band = account.yellow_threshold_pct * NEAR_THRESHOLD_RATIO;
      const inBand = account.drawdown_pct >= band;
      const wasInBand =
        was.level === "ok" &&
        was.yellow_threshold_pct != null &&
        was.drawdown_pct >= was.yellow_threshold_pct * NEAR_THRESHOLD_RATIO;
      if (inBand && !wasInBand) {
        alerts.push({
          key: `account-${account.account_id}-near`,
          severity: "yellow",
          title: `${account.account_name} nearing its threshold`,
          detail: drawdownDetail(account.drawdown_pct, account.yellow_threshold_pct),
        });
      }
    }
  }

  return alerts;
}
