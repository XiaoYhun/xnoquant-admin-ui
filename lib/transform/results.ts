// Derivations from the equity curve. The HFT API exposes only two curve endpoints
// (`/equity-curve`, `/turnover-curve`), so daily PnL, weekday PnL, drawdown and rolling Sharpe
// have to be computed from the equity series rather than fetched.
//
// Aligns with backend helpers: drawdown = equity − running peak (peak seeded at 0);
// rolling Sharpe = mean / population-stddev of equity deltas (not annualized), adaptive window.
//
// Wired: Risk Drawdown (`toDrawdown`); Risk Rolling Sharpe uses live/stream while running and
// `toRollingSharpe` from equity otherwise. Net Daily / Weekly PnL helpers still have no side-panel home.
import type { EquityPoint } from "@/types/domain";

export type DayPoint = { label: string; value: number };
export type LinePoint = { ts: number; value: number };
export type DrawdownPoint = {
  ts: number;
  /** Peak-to-trough as a negative % of the running peak (0 while peak ≤ 0). */
  pct: number;
  /** Absolute drop from the running peak (`equity - peak`, ≤ 0). */
  abs: number;
};

const DAY_MS = 86_400_000;
// Chart x-axis labels render as DD/MM/YY, matching Figma 14876:145754.
export const equityDayLabel = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
};

function pointEquity(p: EquityPoint): { ts: number; equity: number } | null {
  const ts = Number(p.ts);
  const equity = Number(p.equity ?? p.pnl ?? 0);
  if (!Number.isFinite(ts) || !Number.isFinite(equity)) return null;
  return { ts, equity };
}

/** Last equity reading of each calendar day, oldest first. */
function dailyCloses(points: EquityPoint[]): { ts: number; equity: number }[] {
  const byDay = new Map<number, { ts: number; equity: number }>();
  for (const p of points) {
    const row = pointEquity(p);
    if (!row) continue;
    const day = Math.floor(row.ts / DAY_MS);
    const seen = byDay.get(day);
    if (!seen || row.ts >= seen.ts) byDay.set(day, row);
  }
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

/**
 * Net PnL per calendar day — Figma "Net Daily PNL (VND)" (14876:145688). The equity curve is
 * cumulative, so a day's PnL is its close minus the previous day's close; the first day is
 * measured from itself and therefore contributes nothing.
 */
export function toDailyPnl(points: EquityPoint[]): DayPoint[] {
  const closes = dailyCloses(points);
  return closes.slice(1).map((c, i) => ({ label: equityDayLabel(c.ts), value: c.equity - closes[i].equity }));
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thur", "Fri", "Sat", "Sun"] as const;

/**
 * Daily PnL summed by weekday — Figma "Weekly performance (VND)" (14876:146047). Ordered
 * Mon→Sun to match the design's x-axis, not JS's Sunday-first `getDay()`.
 */
export function toWeekdayPnl(points: EquityPoint[]): DayPoint[] {
  const totals = new Array(7).fill(0) as number[];
  const closes = dailyCloses(points);
  for (let i = 1; i < closes.length; i++) {
    const jsDay = new Date(closes[i].ts).getDay(); // 0 = Sunday
    totals[(jsDay + 6) % 7] += closes[i].equity - closes[i - 1].equity;
  }
  return WEEKDAYS.map((label, i) => ({ label, value: totals[i] }));
}

/**
 * Peak-to-trough drawdown along the equity (cumulative realized PnL) curve.
 * Peak is seeded at `0` so an underwater start (equity < 0) reads as drawdown immediately —
 * same as backend `drawdownSeries`.
 */
export function toDrawdown(points: EquityPoint[]): DrawdownPoint[] {
  let peak = 0;
  const out: DrawdownPoint[] = [];
  for (const p of points) {
    const row = pointEquity(p);
    if (!row) continue;
    peak = Math.max(peak, row.equity);
    const abs = row.equity - peak;
    const pct = peak > 0 ? (abs / peak) * 100 : 0;
    out.push({ ts: row.ts, pct, abs });
  }
  return out;
}

/** Successive equity deltas — input to rolling Sharpe (backend `equityDeltas`). */
function equityDeltas(points: EquityPoint[]): { ts: number; delta: number }[] {
  const rows: { ts: number; equity: number }[] = [];
  for (const p of points) {
    const row = pointEquity(p);
    if (row) rows.push(row);
  }
  const out: { ts: number; delta: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    out.push({ ts: rows[i].ts, delta: rows[i].equity - rows[i - 1].equity });
  }
  return out;
}

/**
 * Rolling Sharpe (mean / population-stddev of realized PnL deltas, not annualized — same
 * definition as `sharpe()` in crates/api/src/result.rs) over a trailing window of retained
 * equity-curve points. The window adapts to the run's length so short runs still produce a
 * handful of points; `0` window-stddev (a flat window) reads as `0`, same as the backend.
 */
export function toRollingSharpe(points: EquityPoint[], window?: number): LinePoint[] {
  const deltas = equityDeltas(points);
  const w = window ?? Math.max(3, Math.min(20, Math.floor(deltas.length / 3)));
  if (deltas.length < w) return [];

  const out: LinePoint[] = [];
  for (let i = w - 1; i < deltas.length; i++) {
    const windowVals = deltas.slice(i - w + 1, i + 1).map((d) => d.delta);
    const mean = windowVals.reduce((s, v) => s + v, 0) / w;
    const variance = windowVals.reduce((s, v) => s + (v - mean) ** 2, 0) / w;
    const std = Math.sqrt(variance);
    out.push({ ts: deltas[i].ts, value: std === 0 ? 0 : mean / std });
  }
  return out;
}
