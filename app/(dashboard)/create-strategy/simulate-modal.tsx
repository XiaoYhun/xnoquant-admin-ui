"use client";
import { useRef, useState, type ReactNode, type ComponentProps } from "react";
import { format, parseISO } from "date-fns";
import { CloseCircle, DangerTriangle, Magnifer, Calendar as CalendarIcon } from "@solar-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusIcon } from "@/components/icons/plus";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/hooks/api/use-accounts";
import { useVenues } from "@/hooks/api/use-venues";
import { useSymbols } from "@/hooks/api/use-symbols";
import { useLastRunConfig, useLaunchRun, type LaunchRequest } from "@/hooks/api/use-runs";
import { resourceErrorMessage } from "@/lib/api-client";
import { launchMode } from "@/components/strategy-stage";
import { useHftStrategy, type HftStrategyType } from "@/hooks/api/use-hft-strategies";
import type { Account, Run, RunMode } from "@/types/domain";

// Figma node 14197:30033 — "Simulate" configuration modal opened from the toolbar's Simulate
// button. Builds a real `LaunchRequest` and POSTs it via `useLaunchRun` (`POST /api/runs`).

type BalanceRow = { currency: string; amount: number };
const DEFAULT_BALANCES: BalanceRow[] = [{ currency: "USDT", amount: 100000 }];

// Bar `interval` vocabulary is Binance's kline naming, which the DNSE fetcher maps onto its own
// resolutions. Limited to the set both venues support — DNSE has no 4h. 10m isn't a native Binance
// kline (its set jumps 5m → 15m); the backend aggregates it, so it's offered for every venue.
export const INTERVALS = ["1m", "5m", "10m", "15m", "1h", "1d"];

// Launch-time market, chosen in the toolbar's Settings popover. Lives here (not in toolbar.tsx) so
// both the toolbar pill and this modal read one definition — toolbar already imports from here, so
// the other direction would be an import cycle.
export const HFT_MARKET_LABEL: Record<string, string> = { "tick-l2": "Tick / L2 (HFT)", "bar-ohlc": "Bar / OHLC (MFT)" };

// `strategy_type` — the API-backed field, edited in the toolbar's Settings popover and shown
// read-only here. Lives alongside HFT_MARKET_LABEL for the same import-direction reason.
export const HFT_TYPE_LABEL: Record<HftStrategyType, string> = { taker: "Taker", maker: "Maker", arbitrage: "Arbitrage" };

// The summary block is one pattern per row: `text-xs` muted label left, `text-xs` control/value
// right. These keep every control in it the same size — change one, change the row.
const PILL_TRIGGER =
  "h-auto! w-auto gap-1.5 rounded-full border-border bg-background! px-2.5 py-1 text-xs font-medium text-white shadow-xs";
// Trigger pill for the date picker — matches the Market/Interval select pills in the summary block.
const PILL_DATE =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium shadow-xs outline-none focus-visible:border-ring";
const ROW = "flex min-h-8 items-center justify-between gap-3";
const ROW_LABEL = "text-xs text-muted-foreground";
const ROW_VALUE = "text-xs font-medium text-white";

// Config-section field chrome — one definition so every input/select/symbol-picker in the
// GroupBoxes shares the same height, radius, padding, and text size.
const FIELD_INPUT =
  "w-full rounded-[10px] border border-border bg-background px-3 py-2 text-xs text-white shadow-xs outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50";
const SELECT_TRIGGER = `h-auto justify-between ${FIELD_INPUT} bg-background!`;

const todayISO = () => new Date().toISOString().slice(0, 10);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-[#d0d5dd]">{label}</span>
      {children}
    </div>
  );
}

function PillInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={`${FIELD_INPUT} ${className ?? ""}`} {...props} />;
}

function GroupBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-3">
      <span className="text-sm font-semibold text-white">{title}</span>
      {children}
    </div>
  );
}

