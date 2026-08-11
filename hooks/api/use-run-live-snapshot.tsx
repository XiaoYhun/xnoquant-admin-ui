"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth-store";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import { toPosition, type OpenPosition } from "./use-run-live";
import type { TradeHistoryRow } from "@/lib/mock/paper-runs";
import type { EquityPoint } from "@/types/domain";

// ONE `/api/runs/{id}/live/stream` subscription per run, shared by every view that needs live
// numbers. The endpoint sends the current cached snapshot first, then one frame per published
// update, so a subscriber needs no separate priming fetch.
//
// Why a provider and not a plain hook: all six Results views mount under the same tab and each
// wants a slice of the same frame. A per-view hook would open six concurrent SSE connections to
// the same endpoint for one run.
//
// The frame is UNTYPED in the OpenAPI spec (`text/event-stream: string`); the field names below
// come from the spec's own example payload — confirmed against a real frame off the dev API on
// 2026-08-10 — and every read is defensive.
//
// This stream is the ONLY working source while a run is running: every persisted-artifact endpoint
// (`/summary`, `/equity-curve`, `/cost-curve`, `/trades`) answers 500 mid-run, because the parquet
// sidecar is still being written ("Invalid Parquet file. Corrupt footer"). The reference UI at
// hft-dev.xnoquant.io therefore fetches ONLY `/api/runs/{id}` + `/live/stream` + `/trace/stream`
// for a running run and derives every chart from the frame — which is why the frame carries a full
// `equity` series and per-symbol PnL, not just scalars.

/** Per-stage engine timing, in nanoseconds, from the snapshot's `alpha_timing`. */
export type AlphaTiming = {
  featureEvalAvgNs?: number;
  featureEvalMaxNs?: number;
  featureEvalLastNs?: number;
  rhaiEvalAvgNs?: number;
  rhaiEvalMaxNs?: number;
  rhaiEvalLastNs?: number;
  samples?: number;
};

/** One `symbols` entry — the per-symbol PnL attribution the run publishes on every frame. */
export type LiveSymbolPnl = {
  symbolId?: number;
  signalPnl?: number;
  spreadCapture?: number;
  adverseSelection?: number;
  totalFee?: number;
  netPnl?: number;
};

/**
 * One `orderbooks[].bids`/`asks` entry. Named distinctly from `lib/mock/orderbook.ts`'s
 * `OrderbookLevel` (a different shape: `{amountBuy, priceBuy, priceSell, amountSell}`) so the two
 * don't collide where a caller imports both.
 */
export type LiveOrderbookLevel = { price: number; qty: number };

/** One `orderbooks` entry — the depth ladder for a single symbol in the run. */
export type LiveOrderbook = { symbolId: number; bids: LiveOrderbookLevel[]; asks: LiveOrderbookLevel[] };

export type LiveSnapshot = {
  netPnl?: number;
  totalFee?: number;
  totalTrades?: number;
  sharpe?: number;
  sharpeAnnualized?: number;
  maxDrawdown?: number;
  maxDrawdownPct?: number;
  returnPct?: number;
  winRate?: number;
  positions: OpenPosition[];
  /** `recent_trades`, shaped like the REST `/trades` rows so the two can be merged. */
  recentTrades: TradeHistoryRow[];
  /**
   * `equity` — the run's cumulative-realized-PnL curve, same shape as the REST `/equity-curve`
   * rows so the `lib/transform/results` derivations run on either source unchanged.
   */
  equity: EquityPoint[];
  /** `symbols` — per-symbol PnL attribution. */
  symbols: LiveSymbolPnl[];
  /** `orderbooks` — per-symbol bid/ask depth. */
  orderbooks: LiveOrderbook[];
  alphaTiming?: AlphaTiming;
  /** `updated_at_ms` from the snapshot, else receive time. */
  ts: number;
};

/** One rolling-Sharpe sample; the Risk chart needs the series, not just the latest frame. */
export type LiveSharpeSample = { ts: number; sharpe: number };

