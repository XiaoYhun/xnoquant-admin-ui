"use client";
// Shared chrome for the six MFT "Results" screens (Figma 15204:30669 and siblings). Every screen
// is built from the same four pieces — a metric panel, a chart card, pill tabs and a dropdown
// pill — so they live here once rather than being redrawn per view.
import type { ReactNode } from "react";
import { AltArrowDown } from "@solar-icons/react";

import { cn, formatAmount } from "@/lib/utils";

// Gradient text, clipped to the glyphs. The design uses these for every signed or graded number;
// a flat colour is only correct for a neutral one. Angles are the Figma values rounded to a
// degree — the difference is invisible and the exact figures differ cell to cell in the file.
export const GREEN_TEXT =
  "bg-[linear-gradient(165deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
export const RED_TEXT =
  "bg-[linear-gradient(161deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";
export const YELLOW_TEXT =
  "bg-[linear-gradient(160deg,#fffbd6_0%,#f1c617_100%)] bg-clip-text text-transparent";
export const NEUTRAL_TEXT = "text-white";

/** What the design shows where a figure exists but has no value yet. */
export const EMPTY = "—";

/** Green above zero, red below, neutral when there is nothing to sign. */
export function toneBySign(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return NEUTRAL_TEXT;
  return v >= 0 ? GREEN_TEXT : RED_TEXT;
}

/** Percent from a RATIO (0.184 → "+18.40%"). `/performance` and `/summary-*` return ratios. */
export function pctFromRatio(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return EMPTY;
  return `${v > 0 ? "+" : ""}${formatAmount(v * 100, digits)}%`;
}

/** Percent from a value ALREADY in percent (the `returns` series, monthly grids). */
export function pctFromPercent(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return EMPTY;
  return `${v > 0 ? "+" : ""}${formatAmount(v, digits)}%`;
}

export function num(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return EMPTY;
  return formatAmount(v, digits);
}

export function count(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return EMPTY;
  return v.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Metric panel — Figma 15212:61333. Rows of four label/value pairs inside one bordered card,
// separated by hairlines. Used by Performance, Risk, Execution, Cost & Edge and Regime.
// ---------------------------------------------------------------------------

export interface Metric {
  label: string;
  /** Pre-formatted; `EMPTY` where the MFT API has no source for this figure. */
  value: string;
  /** Small trailing note, baseline-aligned with the value (e.g. "median 2h05m", "USDT"). */
  sub?: string;
  /** One of the gradient/flat classes above. Defaults to white. */
  tone?: string;
}

function MetricCell({ metric }: { metric: Metric }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className="truncate text-xs leading-[18px] text-[#9db2ce]">{metric.label}</span>
      <div className="flex items-end gap-1">
        <span className={cn("text-base leading-5 font-semibold", metric.tone ?? NEUTRAL_TEXT)}>
          {metric.value}
        </span>
        {metric.sub && (
          <span className="text-[10px] leading-[14px] whitespace-nowrap text-[#9db2ce]">
            {metric.sub}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * One or more rows of four metrics. Pass each row as its own array — the design draws a hairline
 * between rows, and a single flat list would wrap without one.
 */
export function MetricPanel({ rows }: { rows: Metric[][] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[#1d2939] bg-[rgba(29,33,38,0.2)] px-3 py-2">
      {rows.map((row, i) => (
        <div key={i} className="flex w-full min-w-0 flex-col gap-2">
          {i > 0 && <div className="h-px w-full bg-[#1d2939]" />}
          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
            {row.map((m) => (
              <MetricCell key={m.label} metric={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart card — Figma 15227:70309 / 15227:70550. Header bar on Surface-main over a Container-dark
// body. The header is 36px tall on its own and 44px when it carries a control, which is why the
// vertical padding switches rather than being fixed.
// ---------------------------------------------------------------------------

export function ChartCard({
  title,
  right,
  children,
  bodyClassName,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#1d2939] bg-background">
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-[#1d2939] bg-[#151a24] px-4",
          right ? "py-1.5" : "py-2",
        )}
      >
        <span className="text-sm leading-5 font-medium text-white">{title}</span>
        {right && <div className="flex shrink-0 items-center gap-3">{right}</div>}
      </div>
      <div className={cn("min-w-0 p-4", bodyClassName)}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pill tabs — Figma 15205:55577 (views) and 15205:55607 (period). Not the shared `Tabs` primitive:
// that one paints a Black-800 track behind the whole row, and this design has no track, only the
// active pill.
// ---------------------------------------------------------------------------

export function PillTabs<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** `md` = the view tabs (py-1.5, 8px gap); `sm` = the period pills (py-1, 12px gap). */
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center", size === "md" ? "gap-2" : "gap-3", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={cn(
            "cursor-pointer rounded-[40px] px-3 text-xs leading-[18px] whitespace-nowrap transition-colors",
            size === "md" ? "py-1.5" : "py-1",
            o.value === value ? "bg-[#1d2939] text-white" : "text-[#9db2ce] hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Two-up segmented control on a filled track — Figma 15236:33366, the Year/Month switch. Distinct
 * from `PillTabs` because the active pill here is a raised Surface-main chip inside a Black-800
 * track, not a flat Black-800 pill on nothing.
 */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-[44px] border border-[#1d2939] bg-[#1d2939] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={cn(
            "cursor-pointer rounded-[40px] px-3 py-1 text-xs leading-[18px] whitespace-nowrap transition-colors",
            o.value === value
              ? "bg-[#151a24] text-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
              : "text-[#9db2ce]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The `<xno>Button` dropdown look — Figma 15205:55580. Rendering only; the caller owns the menu. */
export function DropdownPill({
  label,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 shrink-0 cursor-pointer items-center gap-3 rounded-[40px] border border-[#1d2939] bg-[#0a0e14] pr-2 pl-3 text-xs font-medium whitespace-nowrap text-white",
        className,
      )}
      {...props}
    >
      {label}
      <AltArrowDown weight="Outline" className="size-5 shrink-0 opacity-70" />
    </button>
  );
}

/**
 * Row of unavailable-metric placeholders. Several panels in the design are driven by trade-level
 * or microstructure data the MFT engine does not report; rather than omit them (which would change
 * the layout) they render their labels with `EMPTY` values.
 */
export function emptyMetrics(labels: string[]): Metric[] {
  return labels.map((label) => ({ label, value: EMPTY }));
}

/**
 * Why a panel is empty. Without this an em-dash grid is indistinguishable from a fetch that
 * silently failed, and the reason ("the MFT engine reports no per-trade fills") is the single most
 * useful thing the panel can say until the API grows the field.
 */
export function NoSourceNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-[#1d2939] px-3 py-2 text-[11px] leading-[16px] text-[#9db2ce]">
      {children}
    </p>
  );
}
