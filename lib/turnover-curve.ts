// Aggregate `GET /api/runs/{id}/turnover-curve` points for the Cost & Capacity "Turn over time"
// chart. The endpoint is undocumented in OpenAPI; shapes are normalized defensively.

export type TurnoverPoint = {
  ts: number;
  turnover: number;
  /**
   * Traded notional from the start of the run, as the endpoint reports it. The curve is
   * downsampled, so this is NOT the running sum of the retained points' own `turnover` — it is
   * far larger. Optional because the endpoint is undocumented and older shapes omit it.
   */
  cumulative?: number;
};
export type TurnoverPeriod = "Daily" | "Weekly" | "Monthly";
export type TurnoverBar = { label: string; value: number };

const pad = (n: number) => String(n).padStart(2, "0");

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/** Coerce whatever the undocumented endpoint returns into `{ ts, turnover }[]`. */
export function normalizeTurnover(raw: unknown): TurnoverPoint[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { points?: unknown[] }).points)
      ? (raw as { points: unknown[] }).points
      : raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown[] }).data)
        ? (raw as { data: unknown[] }).data
        : [];

  const out: TurnoverPoint[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const ts = num(r.ts) ?? num(r.timestamp) ?? num(r.t) ?? num(r.time);
    const turnover = num(r.turnover) ?? num(r.value) ?? num(r.notional) ?? num(r.volume);
    if (ts === undefined || turnover === undefined) continue;
    out.push({ ts, turnover, cumulative: num(r.cumulative) ?? num(r.cum_turnover) ?? num(r.total) });
  }
  return out;
}

function bucketFor(ms: number, period: TurnoverPeriod): { key: string; label: string } {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  if (period === "Monthly") {
    return { key: `${y}-${m}`, label: `${m}/${String(y).slice(2)}` };
  }
  if (period === "Weekly") {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    const wy = tmp.getUTCFullYear();
    return { key: `${wy}-W${pad(week)}`, label: `W${week} '${String(wy).slice(2)}` };
  }
  // Daily — DD/MM/YY, same convention as equity-derived charts.
  return { key: `${y}-${m}-${day}`, label: `${day}/${m}/${String(y).slice(2)}` };
}

/** Sum turnover into Daily / Weekly / Monthly bars, oldest first. */
export function aggregateTurnover(points: TurnoverPoint[], period: TurnoverPeriod = "Daily"): TurnoverBar[] {
  const buckets = new Map<string, { label: string; value: number; firstAt: number }>();
  for (const p of points) {
    const ts = Number(p.ts);
    const turnover = Number(p.turnover);
    if (!Number.isFinite(ts) || !Number.isFinite(turnover)) continue;
    const { key, label } = bucketFor(ts, period);
    const agg = buckets.get(key) ?? { label, value: 0, firstAt: ts };
    agg.value += turnover;
    agg.firstAt = Math.min(agg.firstAt, ts);
    buckets.set(key, agg);
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.firstAt - b.firstAt)
    .map(({ label, value }) => ({ label, value }));
}