export type LiveStreamState = "off" | "connecting" | "open" | "error";

/**
 * `symbol_id` → display name, read off the run manifest. Frames carry only the dense engine index
 * (`symbol_id: 0`), never the ticker, so without this a fill renders as "#0" instead of "BTCUSDT".
 */
export type SymbolNames = Record<number, string>;

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

function toAlphaTiming(raw: unknown): AlphaTiming | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const timing: AlphaTiming = {
    featureEvalAvgNs: num(r.feature_eval_ns_avg),
    featureEvalMaxNs: num(r.feature_eval_ns_max),
    featureEvalLastNs: num(r.feature_eval_ns_last),
    rhaiEvalAvgNs: num(r.rhai_eval_ns_avg),
    rhaiEvalMaxNs: num(r.rhai_eval_ns_max),
    rhaiEvalLastNs: num(r.rhai_eval_ns_last),
    samples: num(r.samples),
  };
  // An all-empty timing block is the same as none at all — let callers render "—".
  return Object.values(timing).some((v) => v !== undefined) ? timing : undefined;
}

/**
 * One `recent_trades` entry, normalized to the same `TradeHistoryRow` the REST `/trades` page
 * produces. The spec's example ships `recent_trades: []`, so no field names are documented —
 * these follow the persisted `TradeRow` schema (`fill_ts`/`fill_price`/`fill_qty`/`mid_at_fill`)
 * with camelCase and short aliases tolerated.
 *
 * The `id` is built exactly as `toTradeHistoryRow` builds it, so a fill that appears both on the
 * stream and in the persisted page dedupes to one row instead of showing twice.
 */
export function toLiveTradeRow(raw: unknown, symbolNames?: SymbolNames): TradeHistoryRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ts = num(r.fill_ts) ?? num(r.fillTs) ?? num(r.ts_ms) ?? num(r.ts) ?? num(r.time);
  const price = num(r.fill_price) ?? num(r.fillPrice) ?? num(r.price);
  const qty = num(r.fill_qty) ?? num(r.fillQty) ?? num(r.qty) ?? num(r.quantity);
  // A row with no price or size isn't a fill.
  if (price === undefined || qty === undefined) return null;
  const orderId = num(r.order_id) ?? num(r.orderId) ?? str(r.order_id) ?? str(r.orderId);
  const symbolId = num(r.symbol_id) ?? num(r.symbolId);
  return {
    id: `${orderId ?? "live"}-${ts ?? 0}`,
    time: ts !== undefined ? new Date(ts).toISOString() : "",
    // Live frames carry only the manifest index, not the name — resolve it when the caller
    // supplied the run's map, and fall back to "#0" when it hasn't loaded yet.
    symbol:
      str(r.symbol) ??
      str(r.symbol_name) ??
      (symbolId !== undefined ? (symbolNames?.[symbolId] ?? `#${symbolId}`) : "—"),
    side: str(r.side) ?? str(r.direction) ?? "—",
    price,
    qty,
    mid: num(r.mid_at_fill) ?? num(r.midAtFill) ?? num(r.mid) ?? 0,
    outcome: str(r.outcome) ?? str(r.status) ?? "Filled",
  };
}

/** One `equity` entry, normalized to the REST `EquityPoint` the transforms already consume. */
export function toLiveEquityPoint(raw: unknown): EquityPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ts = num(r.ts) ?? num(r.ts_ms) ?? num(r.time);
  // `equity` and `pnl` are the same cumulative series on this endpoint; either one suffices.
  const equity = num(r.equity) ?? num(r.pnl);
  if (ts === undefined || equity === undefined) return null;
  return { ts, equity, pnl: num(r.pnl) ?? equity };
}

