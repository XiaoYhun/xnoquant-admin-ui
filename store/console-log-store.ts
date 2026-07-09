import { create } from "zustand";

// Shared console log stream (mirrors xno-builder's editor-state logs): operations across the
// create-strategy page (simulate, settings save, use-template, …) push entries that the
// ConsolePanel renders. Empty until something happens.
export type ConsoleLogType = "error" | "warning" | "info" | "success";
export type ConsoleLog = { time: string; type: ConsoleLogType; message: string };

function nowTime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

type ConsoleLogState = {
  logs: ConsoleLog[];
  addLog: (type: ConsoleLogType, message: string) => void;
  clearLogs: () => void;
};

export const useConsoleLog = create<ConsoleLogState>((set) => ({
  logs: [],
  addLog: (type, message) => set((s) => ({ logs: [...s.logs, { time: nowTime(), type, message }] })),
  clearLogs: () => set({ logs: [] }),
}));