// Two-option colored toggle for the run's market: green Tick / L2 (HFT), purple Bar / OHLC (MFT).
function MarketSwitch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options: { value: string; label: string; active: string }[] = [
    { value: "tick-l2", label: "HFT", active: "bg-[#67e1c1] text-black" },
    { value: "bar-ohlc", label: "MFT", active: "bg-[#7b61ff] text-white" },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? o.active : "text-muted-foreground hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// shadcn date picker: a pill trigger opening a Calendar popover. Value is an ISO `yyyy-MM-dd`
// string (the backend `NaiveDate` wire form); `min`/`max` disable out-of-range days.
function DatePickerField({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  const disabled = [...(min ? [{ before: parseISO(min) }] : []), ...(max ? [{ after: parseISO(max) }] : [])];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={`${PILL_DATE} ${value ? "text-white" : "text-muted-foreground"}`}>
          {selected ? format(selected, "MMM d, yyyy") : "Pick a date"}
          <CalendarIcon weight="Outline" className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disabled}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[] | undefined;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className={SELECT_TRIGGER}>
        <SelectValue placeholder="Select account..." />
      </SelectTrigger>
      <SelectContent className="bg-background!">
        {(accounts ?? []).map((a) => (
          <SelectItem key={a.id} value={a.id} className="text-xs">
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// One arbitrage leg: an account bound to exactly one symbol on that account's venue.
function AccountLeg({
  title,
  hint,
  accounts,
  accountId,
  onAccountChange,
  symbolIds,
  onSymbolChange,
}: {
  title: string;
  hint: string;
  accounts: Account[] | undefined;
  accountId?: string;
  onAccountChange: (value: string) => void;
  symbolIds: string[];
  onSymbolChange: (ids: string[]) => void;
}) {
  const venueId = accounts?.find((a) => a.id === accountId)?.venue_id;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="flex gap-2">
        <Field label="Account">
          <AccountSelect accounts={accounts} value={accountId} onChange={onAccountChange} />
        </Field>
        <Field label="Symbol">
          <SymbolPicker venueId={venueId} disabled={!accountId} selected={symbolIds} onChange={onSymbolChange} />
        </Field>
      </div>
    </div>
  );
}

// Venue-scoped symbol chooser. `multiple` is the non-arbitrage multi-select; single-select
// (one symbol per arbitrage leg) closes on pick. Selection is venue-scoped, so the caller clears
// it whenever the bound account changes.
function SymbolPicker({
  venueId,
  disabled,
  selected,
  onChange,
  multiple,
}: {
  venueId?: string;
  disabled?: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
}) {
  const { data: symbols } = useSymbols(venueId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = symbols ?? [];
  const selectedSymbols = all.filter((s) => selected.includes(s.id));
  const selectedLabel = selectedSymbols[0]?.symbol ?? "";
  const q = query.trim().toLowerCase();
  const filtered = q ? all.filter((s) => s.symbol.toLowerCase().includes(q)) : all;

  // Multi-select (non-arbitrage) toggles and stays open so several symbols can be added; the
  // single-select arbitrage leg replaces and closes.
  const pick = (id: string) => {
    if (multiple) {
      onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
      setQuery("");
      inputRef.current?.focus();
    } else {
      onChange([id]);
      setOpen(false);
    }
  };
  const remove = (id: string) => onChange(selected.filter((x) => x !== id));

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          ref={fieldRef}
          onClick={() => !disabled && inputRef.current?.focus()}
          className={`${FIELD_INPUT} flex min-h-9 flex-wrap items-center gap-1 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-text"}`}
        >
          <Magnifer weight="Outline" className="size-4 shrink-0 text-muted-foreground" />
          {multiple &&
            selectedSymbols.map((s) => (
              <span
                key={s.id}
                className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-white"
              >
                <span className="truncate">{s.symbol}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(s.id);
                  }}
                  className="shrink-0 text-muted-foreground hover:text-white"
                >
                  <CloseCircle weight="Bold" className="size-3.5" />
                </button>
              </span>
            ))}
          <input
            ref={inputRef}
            disabled={disabled}
            // Multi-select keeps the field a search box (chips carry the selection). Single-select
            // shows the picked symbol when closed and selects it on focus so typing replaces it.
            value={multiple || open ? query : selectedLabel}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={(e) => {
              if (!multiple) {
                setQuery(selectedLabel);
                e.target.select();
              }
              setOpen(true);
            }}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder={
              disabled
                ? "Select an account first"
                : multiple
                  ? selected.length
                    ? ""
                    : "Search symbols..."
                  : "Search symbol..."
            }
            className="min-w-16 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-muted-foreground"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (fieldRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
        className="max-h-56 w-[--radix-popover-trigger-width] overflow-y-auto p-1.5"
        // The parent Dialog's scroll-lock (RemoveScroll) blocks native wheel scrolling on this
        // portaled popover — scroll it programmatically instead.
        onWheel={(e) => {
          e.currentTarget.scrollTop += e.deltaY;
        }}
      >
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            {all.length === 0 ? "No symbols for this venue." : "No matches."}
          </p>
        ) : (
          filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => pick(s.id)}
              className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-2 text-xs text-white hover:bg-secondary/60"
            >
              {selected.includes(s.id) && <Checkbox checked />}
              {s.symbol}
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
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
  onLaunched,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyName: string;
  strategyId: string;
  /** The run `POST /api/runs` created, so the caller can point the Results tab straight at it. */
  onLaunched?: (run: Run) => void;
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
  // Arbitrage binds a symbol to each of two accounts in leg order (leg1 = primary `account_id`,
  // leg2 = the single `extra_account_ids` entry); every other strategy trades N symbols on one
  // account. The backend rejects a mismatch, so the form shape follows `hftType`.
  const isArb = hftType === "arbitrage";

  // The run's mode is not a choice — it's the highest rung the strategy has been promoted to, the
  // same `launchMode` the Run buttons label themselves with, so the button never promises a mode
  // the dialog then quietly downgrades. A stale approval (promoted at v33, now v34) still counts:
  // it keeps the strategy in the basket, and POST /api/runs documents no promotion precondition,
  // so the server is the authority — a rejection surfaces here verbatim rather than being
  // pre-empted by a guess about the version rule.
  const { data: strategy } = useHftStrategy(strategyId);
  const mode: RunMode = strategy ? launchMode(strategy) : "backtest";
  const MODE_LABEL: Record<RunMode, string> = { backtest: "Backtest", paper: "Paper", live: "Live" };

  const { data: accounts } = useAccounts();
  const { data: venues } = useVenues();
  const venueIdOf = (id?: string) => accounts?.find((a) => a.id === id)?.venue_id;

  // leg1 / primary
  const [accountId, setAccountId] = useState<string>();
  const [symbolIds, setSymbolIds] = useState<string[]>([]);
  // leg2 (arbitrage only)
  const [leg2AccountId, setLeg2AccountId] = useState<string>();
  const [leg2SymbolIds, setLeg2SymbolIds] = useState<string[]>([]);

  const isDnseAccount = venues?.find((v) => v.id === venueIdOf(accountId))?.venue_type === "dnse";
  const [otpPasscode, setOtpPasscode] = useState("");

  const [settlementCurrency, setSettlementCurrency] = useState("USDT");
  const [balances, setBalances] = useState<BalanceRow[]>(DEFAULT_BALANCES);
  const updateBalance = (index: number, patch: Partial<BalanceRow>) =>
    setBalances((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  const addBalance = () => setBalances((prev) => [...prev, { currency: "", amount: 0 }]);
  const removeBalance = (index: number) => setBalances((prev) => prev.filter((_, i) => i !== index));

  const [maxSliceSize, setMaxSliceSize] = useState(1000);
  const [twapIntervalMs, setTwapIntervalMs] = useState(1000);
  const [chaseThresholdTicks, setChaseThresholdTicks] = useState(100);
  const [entryOrderTtlMs, setEntryOrderTtlMs] = useState(0);
  const [cancelRatio, setCancelRatio] = useState(0);
  const [latencyName, setLatencyName] = useState<"zero" | "fixed">("zero");
  const [feedMs, setFeedMs] = useState(0);
  const [orderMs, setOrderMs] = useState(0);

  const [costProcessL2Ns, setCostProcessL2Ns] = useState(0);
  const [costProcessTradeNs, setCostProcessTradeNs] = useState(0);
  const [l2QueueCapacity, setL2QueueCapacity] = useState(64);
  const [tradeQueueCapacity, setTradeQueueCapacity] = useState(64);
  // Engine default (MarketConfig::imbalance_depth) — mirrored here so the field shows the value
  // the run would use rather than an empty box.
  const [imbalanceDepth, setImbalanceDepth] = useState(10);

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
    // Seed the starting balance from the account's venue: VN brokers settle in VND, crypto in USDT.
    const venueType = venues?.find((v) => v.id === venueIdOf(value))?.venue_type;
    if (venueType === "tcbs" || venueType === "dnse") {
      setSettlementCurrency("VND");
      setBalances([{ currency: "VND", amount: 1_000_000_000 }]);
    } else {
      setSettlementCurrency("USDT");
      setBalances([{ currency: "USDT", amount: 100_000 }]);
    }
  };
  const handleLeg2AccountChange = (value: string) => {
    setLeg2AccountId(value);
    setLeg2SymbolIds([]);
  };

  // Prefill from the caller's own most recent run of this strategy (`null` if they've never run
  // it), so relaunching a familiar strategy doesn't start from blank defaults. Fetched only once
  // the dialog is open, and applied once per strategy — reopening the dialog must not overwrite
  // edits the user made and didn't launch. Market/interval are deliberately left alone: the
  // toolbar owns them (and its Settings popover may have just set them), and the MarketSwitch
  // above shows the current choice anyway.
  const { data: lastRun } = useLastRunConfig(strategyId, open);
  // Compared during render (not synced in an effect, per react-hooks/set-state-in-effect).
  // `accounts` decides whether the run's account still exists, and `strategy` settles `isArb`
  // (which decides how the run's symbols split across legs) — both must be loaded before applying.
  const [prefilledFor, setPrefilledFor] = useState<string>();
  if (open && lastRun && accounts && strategy && prefilledFor !== strategyId) {
    setPrefilledFor(strategyId);

    if (accounts.some((a) => a.id === lastRun.account.id)) {
      // Set directly rather than through handleAccountChange: that clears the symbols and reseeds
      // the balances by venue, which would undo the rest of this prefill.
      setAccountId(lastRun.account.id);
      // A symbol only belongs in a leg's picker if it's on that leg's venue. The strategy's type
      // can have changed since the run, so an arbitrage run's leg-2 symbol (on the other venue)
      // must not land in a now-single-account form's picker, where it would be invisible.
      const onVenue = (venueId: string) => lastRun.symbols.filter((s) => s.venue_id === venueId).map((s) => s.id);
      const leg1 = onVenue(lastRun.account.venue_id);
      setSymbolIds(isArb ? leg1.slice(0, 1) : leg1);
      const leg2 = lastRun.extra_accounts?.[0];
      if (isArb && leg2 && accounts.some((a) => a.id === leg2.id)) {
        setLeg2AccountId(leg2.id);
        setLeg2SymbolIds(onVenue(leg2.venue_id).slice(0, 1));
      }
    }

    if (lastRun.account.settlement_currency) setSettlementCurrency(lastRun.account.settlement_currency);
    const rows = Object.entries(lastRun.account.balances ?? {}).map(([currency, amount]) => ({ currency, amount }));
    if (rows.length) setBalances(rows);

    const exec = lastRun.execution;
    if (exec?.max_slice_size != null) setMaxSliceSize(exec.max_slice_size);
    if (exec?.twap_interval_ms != null) setTwapIntervalMs(exec.twap_interval_ms);
    if (exec?.chase_threshold_ticks != null) setChaseThresholdTicks(exec.chase_threshold_ticks);
    if (exec?.entry_order_ttl_ms != null) setEntryOrderTtlMs(exec.entry_order_ttl_ms);
    if (exec?.cancel_ratio != null) setCancelRatio(exec.cancel_ratio);
    // The form offers Zero and Fixed only; a `log_normal` manifest has no field to land in, so it
    // keeps the Zero default rather than showing a latency the form can't reproduce.
    if (exec?.latency?.name === "fixed") {
      setLatencyName("fixed");
      setFeedMs(exec.latency.feed_ms);
      setOrderMs(exec.latency.order_ms);
    }

    const cond = lastRun.live_condition;
    if (cond?.cost_process_l2_ns != null) setCostProcessL2Ns(cond.cost_process_l2_ns);
    if (cond?.cost_process_trade_ns != null) setCostProcessTradeNs(cond.cost_process_trade_ns);
    if (cond?.l2_queue_capacity != null) setL2QueueCapacity(cond.l2_queue_capacity);
    if (cond?.trade_queue_capacity != null) setTradeQueueCapacity(cond.trade_queue_capacity);

    if (lastRun.imbalance_depth != null) setImbalanceDepth(lastRun.imbalance_depth);
    if (lastRun.backtest_range) {
      setStartDate(lastRun.backtest_range.start_date);
      setEndDate(lastRun.backtest_range.end_date);
    }
  }


  // Mirrors the server's own checks so a bad range is caught before the POST rather than as a 422.
  const rangeError =
    mode !== "backtest" || !startDate || !endDate
      ? undefined
      : startDate > endDate
        ? "Start date must be on or before end date."
        : endDate > todayISO()
          ? "End date cannot be in the future."
          : undefined;

  // Arbitrage needs two distinct accounts and exactly one symbol per leg; every other strategy
  // needs one account and at least one symbol. (Backend: "arbitrage run needs exactly 2 accounts
  // /2 symbols", "legs must use two different accounts".)
  const accountsOk = isArb
    ? !!accountId && !!leg2AccountId && accountId !== leg2AccountId
    : !!accountId;
  const symbolsOk = isArb ? symbolIds.length === 1 && leg2SymbolIds.length === 1 : symbolIds.length > 0;
  const sameAccountError = isArb && !!accountId && accountId === leg2AccountId;

  const canSubmit =
    accountsOk &&
    symbolsOk &&
    (mode !== "live" || liveConfirmed) &&
    (mode !== "backtest" || (!!startDate && !!endDate && !rangeError)) &&
    !launchRun.isPending;

  const handleSubmit = () => {
    if (!canSubmit || !accountId) return;
    const req: LaunchRequest = {
      strategy_id: strategyId,
      account_id: accountId,
      ...(isArb && leg2AccountId ? { extra_account_ids: [leg2AccountId] } : {}),
      // Leg order: symbol[0] binds to account[0] (leg1), symbol[1] to account[1] (leg2).
      symbol_ids: isArb ? [symbolIds[0], leg2SymbolIds[0]] : symbolIds,
      mode,
      data_kind: isBar ? { kind: "bar", interval: hftInterval } : { kind: "tick" },
      ...(mode === "backtest" ? { backtest_range: { start_date: startDate, end_date: endDate } } : {}),
      execution: {
        max_slice_size: maxSliceSize,
        twap_interval_ms: twapIntervalMs,
        chase_threshold_ticks: chaseThresholdTicks,
        // Entry aging is universal (all modes); `0` disables it.
        entry_order_ttl_ms: entryOrderTtlMs,
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
      // Market-data config, not execution — applies to every mode.
      imbalance_depth: imbalanceDepth,
      starting_balances: {
        settlement_currency: settlementCurrency.trim() || "USDT",
        balances: Object.fromEntries(balances.map((b) => [b.currency, b.amount])),
      },
      ...(isDnseAccount && mode === "live" && otpPasscode.trim() ? { otp_passcode: otpPasscode.trim() } : {}),
    };
    launchRun.mutate(req, {
      onSuccess: (run) => {
        onOpenChange(false);
        onLaunched?.(run);
      },
    });
  };

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
            Bind this strategy to an account and one or more symbols, then launch. The mode follows the strategy&rsquo;s promotion stage.
          </p>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3">
            <div className={ROW}>
              <span className={ROW_LABEL}>Strategy</span>
              <span className={`${ROW_VALUE} truncate`}>{strategyName}</span>
            </div>
            <div className={ROW}>
              <span className={ROW_LABEL}>Type</span>
              <span className={ROW_VALUE}>{hftType ? HFT_TYPE_LABEL[hftType] : "—"}</span>
            </div>
            <div className={ROW}>
              <span className={ROW_LABEL}>Market</span>
              <MarketSwitch value={hftMarket} onChange={onHftMarketChange} />
            </div>
            {/* Bar / OHLC (MFT) only — Tick / L2 (HFT) has no interval. */}
            {isBar && (
              <div className={ROW}>
                <span className={ROW_LABEL}>Interval</span>
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
            <div className={ROW}>
              <span className={ROW_LABEL}>Mode</span>
              <span className={ROW_VALUE}>{MODE_LABEL[mode]}</span>
            </div>
            {mode === "backtest" && (
              <>
                <div className={ROW}>
                  <span className={ROW_LABEL}>Date range</span>
                  <div className="flex items-center gap-1.5">
                    <DatePickerField value={startDate} onChange={setStartDate} max={endDate || todayISO()} />
                    <span className="text-xs text-muted-foreground">→</span>
                    <DatePickerField value={endDate} onChange={setEndDate} min={startDate || undefined} max={todayISO()} />
                  </div>
                </div>
                {rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
              </>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {isArb ? (
              <>
                {/* Arbitrage: one account + one symbol per leg, in leg order. */}
                <AccountLeg
                  title="Account 1"
                  hint="Leg 1 — swept at market"
                  accounts={accounts}
                  accountId={accountId}
                  onAccountChange={handleAccountChange}
                  symbolIds={symbolIds}
                  onSymbolChange={setSymbolIds}
                />
                <AccountLeg
                  title="Account 2"
                  hint="Leg 2 — posted at limit"
                  accounts={accounts}
                  accountId={leg2AccountId}
                  onAccountChange={handleLeg2AccountChange}
                  symbolIds={leg2SymbolIds}
                  onSymbolChange={setLeg2SymbolIds}
                />
                {sameAccountError && (
                  <p className="text-xs text-destructive">The two arbitrage legs must use different accounts.</p>
                )}
              </>
            ) : (
              <div className="flex gap-2 rounded-xl border border-border bg-surface p-2.5">
                <Field label="Account">
                  <AccountSelect accounts={accounts} value={accountId} onChange={handleAccountChange} />
                </Field>
                <Field label="Symbol">
                  <SymbolPicker
                    venueId={venueIdOf(accountId)}
                    disabled={!accountId}
                    selected={symbolIds}
                    onChange={setSymbolIds}
                    multiple
                  />
                </Field>
              </div>
            )}

            {isDnseAccount && mode === "live" && (
              <Field label="OTP passcode">
                <PillInput
                  value={otpPasscode}
                  onChange={(e) => setOtpPasscode(e.target.value)}
                  placeholder="Passcode emailed to the account owner"
                />
              </Field>
            )}
          </div>

          <GroupBox title="Starting balances">
            <Field label="Settlement currency">
              <PillInput value={settlementCurrency} onChange={(e) => setSettlementCurrency(e.target.value)} />
            </Field>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#d0d5dd]">Balances</span>
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
            </div>
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
            {/* Entry aging — cancel an unfilled entry after it rests this long; `0` disables. */}
            <div className="flex gap-2">
              <Field label="Entry TTL (ms, 0=off)">
                <PillInput
                  type="number"
                  value={entryOrderTtlMs}
                  onChange={(e) => setEntryOrderTtlMs(Number(e.target.value))}
                />
              </Field>
              <div className="flex-1" />
              <div className="flex-1" />
            </div>

            {/* cancel_ratio/latency and the virtual-channel cost model are simulation-only
                (paper/backtest) — hidden for live, matching the schema note that the live gateway
                ignores them and falls back to harmless defaults. */}
            {mode !== "live" && (
              <>
                <div className="h-px bg-border" />

                <span className="text-xs font-medium text-muted-foreground">Simulation only (paper / backtest)</span>
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
                      <SelectTrigger className={SELECT_TRIGGER}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background!">
                        <SelectItem value="zero" className="text-xs">Zero</SelectItem>
                        <SelectItem value="fixed" className="text-xs">Fixed</SelectItem>
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

                <span className="text-xs font-medium text-muted-foreground">Virtual channel (backtest cost model)</span>
                <div className="flex gap-2">
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

          <GroupBox title="Market">
            {/* Top order-book levels aggregated per side for the strategy's `imbalance_n`
                feature. Applies to every mode, so it sits outside the Execution box. */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#d0d5dd]">Imbalance depth (book levels per side)</span>
              <div className="w-24 shrink-0">
                <PillInput
                  type="number"
                  min={0}
                  value={imbalanceDepth}
                  onChange={(e) => setImbalanceDepth(Number(e.target.value))}
                />
              </div>
            </div>
          </GroupBox>

          {/* Last thing before the footer: this acknowledges the configuration ABOVE it, so it read
              as premature when it sat at the top of the form, before an account had been picked. */}
          {mode === "live" && (
            <div className="flex flex-col gap-3 rounded-xl border border-[#f1c617]/40 bg-[#f1c617]/10 p-3 text-xs text-[#f1c617]">
              <div className="flex items-start gap-2">
                <DangerTriangle weight="Outline" className="mt-0.5 size-[18px] shrink-0" />
                <p>
                  Starting a live run will execute real orders on the market, with real money, on the account selected
                  above. Check the configuration before proceeding.
                </p>
              </div>
              {/* The shared checkbox is grey when unchecked and mint when checked — on an amber
                  panel that reads as decoration, and a green tick inside a warning contradicts it.
                  Amber-on-amber with a dark tick makes the state unmistakable either way. */}
              <label className="flex cursor-pointer items-start gap-2.5 font-medium">
                <Checkbox
                  checked={liveConfirmed}
                  onCheckedChange={(v) => setLiveConfirmed(v === true)}
                  aria-label="I understand this places real orders"
                  className="mt-px size-[18px] border-[1.5px] border-[#f1c617] data-[state=checked]:border-[#f1c617] data-[state=checked]:bg-[#f1c617] [&_[data-slot=checkbox-indicator]]:text-black"
                />
                <span>I understand this places real orders</span>
              </label>
              {/* Without this the launch button just greys out and never says which box to tick.
                  The tick is only the LAST blocker, though — promising it will enable the button
                  while the account or symbol is still empty would just move the confusion. */}
              {!liveConfirmed && (
                <p className="text-[#f1c617]/70">
                  {accountsOk && symbolsOk
                    ? "Tick the box above to enable \u201cStart live run\u201d."
                    : "Required before a live run can start."}
                </p>
              )}
            </div>
          )}

          {launchRun.isError && (
            <p className="text-xs text-destructive">{resourceErrorMessage(launchRun.error, "this run")}</p>
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