/** One `symbols` entry — per-symbol PnL attribution. */
export function toLiveSymbolPnl(raw: unknown): LiveSymbolPnl | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    symbolId: num(r.symbol_id) ?? num(r.symbolId),
    signalPnl: num(r.signal_pnl) ?? num(r.signalPnl),
    spreadCapture: num(r.spread_capture) ?? num(r.spreadCapture),
    adverseSelection: num(r.adverse_selection) ?? num(r.adverseSelection),
    totalFee: num(r.total_fee) ?? num(r.totalFee),
    netPnl: num(r.net_pnl) ?? num(r.netPnl),
  };
}

/** One `orderbooks[].bids`/`asks` entry. */
export function toLiveOrderbookLevel(raw: unknown): LiveOrderbookLevel | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const price = num(r.price);
  const qty = num(r.qty) ?? num(r.quantity) ?? num(r.size);
  if (price === undefined || qty === undefined) return null;
  return { price, qty };
}

/** One `orderbooks` entry — a symbol's bid/ask depth. */
export function toLiveOrderbook(raw: unknown): LiveOrderbook | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const symbolId = num(r.symbol_id) ?? num(r.symbolId);
  // Without a symbol_id there is no way to bind this book to a chosen symbol.
  if (symbolId === undefined) return null;
  const bids = Array.isArray(r.bids)
    ? r.bids.map(toLiveOrderbookLevel).filter((l): l is LiveOrderbookLevel => l !== null)
    : [];
  const asks = Array.isArray(r.asks)
    ? r.asks.map(toLiveOrderbookLevel).filter((l): l is LiveOrderbookLevel => l !== null)
    : [];
  return { symbolId, bids, asks };
}

export function toLiveSnapshot(
  raw: unknown,
  receivedAt: number,
  symbolNames?: SymbolNames,
): LiveSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const positions = Array.isArray(r.positions)
    ? r.positions.map(toPosition).filter((p): p is OpenPosition => p !== null)
    : [];
  const recentTrades = Array.isArray(r.recent_trades)
    ? r.recent_trades
        .map((t) => toLiveTradeRow(t, symbolNames))
        .filter((t): t is TradeHistoryRow => t !== null)
    : [];
  const equity = Array.isArray(r.equity)
    ? r.equity.map(toLiveEquityPoint).filter((p): p is EquityPoint => p !== null)
    : [];
  const symbols = Array.isArray(r.symbols)
    ? r.symbols.map(toLiveSymbolPnl).filter((s): s is LiveSymbolPnl => s !== null)
    : [];
  const orderbooks = Array.isArray(r.orderbooks)
    ? r.orderbooks.map(toLiveOrderbook).filter((o): o is LiveOrderbook => o !== null)
    : [];
  return {
    equity,
    symbols,
    orderbooks,
    netPnl: num(r.net_pnl),
    totalFee: num(r.total_fee),
    totalTrades: num(r.total_trades),
    sharpe: num(r.sharpe),
    sharpeAnnualized: num(r.sharpe_annualized),
    maxDrawdown: num(r.max_drawdown),
    maxDrawdownPct: num(r.max_drawdown_pct),
    returnPct: num(r.return_pct),
    winRate: num(r.win_rate),
    positions,
    recentTrades,
    alphaTiming: toAlphaTiming(r.alpha_timing),
    ts: num(r.updated_at_ms) ?? receivedAt,
  };
}

export type LiveSnapshotValue = {
  /** Latest frame, or undefined until one arrives / when the run isn't live. */
  snapshot?: LiveSnapshot;
  /** Sharpe over time, one entry per frame that carried a Sharpe. */
  sharpeSamples: LiveSharpeSample[];
  state: LiveStreamState;
};

const EMPTY: LiveSnapshotValue = { snapshot: undefined, sharpeSamples: [], state: "off" };

/** Reconnect backoff after a dropped stream — the same fixed delay the reference client uses. */
const RETRY_MS = 2000;

const LiveSnapshotContext = createContext<LiveSnapshotValue>(EMPTY);

