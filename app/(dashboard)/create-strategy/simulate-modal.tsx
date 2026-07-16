"use client";
import { useState, type ReactNode, type ComponentProps } from "react";
import { CloseCircle, AltArrowDown, DangerTriangle } from "@solar-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusIcon } from "@/components/icons/plus";
import { useAccounts } from "@/hooks/api/use-accounts";
import { useVenues } from "@/hooks/api/use-venues";
import { useSymbols } from "@/hooks/api/use-symbols";
import { useLaunchRun, type LaunchRequest } from "@/hooks/api/use-runs";
import type { HftStrategyType } from "@/hooks/api/use-hft-strategies";
import type { RunMode } from "@/types/domain";

// Figma node 14197:30033 — "Simulate" configuration modal opened from the toolbar's Simulate
// button. Builds a real `LaunchRequest` and POSTs it via `useLaunchRun` (`POST /api/runs`).

type BalanceRow = { currency: string; amount: number };
const DEFAULT_BALANCES: BalanceRow[] = [{ currency: "USDT", amount: 100000 }];

// Bar `interval` vocabulary is Binance's kline naming, which the DNSE fetcher maps onto its own
// resolutions. Limited to the set both venues support — DNSE has no 4h, so offering Binance's
// full list would 422 on a DNSE account.
export const INTERVALS = ["1m", "5m", "15m", "1h", "1d"];

// Launch-time market, chosen in the toolbar's Settings popover. Lives here (not in toolbar.tsx) so
// both the toolbar pill and this modal read one definition — toolbar already imports from here, so
// the other direction would be an import cycle.
export const HFT_MARKET_LABEL: Record<string, string> = { "tick-l2": "Tick / L2 (HFT)", "bar-ohlc": "Bar / OHLC (MFT)" };

// `strategy_type` — the API-backed field, edited in the toolbar's Settings popover and shown
// read-only here. Lives alongside HFT_MARKET_LABEL for the same import-direction reason.
export const HFT_TYPE_LABEL: Record<HftStrategyType, string> = { taker: "Taker", maker: "Maker", arbitrage: "Arbitrage" };

// Shared by the Market/Interval pills so the two rows keep the same size and alignment.
const PILL_TRIGGER =
  "h-auto w-auto gap-1.5 rounded-full border-border bg-background! px-2.5 py-1 text-xs font-medium text-white shadow-xs";

