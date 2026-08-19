"use client";
// Shared card shell for the Results tab charts — Figma 14180:16901: a title row (14px medium
// white, 16/12 inset, Surface-main background, bottom border) carrying an optional control and the
// expand affordance on the right, above the chart body.
import { MaximizeSquareMinimalistic } from "@solar-icons/react";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  controls,
  children,
  className,
  expandable = true,
}: {
  title: string;
  /** Right-aligned control (period select, unit toggle…), shown before the expand button. */
  controls?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Figma omits the expand affordance on some panels (15039:42982 / 15039:43339). */
  expandable?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border border-border", className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3">
        <span className="truncate text-sm font-medium text-white">{title}</span>
        <div className="flex shrink-0 items-center gap-3">
          {controls}
          {expandable && (
            <button
              type="button"
              aria-label={`Expand ${title}`}
              className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-white"
            >
              <MaximizeSquareMinimalistic className="size-5" />
            </button>
          )}
        </div>
      </div>
      <div className="min-w-0 p-4">{children}</div>
    </div>
  );
}

/** Muted caption for a chart showing placeholder data instead of a live series. */
export function MockNote({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 text-[10px] leading-[14px] text-muted-foreground">{children}</span>;
}
