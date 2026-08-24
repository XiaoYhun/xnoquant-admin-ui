"use client";
// The four facts about the run the Results views are describing, on one line under the tab row.
// Mode and status are deliberately absent — the run-history picker beside the tabs already badges
// both, and repeating them would spend the strip on what the reader can see.
//
// Each fact is led by an icon rather than separated by a bullet: a bare dotted list left the
// reader guessing which value was the symbol and which the account. The icon says what the value
// IS at a glance, and hovering names the field in a word — nothing more, since the value is
// already on screen. The one exception is a multi-symbol run, where the strip prints "+2" and the
// tip is the only place the other tickers exist.
//
// Everything here is read off `manifest`, which the picker's `useStrategyRuns` query has already
// fetched, so the strip costs no request of its own. The manifest is a launch-time snapshot and
// never changes, so the selected run is a good enough source even while a live run is streaming.
import { useMemo, type ComponentType } from "react";
import { Calendar, Pulse, TagPrice, Wallet } from "@solar-icons/react";
import type { IconProps } from "@solar-icons/react";
import { format, formatDistanceStrict, isSameDay, isSameYear, isValid, parseISO } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { settlementCurrencyOf, strategyGroup, timeframeLabel } from "@/lib/transform/runs";
import type { Run } from "@/types/domain";

/** `tip` names the field the value belongs to — a word or two, not a sentence. */
type Segment = { icon: ComponentType<IconProps>; text: string; tip: string };

function symbolSegment(run: Run): Segment | null {
  const names = [...new Set(run.manifest.symbols.map((s) => s.symbol).filter(Boolean))];
  if (names.length === 0) return null;
  return {
    icon: TagPrice,
    text: names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`,
    // The hidden tickers live nowhere else, so they ride along behind the field name here.
    tip: names.length === 1 ? "Symbol" : `Symbols: ${names.join(", ")}`,
  };
}

// "HFT tick data" / "MFT 5min bars" — which engine ran, and what it was fed. Omitted rather than
// guessed when the manifest predates `data_kind`: `strategyGroup` defaults to MFT, which would be
// a lie on an HFT run.
function engineSegment(run: Run): Segment | null {
  const dataKind = run.manifest.data_kind;
  if (!dataKind) return null;
  const group = strategyGroup(dataKind);
  const isTick = dataKind.kind === "tick";
  return {
    icon: Pulse,
    text: isTick ? `${group} tick data` : `${group} ${timeframeLabel(dataKind)} bars`,
    tip: "Engine & market data",
  };
}

// The account the run traded through, and the currency every money figure below is counted in.
function accountSegment(run: Run): Segment | null {
  const account = run.manifest.account;
  if (!account) return null;
  const venue = account.venue_name || account.venue_type;
  const currency = settlementCurrencyOf(run.manifest);
  return {
    icon: Wallet,
    text: `${account.name} @ ${venue} (${currency})`,
    tip: "Account",
  };
}

const parse = (iso: string): Date | null => {
  const d = parseISO(iso);
  return isValid(d) ? d : null;
};

/** Inclusive day count of a backtest window — Jul 15 → Jul 18 is four days of data, not three. */
function inclusiveDays(start: Date, end: Date): string {
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return `${days} day${days === 1 ? "" : "s"}`;
}

// The period the metrics cover: a backtest names the historical window it replayed, a paper/live
// run names the wall-clock span it has been up for. Repeated parts are dropped — a same-day
// backtest reads "Jul 23, 2026", not "Jul 23, 2026 → Jul 23, 2026".
function windowSegment(run: Run, now: number): Segment | null {
  const range = run.manifest.backtest_range;
  if (range) {
    const start = parse(range.start_date);
    const end = parse(range.end_date);
    if (!start || !end) return null;
    const span = inclusiveDays(start, end);
    const text = isSameDay(start, end)
      ? `${format(start, "MMM d, yyyy")} (1 day)`
      : isSameYear(start, end)
        ? `${format(start, "MMM d")} → ${format(end, "MMM d, yyyy")} (${span})`
        : `${format(start, "MMM d, yyyy")} → ${format(end, "MMM d, yyyy")} (${span})`;
    return { icon: Calendar, text, tip: "Period" };
  }
  if (!run.started_at) return null;
  const started = parse(run.started_at);
  if (!started) return null;
  const stopped = run.stopped_at ? parse(run.stopped_at) : null;
  const span = formatDistanceStrict(stopped ?? new Date(now), started);
  const endText = !stopped
    ? "now"
    : format(stopped, isSameDay(started, stopped) ? "HH:mm" : "MMM d HH:mm");
  return { icon: Calendar, text: `${format(started, "MMM d HH:mm")} → ${endText} (${span})`, tip: "Period" };
}

/** The strip's segments, in display order. Empty when there is no run to describe. */
export function runMetaSegments(run: Run | undefined, now: number = Date.now()): Segment[] {
  if (!run?.manifest) return [];
  return [symbolSegment(run), engineSegment(run), accountSegment(run), windowSegment(run, now)].filter(
    (s): s is Segment => s !== null,
  );
}

export function RunMetaStrip({ run }: { run?: Run }) {
  const segments = useMemo(() => runMetaSegments(run), [run]);
  if (segments.length === 0) return null;
  return (
    // Wider gap between facts than within one, so the icon reads as belonging to the value it
    // leads rather than to the value before it.
    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5 text-xs leading-[18px]">
      {segments.map(({ icon: Icon, text, tip }) => (
        <Tooltip key={text}>
          <TooltipTrigger asChild>
            <span className="flex min-w-0 cursor-default items-center gap-1.5">
              <Icon weight="Outline" className="size-3.5 shrink-0 text-[#9db2ce]" />
              <span className="truncate text-white">{text}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{tip}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
