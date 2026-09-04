// Loading / empty / failed presentation for charts. Before this, all three rendered as the same
// blank ECharts grid with a 10px caption in the card header, so a chart that had failed was
// indistinguishable from one that was still fetching or one that legitimately had no points.
//
// The look is mft-results-view's StatusCard (icon tile + title + detail) scaled down to sit inside
// a ChartCard body, so the page-level and chart-level states read as one family.
import { Danger, Database } from "@solar-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** `idle` is "nothing asked for yet" (no run picked) — a blank chart, but not a failure. */
export type ChartStatus = "ready" | "loading" | "idle" | "empty" | "error";

/** For views that derive one state and hand it to several panels. */
export interface ChartStateProps {
  status?: ChartStatus;
  detail?: string;
}

const TITLE: Record<Exclude<ChartStatus, "ready" | "loading">, string> = {
  idle: "No run selected",
  empty: "No data yet",
  error: "Chart unavailable",
};

// Fixed silhouette rather than random heights: a chart skeleton that reshuffles on every render
// reads as data loading in, which is exactly the wrong signal.
const BAR_HEIGHTS = [42, 68, 55, 82, 47, 73, 60, 90, 51, 66];

/**
 * Collapses a query's flags into one status, in the order the UI has to respect: nothing-asked-for
 * beats still-fetching, which beats failed, which beats returned-nothing. Encoding the precedence
 * once stops the call sites from each inventing their own ternary chain.
 */
export function chartStatus(flags: { idle?: boolean; loading?: boolean; error?: boolean; empty?: boolean }): ChartStatus {
  if (flags.idle) return "idle";
  if (flags.loading) return "loading";
  if (flags.error) return "error";
  if (flags.empty) return "empty";
  return "ready";
}

/** Chart-shaped shimmer — bars over a baseline, so the box holds its size while data lands. */
export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="flex w-full flex-col gap-2" style={{ height }} aria-busy="true" aria-label="Loading chart">
      <div className="flex flex-1 items-end gap-1.5 px-1">
        {BAR_HEIGHTS.map((h, i) => (
          <Skeleton key={i} className="min-w-0 flex-1 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
      <Skeleton className="h-1.5 w-full shrink-0 rounded-sm opacity-60" />
    </div>
  );
}

function StateCard({ status, detail, height }: { status: Exclude<ChartStatus, "ready" | "loading">; detail?: string; height: number }) {
  const danger = status === "error";
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2.5 px-4 text-center" style={{ height }}>
      <div
        className="rounded-[10px] border border-border bg-background p-2.5"
        // The red bloom is StatusCard's, dialled down — at chart scale the full four-layer glow
        // swamps a 240px box.
        style={danger ? { boxShadow: "0 0 4px 0 rgba(255,19,91,0.30), 0 0 14px 0 rgba(255,19,91,0.55)" } : undefined}
      >
        {danger ? (
          <Danger weight="Outline" className="size-5 text-destructive" />
        ) : (
          <Database weight="Outline" className="size-5 text-muted-foreground" />
        )}
      </div>
      <span className={cn("text-sm font-medium", danger ? "text-destructive" : "text-white")}>{TITLE[status]}</span>
      {detail && <span className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">{detail}</span>}
    </div>
  );
}

/**
 * Wraps a chart body. Anything other than `ready` replaces the children entirely — a half-drawn
 * chart under an error message is worse than no chart.
 *
 * `detail` is the call site's own explanation ("Cost curve unavailable", "No cost points"); the
 * title above it comes from the status.
 *
 * `children` is optional because a panel whose data source does not exist at all (several of the
 * MFT Results panels) has no chart body to wrap — it is permanently `empty` and only ever renders
 * the state card.
 */
export function ChartState({
  status = "ready",
  detail,
  height = 240,
  children,
}: {
  status?: ChartStatus;
  detail?: string;
  height?: number;
  children?: React.ReactNode;
}) {
  if (status === "ready") return <>{children}</>;
  if (status === "loading") return <ChartSkeleton height={height} />;
  return <StateCard status={status} detail={detail} height={height} />;
}
