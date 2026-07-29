import type { RunStatus } from "@/types/domain";

// Run-status pill, shared by the Live Trading / Paper Trading / Backtesting lists.
// Figma 14050:24083 renders it as a tinted rounded badge with a coloured label; Live Trading also
// shows a leading dot, so that stays opt-in via `showDot`.
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_YELLOW = "bg-[linear-gradient(158deg,#fffbd6_0%,#f1c617_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

export const RUN_STATUS_META: Record<RunStatus, { label: string; dot: string; bg: string; text: string }> = {
  running: { label: "Running", dot: "#67e1c1", bg: "rgba(103,225,193,0.1)", text: GRAD_GREEN },
  paused: { label: "Paused", dot: "#f1c617", bg: "rgba(241,198,23,0.1)", text: GRAD_YELLOW },
  failed: { label: "Failed", dot: "#ff135b", bg: "rgba(255,19,91,0.1)", text: GRAD_RED },
  stopped: { label: "Stopped", dot: "#9db2ce", bg: "rgba(157,178,206,0.1)", text: "text-[#9db2ce]" },
  completed: { label: "Completed", dot: "#9db2ce", bg: "rgba(157,178,206,0.1)", text: "text-[#9db2ce]" },
  pending: { label: "Pending", dot: "#9db2ce", bg: "rgba(157,178,206,0.1)", text: "text-[#9db2ce]" },
};

export function RunStatusPill({ status, showDot = false }: { status: RunStatus; showDot?: boolean }) {
  const s = RUN_STATUS_META[status];
  if (!s) return <span className="text-xs text-muted-foreground">{status}</span>;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-[20px] px-2 py-1 text-xs"
      style={{ backgroundColor: s.bg }}
    >
      {showDot && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />}
      <span className={s.text}>{s.label}</span>
    </span>
  );
}
