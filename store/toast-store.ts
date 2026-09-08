import { create } from "zustand";
import type { RiskAlert } from "@/lib/risk-alerts";

// Transient notifications, rendered by components/ui/toast-viewport.tsx. A store rather than a
// context because the only producer (the risk poll in components/risk-alert-watcher.tsx) and the
// viewport sit on opposite sides of the layout tree.
export type Toast = RiskAlert & { id: number };

/**
 * A burst — a portfolio halt stops every account at once — must not bury the screen. The oldest
 * toasts drop off; they were the first to be read.
 */
const MAX_VISIBLE = 4;

let nextId = 0;

type ToastState = {
  toasts: Toast[];
  push: (alerts: RiskAlert[]) => void;
  dismiss: (id: number) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (alerts) =>
    set((s) => ({ toasts: [...s.toasts, ...alerts.map((a) => ({ ...a, id: nextId++ }))].slice(-MAX_VISIBLE) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
