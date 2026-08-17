"use client";
import { useMemo, useState } from "react";
import { AltArrowDown, Record } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useRunTraceHistory, useRunTraceStream, type TraceEvent } from "@/hooks/api/use-run-trace";

// Trade cycles panel — Figma nodes 14727:36059 (frame) / 14727:63161 (row). A run's trade-cycle
// console log grouped into cycles: a collapsible header (symbol, side, qty, timestamp, status)
// over a timeline of that cycle's lifecycle events (Entry → Order submitted → Filled).

const GRAD_GREEN = "bg-[linear-gradient(159deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";
const GRAD_BLUE = "bg-[linear-gradient(162deg,#cfdbf8_0%,#2d84ff_100%)] bg-clip-text text-transparent";

// The API sends raw snake_case kinds (`cycle_opened`, `order_submitted`, …); the design shows
// prose. Anything unmapped falls back to a de-snaked version rather than leaking the raw kind.
const STAGE_LABEL: Record<string, string> = {
  cycle_opened: "Entry",
  order_submitted: "Order submitted",
  order_filled: "Filled",
  order_cancelled: "Cancelled",
  order_canceled: "Cancelled",
  order_rejected: "Rejected",
  cycle_closed: "Closed",
};
const stageLabel = (kind: string) =>
  STAGE_LABEL[kind] ?? kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

// A fill is a milestone, not the end: the position stays Open until the cycle closes or an order
// is cancelled/rejected. (Figma 14727:63161 shows a filled entry still badged "Open".)
const isFillStage = (stage: string) => /fill/i.test(stage);
const isClosingStage = (stage: string) => /cycle_closed|closed|exit|cancel|reject/i.test(stage);
const isEntryStage = (stage: string) => /cycle_opened|entry|signal/i.test(stage);
const isSell = (side?: string) => !!side && /sell|short/i.test(side);

// Timeline dots are per stage, read off the design's own dot assets: the entry is Jordy Blue 400,
// an order still working is neutral, and a fill/close is the primary green.
const ENTRY_DOT = "#73adff";
const PENDING_DOT = "#9db2ce";
const DONE_DOT = "#67e1c1";
function dotColor(stage: string): string {
  if (isFillStage(stage) || isClosingStage(stage)) return DONE_DOT;
  if (isEntryStage(stage)) return ENTRY_DOT;
  return PENDING_DOT;
}

const nf = (n: number, dp = 2) => n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
// Quantities are whole-ish; don't force 2dp onto "1", and don't leak float noise either.
// Numeric round-trip, NOT display formatting: `Number("1,234.5")` is NaN, so this must stay
// on toFixed. Trailing zeros are stripped by the Number() pass.
const qtyText = (q: number) => (Number.isInteger(q) ? String(q) : String(Number(q.toFixed(8))));

/**
 * The design's detail line is composed from the event's own fields — "BUY 0.01 (Signal)",
 * "BUY 0.01", "BUY 0.01 @ 63,212.97" — not from the server's raw `message` ("target position ->
 * 1.000000", "fill: BUY 1 @ 1959.1", which also leaks float noise). Falls back to the message
 * when there is nothing to compose from.
 */
function detailLine(e: TraceEvent): string | undefined {
  const parts: string[] = [];
  if (e.side) parts.push(e.side.toUpperCase());
  if (e.qty !== undefined) parts.push(qtyText(e.qty));
  if (parts.length === 0) return e.detail;
  let line = parts.join(" ");
  if (e.price !== undefined) line += ` @ ${nf(e.price)}`;
  if (isEntryStage(e.stage) && e.reason) line += ` (${e.reason.replace(/^./, (c) => c.toUpperCase())})`;
  return line;
}

type Cycle = { key: string; symbol?: string; symbolId?: number; side?: string; qty?: number; at?: number; events: TraceEvent[] };

// Prefer the server's cycle id; without one, start a new cycle at each entry-like event so the
// timeline still reads as discrete trades rather than one flat stream.
function groupCycles(events: TraceEvent[]): Cycle[] {
  const cycles: Cycle[] = [];
  for (const e of events) {
    const existing = e.cycleId !== undefined ? cycles.find((c) => c.key === e.cycleId) : undefined;
    let target = existing;
    if (!target) {
      const last = cycles[cycles.length - 1];
      const startsNew =
        e.cycleId !== undefined || !last || isEntryStage(e.stage) || isClosingStage(last.events[last.events.length - 1]?.stage ?? "");
      if (startsNew) {
        target = { key: e.cycleId ?? String(cycles.length), events: [] };
        cycles.push(target);
      } else {
        target = last;
      }
    }
    target.events.push(e);
    // The header describes the cycle, so its identity comes from the opening event.
    target.symbol ??= e.symbol;
    target.symbolId ??= e.symbolId;
    target.side ??= e.side;
    target.qty ??= e.qty;
    target.at ??= e.at;
  }
  return cycles;
}

