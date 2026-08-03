"use client";
// Create Strategy → Results → Latency (Figma 14819:25500). One card per pipeline stage, each
// showing AVG / LAST / MAX.
//
// Mocked on purpose: HFT exposes no latency telemetry. The only `latency` in the spec is
// `ExecutionSettings.latency` (`LatencyModel`), which is a *simulation input* shaping the
// backtest/paper gateway — not a measurement of the running engine. Swap STAGES for a hook once
// an endpoint lands.

type Stage = {
  title: string;
  /** The span being measured, as the design labels it. */
  flow: string;
  avg: string;
  last: string;
  max: string;
};

const STAGES: Stage[] = [
  {
    title: "Feature evaluation",
    flow: "market event → context ready",
    avg: "3.0 µs",
    last: "19.7 µs",
    max: "17.80 ms",
  },
  {
    title: "Rhai script",
    flow: "context → intent",
    avg: "7.3 µs",
    last: "229.3 µs",
    max: "3.13 ms",
  },
];

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-base leading-5 font-semibold text-white">{value}</span>
    </div>
  );
}

export function LatencyView() {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {STAGES.map((stage) => (
        <div key={stage.title} className="min-w-0 overflow-hidden rounded-xl border border-border">
          <div className="flex flex-col gap-0.5 border-b border-border bg-surface px-3 py-2">
            <span className="truncate text-sm font-medium text-white">{stage.title}</span>
            <span className="truncate text-xs text-muted-foreground">{stage.flow}</span>
          </div>
          <div className="flex min-w-0 gap-4 px-3 py-3">
            <Metric label="AVG" value={stage.avg} />
            <Metric label="LAST" value={stage.last} />
            <Metric label="MAX" value={stage.max} />
          </div>
        </div>
      ))}
    </div>
  );
}