/**
 * Tails the live snapshot stream. `EventSource` can't send an Authorization header, so SSE frames
 * are read off a fetch body and parsed by hand — same framing as `useRunTraceStream`.
 */
function useLiveSnapshotStream(
  runId: string | undefined,
  enabled: boolean,
  symbolNames?: SymbolNames,
): LiveSnapshotValue {
  // SUBSCRIBE to the token rather than reading it once: on a fresh load the panel mounts before
  // AuthProvider has exchanged the Firebase session, and a one-shot read would send no header,
  // get a 401, and leave the stream dead with nothing to re-trigger the effect.
  const accessToken = useAuthStore((st) => st.accessToken);
  const streamKey = runId && enabled && !USE_MOCK && accessToken ? runId : undefined;
  const [snapshot, setSnapshot] = useState<LiveSnapshot | undefined>(undefined);
  const [sharpeSamples, setSharpeSamples] = useState<LiveSharpeSample[]>([]);
  const [state, setState] = useState<LiveStreamState>(() => (streamKey ? "connecting" : "off"));
  // Reset during render (not in the effect) when the tailed run changes, so one run's numbers
  // never bleed into the next one.
  const [prevKey, setPrevKey] = useState(streamKey);
  if (prevKey !== streamKey) {
    setPrevKey(streamKey);
    setSnapshot(undefined);
    setSharpeSamples([]);
    setState(streamKey ? "connecting" : "off");
  }

  // The run manifest that names the symbols can land after the stream is already open. Hold it in
  // a ref so a late map doesn't re-run the effect, tear the connection down, and lose the
  // accumulated Sharpe series.
  const namesRef = useRef(symbolNames);
  useEffect(() => {
    namesRef.current = symbolNames;
  }, [symbolNames]);

  useEffect(() => {
    if (!streamKey) return;
    const controller = new AbortController();
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function connect() {
      let terminal = false;
      try {
        const res = await fetch(`${HFT_API_URL}/api/runs/${runId}/live/stream`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        // Auth/visibility failures can't be fixed by retrying — everything else can.
        terminal = res.status === 401 || res.status === 403 || res.status === 404;
        if (!res.ok || !res.body) throw new Error(`live stream ${res.status}`);
        setState("open");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Frames are separated by a blank line; split on CRLF *or* LF, since an \r\n\r\n
          // separator contains no "\n\n" and would otherwise never yield a frame.
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:")) continue;
              try {
                const next = toLiveSnapshot(JSON.parse(line.slice(5).trim()), Date.now(), namesRef.current);
                if (!next) continue;
                setSnapshot(next);
                const sharpe = next.sharpeAnnualized ?? next.sharpe;
                if (sharpe !== undefined) {
                  setSharpeSamples((prev) => [...prev, { ts: next.ts, sharpe }]);
                }
              } catch {
                // A malformed frame shouldn't kill the tail.
              }
            }
          }
        }
      } catch {
        // Aborted on unmount, or the stream dropped / never opened.
      }
      if (cancelled) return;
      // Reconnect on a fixed backoff, which is what `EventSource` would do for us if it could
      // carry an Authorization header — the reference client does the same. Without it a single
      // drop froze the run on its last frame until the tab remounted. A run that ends server-side
      // also closes the stream, so this keeps ticking harmlessly until the view unmounts.
      setState(terminal ? "error" : "connecting");
      if (!terminal) retry = setTimeout(connect, RETRY_MS);
    }
    connect();

    return () => {
      cancelled = true;
      controller.abort();
      if (retry) clearTimeout(retry);
    };
  }, [runId, streamKey, accessToken]);

  return { snapshot, sharpeSamples, state };
}

/** Opens the single shared stream for `runId` and publishes it to descendants. */
export function LiveSnapshotProvider({
  runId,
  isLive,
  symbolNames,
  children,
}: {
  runId: string | undefined;
  isLive: boolean;
  /** `symbol_id` → ticker, from the run manifest; without it live fills render as "#0". */
  symbolNames?: SymbolNames;
  children: ReactNode;
}) {
  const value = useLiveSnapshotStream(runId, isLive, symbolNames);
  return <LiveSnapshotContext.Provider value={value}>{children}</LiveSnapshotContext.Provider>;
}