const pad = (n: number) => String(n).padStart(2, "0");
function formatAt(ms?: number): { date?: string; time?: string } {
  if (ms === undefined) return {};
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return {};
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

function CycleRow({ cycle, symbols, defaultOpen }: { cycle: Cycle; symbols?: { symbol: string }[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { date, time } = formatAt(cycle.at);
  const closed = cycle.events.some((e) => isClosingStage(e.stage));
  const sell = isSell(cycle.side);
  const sideGrad = sell ? GRAD_RED : GRAD_GREEN;
  // `symbol_id` indexes the run manifest's ordered symbol list.
  const symbol = cycle.symbol ?? (cycle.symbolId !== undefined ? symbols?.[cycle.symbolId]?.symbol : undefined);

  return (
    <div className="flex w-full flex-col items-start justify-center border-b border-[#1d2939]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-[52px] w-full cursor-pointer items-center border-b border-[#1d2939] bg-[#151a24] text-left"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5">
          <AltArrowDown weight="Outline" className={cn("size-6 shrink-0 text-white transition-transform", !open && "-rotate-90")} />
          {symbol && <span className="shrink-0 text-sm leading-5 font-semibold text-white">{symbol}</span>}
          {cycle.side && (
            <span className="flex shrink-0 items-center gap-2 text-sm leading-5 font-semibold">
              {/* Solid bullet, kept OUTSIDE the gradient span — under bg-clip-text/text-transparent
                  a currentColor bullet renders invisible. */}
              <span className="size-1 shrink-0 rounded-full" style={{ background: sell ? "#ff135b" : "#67e1c1" }} />
              <span className={sideGrad}>{cycle.side.toUpperCase()}</span>
              {cycle.qty !== undefined && <span className={sideGrad}>({qtyText(cycle.qty)})</span>}
            </span>
          )}
          {(date || time) && (
            <span className="flex shrink-0 items-center gap-2 px-3 py-2.5 text-xs leading-[18px] text-[#9db2ce]">
              {date && <span>{date}</span>}
              {time && <span>{time}</span>}
            </span>
          )}
        </div>
        <div className="flex w-[180px] shrink-0 items-center justify-end px-4 py-2.5">
          <span
            className={cn(
              "shrink-0 rounded-[20px] px-3 py-1 text-xs leading-[18px] font-medium",
              closed ? "bg-[rgba(103,225,193,0.15)]" : "bg-[rgba(53,122,252,0.3)]",
            )}
          >
            <span className={closed ? GRAD_GREEN : GRAD_BLUE}>{closed ? "Closed" : "Open"}</span>
          </span>
        </div>
      </button>

      {open && (
        <div className="relative flex w-full flex-col gap-2 p-4">
          {/* One continuous rail behind the dots, drawn once so it doesn't break at the row gaps. */}
          <span aria-hidden className="absolute top-4 bottom-4 left-7 w-px -translate-x-1/2 bg-[#1d2939]" />
          {cycle.events.map((e, i) => {
            const detail = detailLine(e);
            return (
              <div key={i} className="flex items-start">
                {/* The dot lives inside its own row rather than at a fixed offset, so it stays
                    pinned to its timestamp even when a detail line wraps. */}
                <span className="relative w-6 shrink-0 self-stretch">
                  <span className="absolute top-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full" style={{ background: dotColor(e.stage) }} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col items-start justify-center">
                  <span className="text-xs leading-[18px] text-[#9db2ce]">{formatAt(e.at).time ?? ""}</span>
                  <span className="flex items-start gap-2">
                    <span className="text-xs leading-[18px] font-medium whitespace-nowrap text-white">{stageLabel(e.stage)}</span>
                    {detail && (
                      <>
                        <span className="mt-[9px] h-px w-2 shrink-0 bg-[#9db2ce]" />
                        <span className="text-xs leading-[18px] text-[#9db2ce]">{detail}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TradeCycles({
  runId,
  isLive,
  symbols,
}: {
  runId?: string;
  isLive?: boolean;
  /** The run's ordered symbols, so an event's `symbol_id` can be resolved to a name. */
  symbols?: { symbol: string }[];
}) {
  const { data: history = [], isLoading, isError } = useRunTraceHistory(runId);
  const { events: streamed, state: streamState } = useRunTraceStream(runId, !!isLive);
  const cycles = useMemo(() => groupCycles([...history, ...streamed]), [history, streamed]);

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-lg border border-[#1d2939]">
      <div className="flex w-full shrink-0 items-center justify-between border-b border-[#1d2939] bg-[#151a24] px-4 py-3">
        <span className="text-sm leading-5 font-medium text-white">Trade cycles ({cycles.length})</span>
        {/* Reflect the ACTUAL socket state — a run can be "running" while the tail is still
            connecting or has dropped, and a permanently-green pill made that indistinguishable. */}
        {streamState !== "off" && (
          <span
            className={cn(
              "flex items-center gap-1 rounded-[20px] px-2 py-1",
              streamState === "open" ? "bg-[rgba(103,225,193,0.1)]" : "bg-[rgba(157,178,206,0.1)]",
            )}
          >
            <Record weight="Bold" className={cn("size-4", streamState === "open" ? "text-[#67e1c1]" : "text-[#9db2ce]")} />
            <span className={cn("text-xs leading-[18px]", streamState === "open" ? GRAD_GREEN : "text-[#9db2ce]")}>
              {streamState === "open" ? "Live" : streamState === "connecting" ? "Connecting…" : "Disconnected"}
            </span>
          </span>
        )}
      </div>
      {isError ? (
        <p className="p-4 text-xs text-[#9db2ce]">Trade log unavailable for this run.</p>
      ) : isLoading ? (
        <p className="p-4 text-xs text-[#9db2ce]">Loading trade cycles&hellip;</p>
      ) : cycles.length === 0 ? (
        <p className="p-4 text-xs text-[#9db2ce]">
          {streamState === "open"
            ? "Connected — waiting for this run's first trade."
            : "No trade cycles — this run never journaled one."}
        </p>
      ) : (
        cycles.map((c, i) => <CycleRow key={c.key} cycle={c} symbols={symbols} defaultOpen={i === 0} />)
      )}
    </div>
  );
}
