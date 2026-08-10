"use client";
// Create Strategy → Results → Latency (Figma 14819:25500). One card per pipeline stage, each
// showing AVG / LAST / MAX.
//
// Source: the `alpha_timing` block on the `/api/runs/{id}/live/stream` snapshot, read off the
// shared `LiveSnapshotProvider`. It reports the two engine stages this view already showed —
// `feature_eval_ns_*` and `rhai_eval_ns_*` — in nanoseconds.
//
// Note this is engine telemetry, published only while a run is RUNNING; it is not persisted to
// any REST results endpoint, so a finished run has nothing to show and renders "—".
// (`ExecutionSettings.latency` / `LatencyModel` in the spec is unrelated — a simulation *input*
// shaping the backtest gateway, not a measurement.)
import { useLiveSnapshot, type AlphaTiming } from "@/hooks/api/use-run-live-snapshot";

type Stage = {
  title: string;
  /** The span being measured, as the design labels it. */
  flow: string;
  avgNs?: number;
  lastNs?: number;
  maxNs?: number;
};

const MICRO_NS = 1_000;
const MILLI_NS = 1_000_000;

/**
 * Nanoseconds in the unit that keeps the number readable, matching the design's own precision
 * (µs to one decimal, ms to two). Sub-microsecond values stay in ns rather than rendering "0.0 µs".
 */
export function formatLatencyNs(ns: number | undefined): string {
  if (ns === undefined || !Number.isFinite(ns)) return "—";
  if (ns < MICRO_NS) return `${Math.round(ns)} ns`;
  if (ns < MILLI_NS) return `${(ns / MICRO_NS).toFixed(1)} µs`;
  return `${(ns / MILLI_NS).toFixed(2)} ms`;
}

function stagesFrom(timing: AlphaTiming | undefined): Stage[] {
  return [
    {
      title: "Feature evaluation",
      flow: "market event → context ready",
      avgNs: timing?.featureEvalAvgNs,
      lastNs: timing?.featureEvalLastNs,
      maxNs: timing?.featureEvalMaxNs,
    },
    {
      title: "Rhai script",
      flow: "context → intent",
      avgNs: timing?.rhaiEvalAvgNs,
      lastNs: timing?.rhaiEvalLastNs,
      maxNs: timing?.rhaiEvalMaxNs,
    },
  ];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-base leading-5 font-semibold text-white">{value}</span>
    </div>
  );
}

export function LatencyView({ isLive }: { isLive?: boolean }) {
  const { snapshot, state } = useLiveSnapshot();
  const timing = snapshot?.alphaTiming;
  const stages = stagesFrom(timing);

  const note = !isLive
    ? "Engine timing is published only while a run is running."
    : state === "connecting"
      ? "Connecting…"
      : state === "error"
        ? "Live stream unavailable."
        : !timing
          ? "Waiting for timing samples…"
          : timing.samples !== undefined
            ? `${timing.samples.toLocaleString()} samples`
            : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {stages.map((stage) => (
          <div key={stage.title} className="min-w-0 overflow-hidden rounded-xl border border-border">
            <div className="flex flex-col gap-0.5 border-b border-border bg-surface px-3 py-2">
              <span className="truncate text-sm font-medium text-white">{stage.title}</span>
              <span className="truncate text-xs text-muted-foreground">{stage.flow}</span>
            </div>
            <div className="flex min-w-0 gap-4 px-3 py-3">
              <Metric label="AVG" value={formatLatencyNs(stage.avgNs)} />
              <Metric label="LAST" value={formatLatencyNs(stage.lastNs)} />
              <Metric label="MAX" value={formatLatencyNs(stage.maxNs)} />
            </div>
          </div>
        ))}
      </div>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}
