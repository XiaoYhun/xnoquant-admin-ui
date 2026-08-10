import { describe, it, expect } from "vitest";
import { toPosition } from "./use-run-live";
import {
  toLiveSnapshot,
  mergeLiveSummary,
  mergeLiveTrades,
  preferLiveEquity,
  type LiveSnapshot,
} from "./use-run-live-snapshot";

describe("toPosition", () => {
  it("reads snake_case fields", () => {
    expect(
      toPosition({ symbol_id: 2, side: "buy", qty: 1.5, avg_price: 100, mark_price: 101, unrealized_pnl: 1.5 }),
    ).toEqual({ symbolId: 2, side: "buy", qty: 1.5, avgPrice: 100, markPrice: 101, unrealizedPnl: 1.5 });
  });

  it("treats a flat position as not open", () => {
    expect(toPosition({ symbol_id: 0, qty: 0 })).toBeNull();
  });
});

describe("toLiveSnapshot", () => {
  // Field names taken from the OpenAPI example payload for `/api/runs/{id}/live/stream`.
  const frame = {
    net_pnl: 128.5,
    total_fee: 4.2,
    total_trades: 17,
    sharpe: 1.42,
    sharpe_annualized: 3.11,
    max_drawdown: 32.0,
    max_drawdown_pct: 0.0032,
    return_pct: 0.0128,
    win_rate: 0.588,
    positions: [{ symbol_id: 0, side: "buy", qty: 2 }],
    alpha_timing: { feature_eval_ns_avg: 3000, rhai_eval_ns_max: 3_130_000, samples: 12 },
    updated_at_ms: 1753600000000,
  };

  it("maps every published field", () => {
    const snap = toLiveSnapshot(frame, 999) as LiveSnapshot;
    expect(snap.netPnl).toBe(128.5);
    expect(snap.totalFee).toBe(4.2);
    expect(snap.totalTrades).toBe(17);
    expect(snap.sharpeAnnualized).toBe(3.11);
    expect(snap.maxDrawdownPct).toBe(0.0032);
    expect(snap.winRate).toBe(0.588);
    expect(snap.ts).toBe(1753600000000);
    expect(snap.positions).toHaveLength(1);
    expect(snap.alphaTiming).toMatchObject({ featureEvalAvgNs: 3000, rhaiEvalMaxNs: 3_130_000, samples: 12 });
  });

  it("falls back to receive time when updated_at_ms is absent", () => {
    expect(toLiveSnapshot({ net_pnl: 1 }, 42)?.ts).toBe(42);
  });

  it("yields no alphaTiming when the block is empty or missing", () => {
    expect(toLiveSnapshot({ net_pnl: 1 }, 0)?.alphaTiming).toBeUndefined();
    expect(toLiveSnapshot({ alpha_timing: {} }, 0)?.alphaTiming).toBeUndefined();
  });

  it("drops flat positions and tolerates a missing positions array", () => {
    expect(toLiveSnapshot({ positions: [{ qty: 0 }] }, 0)?.positions).toEqual([]);
    expect(toLiveSnapshot({ net_pnl: 1 }, 0)?.positions).toEqual([]);
  });

  it("returns null for a non-object frame", () => {
    expect(toLiveSnapshot(null, 0)).toBeNull();
    expect(toLiveSnapshot("nope", 0)).toBeNull();
  });

  // Field names below are off a real dev-API frame (2026-08-10), not the spec example, which
  // ships `equity: []` / `symbols: []` and so documents no field names for either.
  it("reads the equity series the charts are drawn from", () => {
    const snap = toLiveSnapshot(
      { equity: [{ ts: 10, equity: -0.5, pnl: -0.5 }, { ts: 20, equity: -1.5, pnl: -1.5 }, { ts: 30 }] },
      0,
    )!;
    // The third row has no equity reading and is not a point.
    expect(snap.equity).toEqual([
      { ts: 10, equity: -0.5, pnl: -0.5 },
      { ts: 20, equity: -1.5, pnl: -1.5 },
    ]);
  });

  it("reads per-symbol PnL attribution", () => {
    const snap = toLiveSnapshot(
      { symbols: [{ symbol_id: 0, signal_pnl: 0.53, spread_capture: 101.1, adverse_selection: 0, total_fee: 7, net_pnl: -6 }] },
      0,
    )!;
    expect(snap.symbols).toEqual([
      { symbolId: 0, signalPnl: 0.53, spreadCapture: 101.1, adverseSelection: 0, totalFee: 7, netPnl: -6 },
    ]);
  });

  it("resolves fill symbols through the manifest map, falling back to the id", () => {
    const frameWithFill = { recent_trades: [{ order_id: 1, symbol_id: 0, fill_ts: 5, fill_price: 10, fill_qty: 1 }] };
    expect(toLiveSnapshot(frameWithFill, 0, { 0: "BTCUSDT" })!.recentTrades[0].symbol).toBe("BTCUSDT");
    expect(toLiveSnapshot(frameWithFill, 0)!.recentTrades[0].symbol).toBe("#0");
  });

  it("tolerates missing equity/symbols arrays", () => {
    const snap = toLiveSnapshot({ net_pnl: 1 }, 0)!;
    expect(snap.equity).toEqual([]);
    expect(snap.symbols).toEqual([]);
  });
});

