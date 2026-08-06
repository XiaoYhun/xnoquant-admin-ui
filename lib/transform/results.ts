// Derivations from the equity curve. The HFT API exposes only two curve endpoints
// (`/equity-curve`, `/turnover-curve`), so daily PnL, weekday PnL, drawdown and rolling Sharpe
// have to be computed from the equity series rather than fetched.
//
// NOT WIRED YET — nothing imports this. The "Net Daily PNL" / "Weekly performance" charts these
// back are designed on Figma 14876 (the 960-wide full-page backtest-results screen), not on any of
// the six Results side-panel tabs, so there is no component to hang them off. Risk's drawdown and
// rolling-Sharpe charts still run on their own mock series. Delete this file if that screen isn't
// coming; otherwise it is ready to plug in.
import type { EquityPoint } from "@/types/domain";

export type DayPoint = { label: string; value: number };

const DAY_MS = 86_400_000;
// Chart x-axis labels render as DD/MM/YY, matching Figma 14876:145754.
const dayLabel = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
};

/** Last equity reading of each calendar day, oldest first. */
function dailyCloses(points: EquityPoint[]): { ts: number; equity: number }[] {
  const byDay = new Map<number, { ts: number; equity: number }>();
  for (const p of points) {
    const ts = Number(p.ts);
    const equity = Number(p.equity ?? p.pnl ?? 0);
    if (!Number.isFinite(ts) || !Number.isFinite(equity)) continue;
    const day = Math.floor(ts / DAY_MS);
    const seen = byDay.get(day);
    if (!seen || ts >= seen.ts) byDay.set(day, { ts, equity });
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
  return closes.slice(1).map((c, i) => ({ label: dayLabel(c.ts), value: c.equity - closes[i].equity }));
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

/** Peak-to-trough drawdown as a negative percentage of the running peak. */
export function toDrawdown(points: EquityPoint[]): { ts: number; value: number }[] {
  let peak = -Infinity;
  return points.map((p) => {
    const equity = Number(p.equity ?? p.pnl ?? 0);
    peak = Math.max(peak, equity);
    // Equity here is cumulative PnL, so it starts at ~0 and a ratio against the peak is
    // meaningless until the peak is positive. Report 0 rather than a divide-by-zero spike.
    const value = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
    return { ts: Number(p.ts), value };
  });
}

/**
 * Rolling annualised Sharpe over a trailing window of daily returns. Returns fewer points than
 * it is given — the first `window` days can't be scored.
 */
export function toRollingSharpe(points: EquityPoint[], window = 30): DayPoint[] {
  const closes = dailyCloses(points);
  const returns = closes.slice(1).map((c, i) => c.equity - closes[i].equity);
  if (returns.length <= window) return [];
  const out: DayPoint[] = [];
  for (let i = window; i < returns.length; i++) {
    const slice = returns.slice(i - window, i);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
    const sd = Math.sqrt(variance);
    out.push({ label: dayLabel(closes[i + 1].ts), value: sd === 0 ? 0 : (mean / sd) * Math.sqrt(252) });
  }
  return out;
}