const todayISO = () => new Date().toISOString().slice(0, 10);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// Pill-styled editable `<input>` — same chrome the static display-only pills used to have.
function PillInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`w-full rounded-[20px] border border-border bg-background px-3 py-2.5 text-sm text-white shadow-xs outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
      {...props}
    />
  );
}

function GroupBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2">
      <span className="text-sm font-medium text-white">{title}</span>
      {children}
    </div>
  );
}

export function SimulateModal({
  open,
  onOpenChange,
  strategyName,
  strategyId,
  hftType,
  hftMarket,
  onHftMarketChange,
  hftInterval,
  onHftIntervalChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyName: string;
  strategyId: string;
  /** `strategy_type` from the API — read-only here; the Settings popover is where it's edited. */
  hftType?: HftStrategyType;
  // Market/interval are launch-time only (no strategy field maps to them) and are picked here.
  // The toolbar owns the state so its pill reflects the choice without a second source of truth.
  /** `tick-l2` | `bar-ohlc` — drives `data_kind`. */
  hftMarket: string;
  onHftMarketChange: (market: string) => void;
  /** Bar size for `bar-ohlc` runs. */
  hftInterval: string;
  onHftIntervalChange: (interval: string) => void;
}) {
  const { data: accounts } = useAccounts();
  const [accountId, setAccountId] = useState<string>();
  const account = accounts?.find((a) => a.id === accountId);

  const { data: venues } = useVenues();
  const venueType = venues?.find((v) => v.id === account?.venue_id)?.venue_type;
  const isDnseAccount = venueType === "dnse";
  const [otpPasscode, setOtpPasscode] = useState("");

  const { data: symbols } = useSymbols(account?.venue_id);
  const [symbolIds, setSymbolIds] = useState<string[]>([]);
  const toggleSymbol = (id: string) =>
    setSymbolIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const [balances, setBalances] = useState<BalanceRow[]>(DEFAULT_BALANCES);
  const updateBalance = (index: number, patch: Partial<BalanceRow>) =>
    setBalances((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  const addBalance = () => setBalances((prev) => [...prev, { currency: "", amount: 0 }]);
  const removeBalance = (index: number) => setBalances((prev) => prev.filter((_, i) => i !== index));

  const [maxSliceSize, setMaxSliceSize] = useState(1000);
  const [twapIntervalMs, setTwapIntervalMs] = useState(1000);
  const [chaseThresholdTicks, setChaseThresholdTicks] = useState(100);
  const [cancelRatio, setCancelRatio] = useState(0);
  const [latencyName, setLatencyName] = useState<"zero" | "fixed">("zero");
  const [feedMs, setFeedMs] = useState(0);
  const [orderMs, setOrderMs] = useState(0);

  // No `LiveConditionSettings` field maps to "Rhai cost (ns)" in the HFT schema — kept as
  // UI-only state (matches the Figma layout) but intentionally never sent in the launch request.
  const [rhaiCostNs, setRhaiCostNs] = useState(0);
  const [costProcessL2Ns, setCostProcessL2Ns] = useState(0);
  const [costProcessTradeNs, setCostProcessTradeNs] = useState(0);
  const [l2QueueCapacity, setL2QueueCapacity] = useState(64);
  const [tradeQueueCapacity, setTradeQueueCapacity] = useState(64);

  const [mode, setMode] = useState<RunMode>("paper");
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Market alone decides the run's `data_kind`: Bar / OHLC (MFT) carries an interval, Tick / L2
  // (HFT) has no bar size to pick.
  const isBar = hftMarket === "bar-ohlc";

  const launchRun = useLaunchRun();

  const handleAccountChange = (value: string) => {
    setAccountId(value);
    setSymbolIds([]); // symbol list is venue-scoped — clear the stale selection
    setOtpPasscode(""); // DNSE-only field — clear the stale value when switching accounts
  };

  const handleModeChange = (value: string) => {
    if (value !== "paper" && value !== "live" && value !== "backtest") return;
    setMode(value);
    if (value !== "live") setLiveConfirmed(false);
  };

  // Mirrors the server's own checks so a bad range is caught before the POST rather than as a 422.
  const rangeError =
    mode !== "backtest" || !startDate || !endDate
      ? undefined
      : startDate > endDate
        ? "Start date must be on or before end date."
        : endDate > todayISO()
          ? "End date cannot be in the future."
          : undefined;

  const canSubmit =
    !!accountId &&
    symbolIds.length > 0 &&
    (mode !== "live" || liveConfirmed) &&
    (mode !== "backtest" || (!!startDate && !!endDate && !rangeError)) &&
    !launchRun.isPending;

  const handleSubmit = () => {
    if (!canSubmit || !accountId) return;
    const req: LaunchRequest = {
      strategy_id: strategyId,
      account_id: accountId,
      symbol_ids: symbolIds,
      mode,
      data_kind: isBar ? { kind: "bar", interval: hftInterval } : { kind: "tick" },
      ...(mode === "backtest" ? { backtest_range: { start_date: startDate, end_date: endDate } } : {}),
      execution: {
        max_slice_size: maxSliceSize,
        twap_interval_ms: twapIntervalMs,
        chase_threshold_ticks: chaseThresholdTicks,
        // cancel_ratio/latency are simulation-only (ignored by the live gateway) — only send them
        // for paper/backtest, matching the schema note that live falls back to harmless defaults.
        ...(mode !== "live"
          ? {
              cancel_ratio: cancelRatio,
              latency:
                latencyName === "fixed" ? { name: "fixed" as const, feed_ms: feedMs, order_ms: orderMs } : { name: "zero" as const },
            }
          : {}),
      },
      // Virtual-channel cost model is paper/backtest-only; `null` selects the live pipeline.
      live_condition:
        mode === "live"
          ? null
          : {
              cost_process_l2_ns: costProcessL2Ns,
              cost_process_trade_ns: costProcessTradeNs,
              l2_queue_capacity: l2QueueCapacity,
              trade_queue_capacity: tradeQueueCapacity,
            },
      starting_balances: {
        settlement_currency: balances[0]?.currency ?? "USDT",
        balances: Object.fromEntries(balances.map((b) => [b.currency, b.amount])),
      },
      ...(isDnseAccount && mode === "live" && otpPasscode.trim() ? { otp_passcode: otpPasscode.trim() } : {}),
    };
    launchRun.mutate(req, { onSuccess: () => onOpenChange(false) });
  };

  const selectedSymbolLabels = (symbols ?? [])
    .filter((s) => symbolIds.includes(s.id))
    .map((s) => s.symbol)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[460px] flex-col gap-0 overflow-hidden rounded-[20px] border-border bg-background p-0">
        <div className="shrink-0 bg-surface px-4 py-2.5">
          <DialogTitle className="bg-[linear-gradient(177deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-lg font-semibold text-transparent">
            Simulate &quot;{strategyName}&quot;
          </DialogTitle>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <p className="text-sm text-muted-foreground">
            Bind this strategy to an account and one more symbols, then launch in paper, backtest or live mode.
          </p>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Strategy</span>
              <span className="text-sm font-medium text-white">{strategyName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Type</span>
              <span className="text-sm font-medium text-white">{hftType ? HFT_TYPE_LABEL[hftType] : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Market</span>
              <Select value={hftMarket} onValueChange={(v) => v && onHftMarketChange(v)}>
                <SelectTrigger className={PILL_TRIGGER}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background!">
                  {Object.entries(HFT_MARKET_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Bar / OHLC (MFT) only — Tick / L2 (HFT) has no interval. */}
            {isBar && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Interval</span>
                <Select value={hftInterval} onValueChange={(v) => v && onHftIntervalChange(v)}>
                  <SelectTrigger className={PILL_TRIGGER}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background!">
                    {INTERVALS.map((i) => (
                      <SelectItem key={i} value={i} className="text-xs">
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Mode</span>
              <Tabs value={mode} onValueChange={handleModeChange}>
                <TabsList>
                  <TabsTrigger value="backtest">Backtest</TabsTrigger>
                  <TabsTrigger value="paper">Paper</TabsTrigger>
                  <TabsTrigger value="live">Live</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {mode === "live" && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#f1c617]/40 bg-[#f1c617]/10 p-3 text-xs text-[#f1c617]">
              <div className="flex items-start gap-2">
                <DangerTriangle weight="Outline" className="mt-0.5 size-[18px] shrink-0" />
                <p>
                  Starting a live run will execute real orders on the market. Make sure the configuration is correct
                  before proceeding.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={liveConfirmed} onCheckedChange={(v) => setLiveConfirmed(v === true)} />
                <span>I understand this places real orders</span>
              </label>
            </div>
          )}

          <GroupBox title="General Configuration">
            <Field label="Account selection">
              <Select value={accountId} onValueChange={handleAccountChange}>
                <SelectTrigger className="h-auto w-full justify-between rounded-[20px] border-border bg-background! px-3 py-2.5 text-sm text-white shadow-xs">
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent className="bg-background!">
                  {(accounts ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {isDnseAccount && mode === "live" && (
              <Field label="OTP passcode">
                <PillInput
                  value={otpPasscode}
                  onChange={(e) => setOtpPasscode(e.target.value)}
                  placeholder="Passcode emailed to the account owner"
                />
              </Field>
            )}

            <Field label="Symbol">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={!account}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-[20px] border border-border bg-background px-3 py-2.5 text-sm text-white shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className={`truncate ${symbolIds.length ? "text-white" : "text-muted-foreground"}`}>
                      {!account ? "Select an account first" : symbolIds.length ? selectedSymbolLabels : "Select symbols..."}
                    </span>
                    <AltArrowDown weight="Outline" className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="max-h-56 w-[380px] overflow-y-auto p-1.5"
                  // The parent Dialog's scroll-lock (RemoveScroll) blocks native wheel scrolling on
                  // this portaled popover — scroll it programmatically instead.
                  onWheel={(e) => {
                    e.currentTarget.scrollTop += e.deltaY;
                  }}
                >
                  {(symbols ?? []).length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">No symbols for this venue.</p>
                  ) : (
                    (symbols ?? []).map((s) => {
                      const checked = symbolIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleSymbol(s.id)}
                          className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-2 text-xs text-white hover:bg-secondary/60"
                        >
                          <Checkbox checked={checked} />
                          {s.symbol}
                        </div>
                      );
                    })
                  )}
                </PopoverContent>
              </Popover>
            </Field>

            {mode === "backtest" && (
              <>
                <div className="flex gap-2">
                  <Field label="Date from">
                    <PillInput
                      type="date"
                      value={startDate}
                      max={endDate || todayISO()}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Date to">
                    <PillInput
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      max={todayISO()}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </Field>
                </div>
                {rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
              </>
            )}

            <Field label="Balances">
              {balances.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <PillInput
                    className="flex-1"
                    value={row.currency}
                    onChange={(e) => updateBalance(i, { currency: e.target.value })}
                    placeholder="Currency"
                  />
                  <PillInput
                    className="flex-1"
                    type="number"
                    value={row.amount}
                    onChange={(e) => updateBalance(i, { amount: Number(e.target.value) })}
                  />
                  <button
                    type="button"
                    aria-label="Remove balance"
                    onClick={() => removeBalance(i)}
                    className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-white"
                  >
                    <CloseCircle weight="Outline" className="size-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addBalance}
                className="mt-1 inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-primary"
              >
                <PlusIcon className="size-4" />
                Add balance
              </button>
            </Field>
          </GroupBox>

          <GroupBox title="Execution">
            <div className="flex gap-2">
              <Field label="Max slice size">
                <PillInput
                  type="number"
                  value={maxSliceSize}
                  onChange={(e) => setMaxSliceSize(Number(e.target.value))}
                />
              </Field>
              <Field label="TWAP interval (ms)">
                <PillInput
                  type="number"
                  value={twapIntervalMs}
                  onChange={(e) => setTwapIntervalMs(Number(e.target.value))}
                />
              </Field>
              <Field label="Chase (ticks)">
                <PillInput
                  type="number"
                  value={chaseThresholdTicks}
                  onChange={(e) => setChaseThresholdTicks(Number(e.target.value))}
                />
              </Field>
            </div>

            {/* cancel_ratio/latency and the virtual-channel cost model are simulation-only
                (paper/backtest) — hidden for live, matching the schema note that the live gateway
                ignores them and falls back to harmless defaults. */}
            {mode !== "live" && (
              <>
                <div className="h-px bg-border" />

                <span className="text-sm text-[#d0d5dd]">Simulation only (paper / backtest)</span>
                <div className="flex gap-2">
                  <Field label="Cancel ratio">
                    <PillInput
                      type="number"
                      step="0.01"
                      value={cancelRatio}
                      onChange={(e) => setCancelRatio(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Latency">
                    <Select value={latencyName} onValueChange={(v) => v && setLatencyName(v as "zero" | "fixed")}>
                      <SelectTrigger className="h-auto w-full justify-between rounded-[20px] border-border bg-background! px-3 py-2.5 text-sm text-white shadow-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background!">
                        <SelectItem value="zero">Zero</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {latencyName === "fixed" && (
                  <div className="flex gap-2">
                    <Field label="Feed latency (ms)">
                      <PillInput type="number" value={feedMs} onChange={(e) => setFeedMs(Number(e.target.value))} />
                    </Field>
                    <Field label="Order latency (ms)">
                      <PillInput type="number" value={orderMs} onChange={(e) => setOrderMs(Number(e.target.value))} />
                    </Field>
                  </div>
                )}

                <div className="h-px bg-border" />

                <span className="text-sm text-[#d0d5dd]">Virtual channel (backtest cost model)</span>
                <div className="flex gap-2">
                  <Field label="Rhai cost (ns)">
                    <PillInput type="number" value={rhaiCostNs} onChange={(e) => setRhaiCostNs(Number(e.target.value))} />
                  </Field>
                  <Field label="L2 cost (ns)">
                    <PillInput
                      type="number"
                      value={costProcessL2Ns}
                      onChange={(e) => setCostProcessL2Ns(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Trade cost (ns)">
                    <PillInput
                      type="number"
                      value={costProcessTradeNs}
                      onChange={(e) => setCostProcessTradeNs(Number(e.target.value))}
                    />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Field label="L2 queue capacity">
                    <PillInput
                      type="number"
                      value={l2QueueCapacity}
                      onChange={(e) => setL2QueueCapacity(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Trade queue capacity">
                    <PillInput
                      type="number"
                      value={tradeQueueCapacity}
                      onChange={(e) => setTradeQueueCapacity(Number(e.target.value))}
                    />
                  </Field>
                </div>
              </>
            )}
          </GroupBox>

          {launchRun.isError && (
            <p className="text-xs text-destructive">
              {launchRun.error instanceof Error ? launchRun.error.message : "Failed to start run. Please try again."}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 cursor-pointer rounded-full border border-border bg-black px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 cursor-pointer rounded-full bg-[linear-gradient(171deg,#cff8ea_0%,#67e1c1_100%)] px-3 py-2 text-xs font-medium text-[#0d0d0d] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {launchRun.isPending
              ? "Starting…"
              : mode === "live"
                ? "Start live run"
                : mode === "backtest"
                  ? "Start backtest"
                  : "Start paper run"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
