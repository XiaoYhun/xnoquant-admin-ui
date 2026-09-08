"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, CloseCircle, DangerCircle, DangerTriangle } from "@solar-icons/react";
import { useToastStore, type Toast } from "@/store/toast-store";
import { GRAD_GREEN, GRAD_RED, GRAD_YELLOW } from "@/app/(dashboard)/risk-management/risk-bits";
import type { RiskLevel } from "@/types/domain";

// Bottom-right toast stack. Same tinted-icon / gradient-label family as the risk pills, so an
// alert reads as the same object as the row it came from on the Risk Management table.

const AUTO_DISMISS_MS = 6_000;

// The gradient classes are text-only (`bg-clip-text`), so the icon takes the solid end-stop of
// the same ramp instead — an SVG painted with `text-transparent` renders as nothing.
const STYLE: Record<
  RiskLevel,
  { icon: typeof DangerCircle; tint: string; grad: string; ring: string; solid: string }
> = {
  red: { icon: DangerTriangle, tint: "rgba(229,17,82,0.2)", grad: GRAD_RED, ring: "rgba(229,17,82,0.5)", solid: "#ff135b" },
  yellow: { icon: DangerCircle, tint: "rgba(241,198,23,0.2)", grad: GRAD_YELLOW, ring: "rgba(241,198,23,0.4)", solid: "#f1c617" },
  ok: { icon: CheckCircle, tint: "rgba(103,225,193,0.1)", grad: GRAD_GREEN, ring: "rgba(103,225,193,0.35)", solid: "#67e1c1" },
};

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const style = STYLE[toast.severity];
  const Icon = style.icon;

  // A Red alert means trading was halted or an account breached its limit — it stays until the
  // admin acknowledges it. Warnings and recoveries time out on their own.
  useEffect(() => {
    if (toast.severity === "red") return;
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, toast.severity, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.97 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      role="alert"
      className="pointer-events-auto flex w-[340px] items-start gap-3 rounded-xl border border-border bg-background p-3 shadow-[0_8px_24px_0_rgba(0,0,0,0.4)]"
      style={{ borderColor: style.ring }}
    >
      <span
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: style.tint }}
      >
        <Icon weight="Outline" className="size-4" style={{ color: style.solid }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${style.grad}`}>{toast.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{toast.detail}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
        className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-white"
      >
        <CloseCircle weight="Outline" className="size-4" />
      </button>
    </motion.div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-6 bottom-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