describe("mergeLiveSummary", () => {
  const summary = {
    artifact_root: "/runs/x",
    cost_bps: 1.1,
    edge_gross_bps: 2.2,
    edge_net_bps: 1.1,
    net_pnl: 0,
    sharpe: 0,
    sharpe_annualized: 0,
    max_drawdown: 0,
    total_fee: 0,
    total_trades: 0,
    win_rate: 0,
  };

  it("overlays the live fields and leaves REST-only fields alone", () => {
    const snap = toLiveSnapshot({ net_pnl: 128.5, sharpe_annualized: 3.11, total_trades: 17 }, 0)!;
    const merged = mergeLiveSummary(summary, snap)!;
    expect(merged.net_pnl).toBe(128.5);
    expect(merged.sharpe_annualized).toBe(3.11);
    expect(merged.total_trades).toBe(17);
    // Not published on the snapshot — must survive untouched.
    expect(merged.edge_gross_bps).toBe(2.2);
    expect(merged.artifact_root).toBe("/runs/x");
  });

  it("does not overwrite a REST value with an absent snapshot field", () => {
    const snap = toLiveSnapshot({ net_pnl: 5 }, 0)!;
    expect(mergeLiveSummary({ ...summary, win_rate: 0.9 }, snap)!.win_rate).toBe(0.9);
  });

  it("passes the summary through when there is no snapshot", () => {
    expect(mergeLiveSummary(summary, undefined)).toBe(summary);
    expect(mergeLiveSummary(undefined, undefined)).toBeUndefined();
  });

  // `/summary` 500s for the whole life of a running run, so this is the normal live path, not an
  // edge case: returning undefined here blanked every metric card while the stream was healthy.
  it("stands in for a missing REST summary", () => {
    const snap = toLiveSnapshot({ net_pnl: 128.5, total_trades: 17 }, 0)!;
    const merged = mergeLiveSummary<Record<string, unknown>>(undefined, snap)!;
    expect(merged.net_pnl).toBe(128.5);
    expect(merged.total_trades).toBe(17);
    // Frame-only summaries simply lack the REST-only fields.
    expect(merged.edge_gross_bps).toBeUndefined();
  });

  it("is undefined when neither source carries a single field", () => {
    expect(mergeLiveSummary(undefined, toLiveSnapshot({}, 0)!)).toBeUndefined();
  });
});

describe("preferLiveEquity", () => {
  const rest = [{ ts: 1, equity: 1, pnl: 1 }];
  const live = [{ ts: 2, equity: 2, pnl: 2 }];

  it("prefers the frame's series and falls back to the persisted curve", () => {
    expect(preferLiveEquity(rest, toLiveSnapshot({ equity: live }, 0)!)).toEqual(live);
    expect(preferLiveEquity(rest, toLiveSnapshot({ equity: [] }, 0)!)).toBe(rest);
    expect(preferLiveEquity(rest, undefined)).toBe(rest);
  });
});

describe("mergeLiveTrades", () => {
  const fill = (orderId: number, ts: number) => ({
    order_id: orderId,
    symbol_id: 0,
    fill_ts: ts,
    fill_price: 10,
    fill_qty: 1,
  });

  it("dedupes a fill carried by both sources and sorts newest first", () => {
    const snap = toLiveSnapshot({ recent_trades: [fill(1, 1000), fill(2, 2000)] }, 0)!;
    const persisted = snap.recentTrades.slice(0, 1); // the same row, already paged in
    const merged = mergeLiveTrades(persisted, snap);
    expect(merged).toHaveLength(2);
    expect(merged[0].time).toBe(new Date(2000).toISOString());
  });

  it("passes the persisted page through when the frame has no fills", () => {
    const persisted = toLiveSnapshot({ recent_trades: [fill(1, 1000)] }, 0)!.recentTrades;
    expect(mergeLiveTrades(persisted, undefined)).toBe(persisted);
  });
});
