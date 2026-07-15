import { create } from "zustand";
import { persist } from "zustand/middleware";

// Global HFT/MFT "lab" mode. Drives the sidebar toggle (Figma 13964-56847), nav filtering,
// and per-page content variants (Create Strategy, Strategy List, …). Persisted so the choice
// survives reloads; defaults to "hft" per the design (HFT LAB selected).
export type Mode = "hft" | "mft";

type ModeState = {
  mode: Mode;
  setMode: (mode: Mode) => void;
};

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      mode: "hft",
      setMode: (mode) => set({ mode }),
    }),
    { name: "xnoquant-lab-mode" },
  ),
);

// Convenience selector.
export const useMode = () => useModeStore((s) => s.mode);
