// Derive Execution-tab metrics from a run's trade-cycle console log
// (`/api/runs/{id}/trace/{history,stream}`). Events are order-lifecycle only — no latency or
// slippage fields — so only fill / cancel / order-to-trade figures come from here.
//
// Fill rate matches backend `compute_fill_rate` / `fillRateSeries`: qty-weighted per
// `client_order_id`, clamping each order's filled qty to its requested qty.
import type { TraceEvent } from "@/hooks/api/use-run-trace";

export type TracePeriod = "Daily" | "Weekly" | "Monthly";

export type FillRatePoint = { label: string; value: number };
export type FillRateLinePoint = { ts: number; value: number };

export type TraceExecutionMetrics = {
  /** Qty-weighted filled ÷ requested, 0–100. Null when nothing was submitted with a coid. */
  fillRatePct: number | null;
  /** Submitted orders ÷ filled orders (count-based). Null when nothing filled. */
  orderToTrade: number | null;
  /** Cancelled orders ÷ submitted orders, 0–100. Null when nothing was submitted. */
  cancelRatePct: number | null;
  submitted: number;
  filled: number;
  cancelled: number;
};

/** Normalize PascalCase / snake_case kinds from the stream example vs journal. */
function kindKey(stage: string): string {
  return stage
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

export const isOrderSubmitted = (stage: string) => {
  const k = kindKey(stage);
  return k === "order_submitted" || k.endsWith("_submitted") || k === "submitted";
};

export const isOrderFilled = (stage: string) => {
  const k = kindKey(stage);
  return k === "order_filled" || k === "order_partially_filled" || k.includes("fill");
};

export const isOrderCancelled = (stage: string) => {
  const k = kindKey(stage);
  return k.includes("cancel") || k.includes("reject");
};

/** Qty-weighted fill-rate fraction (0–1) at each submit / fill / partial-fill event. */
export function fillRateSeries(events: TraceEvent[]): FillRateLinePoint[] {
  const requested = new Map<string, number>();
  const filledRaw = new Map<string, number>();
  const out: FillRateLinePoint[] = [];

  for (const e of events) {
    const coid = e.clientOrderId;
    if (!coid) continue;
    const qty = e.qty ?? 0;
    const ts = e.at ?? 0;

    if (isOrderSubmitted(e.stage)) {
      requested.set(coid, qty);
    } else if (isOrderFilled(e.stage)) {
      filledRaw.set(coid, (filledRaw.get(coid) ?? 0) + qty);
    } else {
      continue;
    }

    let requestedTotal = 0;
    let filledTotal = 0;
    for (const [id, reqQty] of requested) {
      requestedTotal += reqQty;
      filledTotal += Math.min(filledRaw.get(id) ?? 0, reqQty);
    }
    if (requestedTotal > 0) {
      out.push({ ts, value: filledTotal / requestedTotal });
    }
  }
  return out;
}

export function deriveTraceExecutionMetrics(events: TraceEvent[]): TraceExecutionMetrics {
  let submitted = 0;
  let filled = 0;
  let cancelled = 0;
  for (const e of events) {
    if (isOrderSubmitted(e.stage)) submitted += 1;
    if (isOrderFilled(e.stage)) filled += 1;
    if (isOrderCancelled(e.stage)) cancelled += 1;
  }

  const series = fillRateSeries(events);
  const fillRatePct =
    series.length > 0 ? Number((series[series.length - 1].value * 100).toFixed(4)) : null;

  return {
    submitted,
    filled,
    cancelled,
    fillRatePct,
    // Need both sides — a fill without a prior submit is a journal quirk, not a 0× ratio.
    orderToTrade: submitted > 0 && filled > 0 ? submitted / filled : null,
    cancelRatePct: submitted > 0 ? (cancelled / submitted) * 100 : null,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Bucket key + short chart label for a timestamp under the chosen period. */
export function bucketFor(ms: number, period: TracePeriod): { key: string; label: string } {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  if (period === "Monthly") {
    return { key: `${y}-${m}`, label: `${y}-${m}` };
  }
  if (period === "Weekly") {
    // ISO-ish week: Monday-based; year of the Thursday.
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    const wy = tmp.getUTCFullYear();
    return { key: `${wy}-W${pad(week)}`, label: `${wy}-W${week}` };
  }
  return { key: `${y}-${m}-${day}`, label: `${y}-${m}-${day}` };
}

/**
 * Qty-weighted fill rate, downsampled to one point per period bucket (last snapshot in that
 * bucket). Values are 0–100 for the Execution chart.
 */
export function deriveFillRateSeries(events: TraceEvent[], period: TracePeriod = "Daily"): FillRatePoint[] {
  const series = fillRateSeries(events);
  if (series.length === 0) return [];

  type Agg = { key: string; label: string; value: number; firstAt: number; lastAt: number };
  const buckets = new Map<string, Agg>();
  let synthetic = 0;

  for (const p of series) {
    let key: string;
    let label: string;
    let at: number;
    if (Number.isFinite(p.ts) && p.ts > 0) {
      ({ key, label } = bucketFor(p.ts, period));
      at = p.ts;
    } else {
      key = `t+${synthetic}`;
      label = `#${synthetic + 1}`;
      at = synthetic;
      synthetic += 1;
    }
    const value = Number((p.value * 100).toFixed(2));
    const prev = buckets.get(key);
    if (!prev) {
      buckets.set(key, { key, label, value, firstAt: at, lastAt: at });
    } else {
      buckets.set(key, {
        key,
        label,
        value: at >= prev.lastAt ? value : prev.value,
        firstAt: Math.min(prev.firstAt, at),
        lastAt: Math.max(prev.lastAt, at),
      });
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.firstAt - b.firstAt)
    .map(({ label, value }) => ({ label, value }));
}
