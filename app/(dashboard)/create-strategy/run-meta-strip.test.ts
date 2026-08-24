import { describe, it, expect } from "vitest";
import type { Run } from "@/types/domain";
import { runMetaSegments } from "./run-meta-strip";

// Minimal manifest — the strip only reads symbols / data_kind / account / backtest_range.
type Overrides = Omit<Partial<Run>, "manifest"> & { manifest?: Partial<Run["manifest"]> };

/** A manifest symbol is mostly ids the strip never reads — only the ticker matters here. */
const sym = (symbol: string) => ({ symbol }) as Run["manifest"]["symbols"][number];

function makeRun(overrides: Overrides = {}): Run {
  const { manifest, ...rest } = overrides;
  return {
    id: "run-1",
    created_at: "2026-08-20T07:00:00Z",
    updated_at: "2026-08-20T07:00:00Z",
    mode: "paper",
    status: "running",
    owner_id: "u1",
    in_session_blackout: false,
    needs_otp: false,
    manifest: {
      mode: "paper",
      strategy: { id: "s1", name: "S", code: "", strategy_type: "taker" },
      account: {
        id: "a1",
        name: "main-1",
        account_type: "linear_futures",
        venue_id: "v1",
        venue_name: "Binance Futures",
        venue_type: "binance_futures",
      },
      symbols: [],
      data_kind: { kind: "tick" },
      ...manifest,
    },
    ...rest,
  } as Run;
}

const text = (run: Run, now?: number) => runMetaSegments(run, now).map((s) => s.text);

describe("runMetaSegments", () => {
  it("has nothing to say without a run", () => {
    expect(runMetaSegments(undefined)).toEqual([]);
  });

  it("names one symbol outright and counts the rest", () => {
    const one = makeRun({ manifest: { symbols: [sym("BTCUSDT")] } });
    expect(text(one)[0]).toBe("BTCUSDT");
    expect(runMetaSegments(one)[0].tip).toBe("Symbol");

    const many = makeRun({
      manifest: { symbols: [sym("BTCUSDT"), sym("ETHUSDT"), sym("SOLUSDT")] },
    });
    const [symbols] = runMetaSegments(many);
    expect(symbols.text).toBe("BTCUSDT +2");
    // The tickers hidden behind "+2" are only recoverable from the tip.
    expect(symbols.tip).toBe("Symbols: BTCUSDT, ETHUSDT, SOLUSDT");
  });

  it("reads the engine off data_kind — tick is HFT, bars are MFT", () => {
    expect(text(makeRun())).toContain("HFT tick data");
    expect(text(makeRun({ manifest: { data_kind: { kind: "bar", interval: "5m" } } }))).toContain("MFT 5min bars");
  });

  // `strategyGroup` defaults to MFT, so an absent data_kind must drop the segment rather than
  // claim the run was MFT.
  it("drops the engine segment when the manifest has no data_kind", () => {
    expect(text(makeRun({ manifest: { data_kind: undefined } }))).toEqual(["main-1 @ Binance Futures (USDT)"]);
  });

  it("names the venue, account and settlement currency", () => {
    expect(text(makeRun())).toContain("main-1 @ Binance Futures (USDT)");
    const vn = makeRun({
      manifest: {
        account: {
          id: "a2",
          name: "dnse-1",
          account_type: "linear_futures",
          venue_id: "v2",
          venue_name: "DNSE",
          venue_type: "dnse",
        },
      },
    });
    expect(text(vn)).toContain("dnse-1 @ DNSE (VND)");
  });

  it("shows a backtest's replayed window, with the repeated year dropped", () => {
    const run = makeRun({
      mode: "backtest",
      manifest: { mode: "backtest", backtest_range: { start_date: "2026-06-01", end_date: "2026-08-01" } },
    });
    expect(text(run)).toContain("Jun 1 → Aug 1, 2026 (62 days)");
  });

  // "Jul 23, 2026 → Jul 23, 2026" read like a bug rather than a one-day backtest.
  it("collapses a same-day backtest window to one date", () => {
    const run = makeRun({
      mode: "backtest",
      manifest: { mode: "backtest", backtest_range: { start_date: "2026-07-23", end_date: "2026-07-23" } },
    });
    expect(text(run)).toContain("Jul 23, 2026 (1 day)");
  });

  it("spells out a window that spans two years", () => {
    const run = makeRun({
      mode: "backtest",
      manifest: { mode: "backtest", backtest_range: { start_date: "2025-12-30", end_date: "2026-01-02" } },
    });
    expect(text(run)).toContain("Dec 30, 2025 → Jan 2, 2026 (4 days)");
  });

  it("runs to 'now' until they stop", () => {
    const started = makeRun({ started_at: "2026-08-20T07:00:00Z" });
    const now = Date.parse("2026-08-23T07:00:00Z");
    expect(text(started, now).at(-1)).toContain("→ now (3 days)");

    const stopped = makeRun({ started_at: "2026-08-20T07:00:00Z", stopped_at: "2026-08-20T11:00:00Z" });
    expect(text(stopped, now).at(-1)).toContain("(4 hours)");
    expect(text(stopped, now).at(-1)).not.toContain("now");
  });

  it("drops the window when the run never started", () => {
    expect(text(makeRun({ started_at: null }))).toEqual(["HFT tick data", "main-1 @ Binance Futures (USDT)"]);
  });
});
