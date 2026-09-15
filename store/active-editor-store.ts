import { create } from "zustand";
import { persist } from "zustand/middleware";

// Which strategy tab the Create Strategy page was last on, so a reload lands back where you were
// instead of resetting to the leftmost tab. The id is validated against the loaded editors before
// use — a remembered strategy can be deleted, or belong to another account signed in on the same
// browser — so a stale entry simply falls back.
type ActiveEditorState = {
  activeEditorId?: string;
  setActiveEditor: (id: string) => void;
};

export const useActiveEditorStore = create<ActiveEditorState>()(
  persist(
    (set) => ({
      activeEditorId: undefined,
      setActiveEditor: (id) => set({ activeEditorId: id }),
    }),
    { name: "xnoquant-active-editor" },
  ),
);
