import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Mode } from "./mode-store";

// Which strategy tab the Create Strategy page was last on, so a reload lands back where you were
// instead of resetting to the leftmost tab. Kept per lab mode: HFT and MFT are separate
// workspaces (page.tsx remounts the builder on `key={mode}`), so each remembers its own tab.
//
// Persisted the same way as the lab mode itself (store/mode-store.ts). The id is validated
// against the loaded editors before use — a remembered strategy can be deleted, or belong to
// another account signed in on the same browser — so a stale entry simply falls back.
type ActiveEditorState = {
  byMode: Partial<Record<Mode, string>>;
  setActiveEditor: (mode: Mode, id: string) => void;
};

export const useActiveEditorStore = create<ActiveEditorState>()(
  persist(
    (set) => ({
      byMode: {},
      setActiveEditor: (mode, id) => set((s) => ({ byMode: { ...s.byMode, [mode]: id } })),
    }),
    { name: "xnoquant-active-editor" },
  ),
);
