import { create } from "zustand";
import { persist } from "zustand/middleware";

// Which strategy tabs are pinned to the left of the Create Strategy tab strip, per account —
// several accounts can sign in on the same browser, so pins are keyed by account id. Strategy
// ids are unique across the HFT and MFT labs, so one list per account covers both. An id that no
// longer loads (deleted, or belongs to another account) is simply ignored at render time.
type PinnedEditorState = {
  byUser: Record<string, string[]>;
  togglePin: (userId: string, id: string) => void;
};

export const usePinnedEditorStore = create<PinnedEditorState>()(
  persist(
    (set) => ({
      byUser: {},
      togglePin: (userId, id) =>
        set((s) => {
          const pinned = s.byUser[userId] ?? [];
          const next = pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id];
          return { byUser: { ...s.byUser, [userId]: next } };
        }),
    }),
    { name: "xnoquant-pinned-editors" },
  ),
);
