"use client";
import { useMemo, useState } from "react";
import { AltArrowDown, Record } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useRunTraceHistory, useRunTraceStream, type TraceEvent } from "@/hooks/api/use-run-trace";

// Trade cycles panel — Figma node 14727:36059. A run's trade-cycle console log, grouped into
// cycles: each cycle is a collapsible header (symbol, side, qty, timestamp, status) over a
// timeline of its lifecycle events (Entry → Order submitted → Filled).

const GRAD_GREEN = "bg-[linear-gradient(159deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";
const GRAD_BLUE = "bg-[linear-gradient(162deg,#cfdbf8_0%,#2d84ff_100%)] bg-clip-text text-transparent";

// A fill is a milestone, not the end: the position stays Open until an exit/cancel/reject lands.
// (Figma 14727:36059 shows a filled entry still badged "Open".)
const isFillStage = (stage: string) => /fill/i.test(stage);
const isClosingStage = (stage: string) => /close|exit|cancel|reject/i.test(stage);
const isSell = (side?: string) => !!side && /sell|short/i.test(side);

type Cycle = { key: string; symbol?: string; side?: string; qty?: number; at?: string; events: TraceEvent[] };

// Prefer the server's cycle id; without one, start a new cycle at each entry-like event so the
// timeline still reads as discrete trades rather than one flat stream.
function groupCycles(events: TraceEvent[]): Cycle[] {
  const cycles: Cycle[] = [];
  for (const e of events) {
    const existing = e.cycleId ? cycles.find((c) => c.key === e.cycleId) : undefined;
    if (existing) {
      existing.events.push(e);
      existing.qty ??= e.qty;
      existing.side ??= e.side;
      existing.symbol ??= e.symbol;
      continue;
    }
    const last = cycles[cycles.length - 1];
    const startsNew = !!e.cycleId || !last || /entry|signal|open/i.test(e.stage) || isClosingStage(last.events[last.events.length - 1]?.stage ?? "");
    if (startsNew) {
      cycles.push({ key: e.cycleId ?? `${cycles.length}`, symbol: e.symbol, side: e.side, qty: e.qty, at: e.at, events: [e] });
    } else {
      last.events.push(e);
      last.qty ??= e.qty;
      last.side ??= e.side;
      last.symbol ??= e.symbol;
    }
  }
  return cycles;
}

function formatAt(at?: string): { date?: string; time?: string } {
  if (!at) return {};
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return { time: at };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

function CycleRow({ cycle, defaultOpen }: { cycle: Cycle; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { date, time } = formatAt(cycle.at);
  const closed = cycle.events.some((e) => isClosingStage(e.stage));
  const sideGrad = isSell(cycle.side) ? GRAD_RED : GRAD_GREEN;

  return (
    <div className="flex w-full flex-col items-start justify-center border-b border-[#1d2939]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-[52px] w-full cursor-pointer items-center border-b border-[#1d2939] bg-[#151a24] text-left"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5">
          <AltArrowDown
            weight="Outline"
            className={cn("size-6 shrink-0 text-white transition-transform", !open && "-rotate-90")}
          />
          {cycle.symbol && <span className="shrink-0 text-sm font-semibold text-white">{cycle.symbol}</span>}
          {cycle.side && (
            <span className={cn("flex shrink-0 items-center gap-2 text-sm font-semibold", sideGrad)}>
              <span className="mr-1 inline-block size-1 rounded-full bg-current align-middle" />
              {cycle.side.toUpperCase()}
              {cycle.qty != null && <span>({cycle.qty})</span>}
            </span>
          )}
          <span className="flex shrink-0 items-center gap-2 px-3 py-2.5 text-xs text-[#9db2ce]">
            {date && <span>{date}</span>}
            {time && <span>{time}</span>}
          </span>
        </div>
        <div className="flex w-[180px] shrink-0 items-center justify-end px-4 py-2.5">
          <span
            className={cn(
              "shrink-0 rounded-[20px] px-3 py-1 text-xs font-medium",
              closed ? "bg-[rgba(103,225,193,0.15)]" : "bg-[rgba(53,122,252,0.3)]",
            )}
          >
            <span className={closed ? GRAD_GREEN : GRAD_BLUE}>{closed ? "Closed" : "Open"}</span>
          </span>
        </div>
      </button>

      {open && (
        <div className="flex w-full items-center p-4">
          <div className="relative flex w-6 shrink-0 flex-col items-center self-stretch">
            <div className="w-px flex-1 bg-[#1d2939]" />
            {cycle.events.map((e, i) => (
              <span
                key={i}
                className={cn(
                  "absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full",
                  isFillStage(e.stage) || isClosingStage(e.stage) ? "bg-[#67e1c1]" : "bg-[#357afc]",
                )}
                style={{ top: `${i * 44 + 5}px` }}
              />
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            {cycle.events.map((e, i) => (
              <div key={i} className="flex flex-col items-start justify-center">
                <span className="text-xs text-[#9db2ce]">{formatAt(e.at).time ?? e.at}</span>
                <span className="flex items-start gap-2">
                  <span className="text-xs font-medium text-white">{e.stage}</span>
                  {e.detail && (
                    <>
                      <span className="mt-[9px] h-px w-2 shrink-0 bg-[#9db2ce]" />
                      <span className="text-xs text-[#9db2ce]">{e.detail}</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TradeCycles({ runId, isLive }: { runId?: string; isLive?: boolean }) {
  const { data: history = [], isLoading, isError } = useRunTraceHistory(runId);
  const streamed = useRunTraceStream(runId, !!isLive);
  const cycles = useMemo(() => groupCycles([...history, ...streamed]), [history, streamed]);

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-lg border border-[#1d2939]">
      <div className="flex w-full shrink-0 items-center justify-between border-b border-[#1d2939] bg-[#151a24] px-4 py-3">
        <span className="text-sm font-medium text-white">Trade cycles ({cycles.length})</span>
        {isLive && (
          <span className="flex items-center gap-1 rounded-[20px] bg-[rgba(103,225,193,0.1)] px-2 py-1">
            <Record weight="Bold" className="size-4 text-[#67e1c1]" />
            <span className={cn("text-xs", GRAD_GREEN)}>Live</span>
          </span>
        )}
      </div>
      {isError ? (
        <p className="p-4 text-xs text-[#9db2ce]">Trade log unavailable for this run.</p>
      ) : isLoading ? (
        <p className="p-4 text-xs text-[#9db2ce]">Loading trade cycles&hellip;</p>
      ) : cycles.length === 0 ? (
        <p className="p-4 text-xs text-[#9db2ce]">No trade cycles — this run never journaled one.</p>
      ) : (
        cycles.map((c, i) => <CycleRow key={c.key} cycle={c} defaultOpen={i === 0} />)
      )}
    </div>
  );
}
