"use client";
import { useState } from "react";
import { AltArrowDown } from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, shortRunId } from "@/lib/utils";
import { useStrategyRuns } from "@/hooks/api/use-strategy-runs";
import type { Run } from "@/types/domain";

// Run history picker for the Results tab — Figma 14175:48186 (trigger) / 14256:148354 (list).
// "Run history: #<id> ⌄" opens a list of every run of the current strategy; picking one points the
// results views at that run.
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

// The design badges a run as Success / Failed; anything still in flight keeps its own label.
function statusBadge(status: string): { label: string; bg: string; text: string } {
  if (status === "completed") return { label: "Success", bg: "rgba(103,225,193,0.1)", text: GRAD_GREEN };
  if (status === "failed") return { label: "Failed", bg: "rgba(255,19,91,0.1)", text: GRAD_RED };
  return {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    bg: "rgba(157,178,206,0.1)",
    text: "text-[#9db2ce]",
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `2026-08-03 16:33:16` in the reader's own timezone. `created_at` is RFC3339 UTC, so slicing the
 * raw string (what this used to do) printed a UTC clock with no marker — seven hours off for a
 * reader in Vietnam, and silently wrong rather than obviously wrong.
 */
function formatRunTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}


export function RunHistoryPicker({
  strategyId,
  selectedRunId,
  onSelect,
}: {
  strategyId?: string;
  selectedRunId?: string;
  onSelect: (run: Run) => void;
}) {
  const { data: runs = [], isLoading } = useStrategyRuns(strategyId);
  const selected = runs.find((r) => r.id === selectedRunId) ?? runs[0];
  // Controlled so picking a run dismisses the list — the results below have already changed.
  const [open, setOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-sm font-medium text-white">Run history:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={runs.length === 0}
            className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-[40px] border border-border bg-background px-3 text-xs text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? "Loading…" : selected ? shortRunId(selected.id) : "No runs"}
            <AltArrowDown weight="Outline" className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[340px] p-0">
          {runs.length === 0 ? (
            <p className="px-4 py-3 text-xs text-[#9db2ce]">This strategy has no runs yet.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {runs.map((r) => {
                const badge = statusBadge(r.status);
                const on = r.id === selected?.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onSelect(r);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-start justify-between gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface",
                      on && "bg-surface",
                    )}
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-xs text-white">{shortRunId(r.id)}</span>
                      <span className="truncate text-xs text-[#9db2ce]">{formatRunTime(r.created_at)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className="rounded-[20px] px-2 py-0.5 text-[11px]"
                        style={{ backgroundColor: badge.bg }}
                      >
                        <span className={badge.text}>{badge.label}</span>
                      </span>
                      <span className="text-xs text-[#9db2ce]">
                        Sharpe: {r.sharpe_annualized == null ? "—" : r.sharpe_annualized.toFixed(2)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