/**
 * Reads the shared live snapshot. Outside a provider it returns the "off" value, so a view can be
 * mounted standalone (or for a finished run) without special-casing.
 */
export function useLiveSnapshot(): LiveSnapshotValue {
  return useContext(LiveSnapshotContext);
}

/**
 * Overlay a live frame onto the REST `/summary` so the views that already read `RunSummary` show
 * live numbers without restructuring. Every snapshot field maps onto a `RunSummary` field of the
 * same name.
 *
 * With NO REST summary this still returns the frame's fields on their own. That case is the norm,
 * not an edge: `/summary` answers 500 for the whole life of a running run (the parquet sidecar is
 * mid-write), and returning `undefined` there blanked every metric on Overview, Performance and
 * Cost & Capacity while a healthy stream was delivering the numbers.
 *
 * The four fields the frame does NOT publish — `artifact_root`, `cost_bps`, `edge_gross_bps`,
 * `edge_net_bps` — are simply absent in that case, exactly as they are before `/summary` resolves,
 * so callers that read them already handle the gap.
 */
export function mergeLiveSummary<T extends Record<string, unknown>>(
  summary: T | undefined,
  snapshot: LiveSnapshot | undefined,
): T | undefined {
  if (!snapshot) return summary;
  const live: Record<string, unknown> = {};
  const put = (key: string, value: number | undefined) => {
    if (value !== undefined) live[key] = value;
  };
  put("net_pnl", snapshot.netPnl);
  put("total_fee", snapshot.totalFee);
  put("total_trades", snapshot.totalTrades);
  put("sharpe", snapshot.sharpe);
  put("sharpe_annualized", snapshot.sharpeAnnualized);
  put("max_drawdown", snapshot.maxDrawdown);
  put("max_drawdown_pct", snapshot.maxDrawdownPct);
  put("return_pct", snapshot.returnPct);
  put("win_rate", snapshot.winRate);
  // No REST summary: the frame's own fields ARE the summary. `as T` is the same widening the
  // overlay branch performs — callers read `RunSummary` fields, all of which are optional here.
  if (!summary) return (Object.keys(live).length > 0 ? live : undefined) as T | undefined;
  return { ...summary, ...live };
}

/**
 * The equity series to chart: the live frame's when it has one, else the persisted `/equity-curve`.
 *
 * Same reason as `mergeLiveSummary` — `/equity-curve` 500s for the whole life of a running run, so
 * a live run had no curve to draw at all. The frame's `equity` spans the whole run (it is the same
 * cumulative-realized-PnL series, downsampled), so every derivation in `lib/transform/results`
 * works on it unchanged.
 */
export function preferLiveEquity(
  restEquity: EquityPoint[],
  snapshot: LiveSnapshot | undefined,
): EquityPoint[] {
  return snapshot?.equity.length ? snapshot.equity : restEquity;
}

/**
 * Persisted `/trades` rows plus the frame's `recent_trades`, newest first. `toLiveTradeRow` builds
 * the same `id` as the REST transform, so a fill carried by both sources collapses to one row —
 * which is what makes this safe to run for a live run whose page has started filling in.
 */
export function mergeLiveTrades(
  restTrades: TradeHistoryRow[],
  snapshot: LiveSnapshot | undefined,
): TradeHistoryRow[] {
  const live = snapshot?.recentTrades ?? [];
  if (live.length === 0) return restTrades;
  const byId = new Map<string, TradeHistoryRow>();
  for (const t of restTrades) byId.set(t.id, t);
  for (const t of live) byId.set(t.id, t);
  // `time` is ISO, so lexical order is chronological.
  return [...byId.values()].sort((a, b) => b.time.localeCompare(a.time));
}
