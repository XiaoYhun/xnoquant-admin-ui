// `GET /api/runs/{id}/cost-curve` — downsampled cumulative trading-cost (fees).
// Live OpenAPI `CostPoint`: `{ ts, fee, cumulative }`. No per-component split
// (exchange / maker / funding / slippage); callers that need a breakdown only get aggregate fees.
export type CostPoint = {
  /** Epoch ms of the closing fill. */
  ts: number;
  /** This point's own fee increment. */
  fee: number;
  /** Running total fee from the start of the run. */
  cumulative: number;
};

export type CostSeriesPoint = { label: string; fee: number; cumulative: number };

const pad = (n: number) => String(n).padStart(2, "0");

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

export function costDayLabel(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

/** Coerce the undocumented-in-repo (but live) cost-curve payload. */
export function normalizeCostCurve(raw: unknown): CostPoint[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { points?: unknown[] }).points)
      ? (raw as { points: unknown[] }).points
      : [];

  const out: CostPoint[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const ts = num(r.ts) ?? num(r.timestamp) ?? num(r.t);
    const fee = num(r.fee) ?? num(r.total_fee) ?? num(r.value);
    const cumulative = num(r.cumulative) ?? num(r.cum_fee) ?? num(r.total);
    if (ts === undefined || fee === undefined || cumulative === undefined) continue;
    out.push({ ts, fee, cumulative });
  }
  return out;
}

/** Chart-ready series, oldest first. */
export function toCostSeries(points: CostPoint[]): CostSeriesPoint[] {
  return [...points]
    .filter((p) => Number.isFinite(p.ts))
    .sort((a, b) => a.ts - b.ts)
    .map((p) => ({ label: costDayLabel(p.ts), fee: p.fee, cumulative: p.cumulative }));
}

/** Last cumulative fee on the curve, if any. */
export function lastCumulative(points: CostPoint[]): number | null {
  if (points.length === 0) return null;
  let best = points[0];
  for (const p of points) {
    if (p.ts >= best.ts) best = p;
  }
  return Number.isFinite(best.cumulative) ? best.cumulative : null;
}
