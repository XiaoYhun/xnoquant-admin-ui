"use client";
import { cn, formatAmount } from "@/lib/utils";
import type { RiskLevel } from "@/types/domain";

// Shared presentation for both Risk Management tabs (Figma 14975:41599 / 14975:44103).
// Same tinted-badge construction as components/run-status-pill.tsx — tinted background, gradient
// label — so the risk pills read as part of the same family as the run-status ones.
export const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
export const GRAD_YELLOW = "bg-[linear-gradient(158deg,#fffbd6_0%,#f1c617_100%)] bg-clip-text text-transparent";
export const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

export const DASH = <span className="text-muted-foreground">—</span>;

export function Pill({
  label,
  bg,
  text,
  className,
}: {
  label: string;
  bg: string;
  text: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center rounded-[20px] px-2 py-1 text-xs whitespace-nowrap", className)}
      style={{ backgroundColor: bg }}
    >
      <span className={text}>{label}</span>
    </span>
  );
}

/** Account-scope status. The API only ever reports `ok`/`yellow` here (see RiskLevel). */
export function AccountLevelPill({ level }: { level: RiskLevel }) {
  if (level === "yellow") {
    return <Pill label="Yellow alert" bg="rgba(241,198,23,0.2)" text={GRAD_YELLOW} />;
  }
  if (level === "red") return <Pill label="Red alert" bg="rgba(229,17,82,0.2)" text={GRAD_RED} />;
  return <Pill label="Normal" bg="rgba(103,225,193,0.1)" text={GRAD_GREEN} />;
}

/**
 * Drawdown and thresholds arrive as fractions of the high-water mark (`0.05` = 5%) and are always
 * a loss, so they render negative — matching the design's "-6.4%" / "-5%". Zero is the exception:
 * an account at its high-water mark is flat, not down, and "-0.0%" reads as a bug.
 */
export function pctLabel(fraction: number | null | undefined, digits = 1): string | null {
  if (fraction == null || !Number.isFinite(fraction)) return null;
  const pct = Math.abs(fraction) * 100;
  if (pct === 0) return `${formatAmount(0, digits)}%`;
  // A real but sub-resolution figure (the dev platform has thresholds as tight as 0.0001) must
  // not print as "-0.0%" — that reads as flat, which is the opposite of what it means.
  const floor = 10 ** -digits;
  if (pct < floor) return `-<${formatAmount(floor, digits)}%`;
  return `-${formatAmount(pct, digits)}%`;
}

/** Capital, in the settlement currency the rest of the app prints for run figures. */
export function moneyLabel(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return `${formatAmount(amount)} ₫`;
}

/** `2026-06-11` over `09:20:47.123` — two lines, same split the Trades tab uses. */
export function TimeCell({ iso }: { iso: string }) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <span className="text-white">{iso}</span>;
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="leading-tight whitespace-nowrap">
      <div className="text-white">{`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`}</div>
      <div className="text-muted-foreground">
        {`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`}
      </div>
    </div>
  );
}
