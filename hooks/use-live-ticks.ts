"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type Tickable = { returnPct: number; sharpe: number; maxDrawdownPct: number };

// Simulates a live feed: every ~1.5s it nudges Return / Sharpe / Max-drawdown on a random
// subset of the cached rows, so those cells "tick" and flash (see FlashValue). Pure UI demo
// over the mock data — no real backend. Writes straight into the React Query cache so no
// refetch is triggered.
export function useLiveTicks<T extends Tickable>(queryKey: readonly unknown[]) {
  const qc = useQueryClient();
  const key = JSON.stringify(queryKey);

  useEffect(() => {
    const id = setInterval(() => {
      qc.setQueryData<T[]>(JSON.parse(key) as unknown[], (rows) =>
        rows?.map((r) => {
          if (Math.random() > 0.55) return r; // only some rows tick each interval
          const j = (scale: number) => (Math.random() - 0.5) * scale;
          return {
            ...r,
            returnPct: Number((r.returnPct + j(2.4)).toFixed(2)),
            sharpe: Number(Math.max(-3, r.sharpe + j(0.12)).toFixed(2)),
            maxDrawdownPct: Number(Math.min(0, r.maxDrawdownPct + j(0.6)).toFixed(2)),
          };
        }),
      );
    }, 1500);
    return () => clearInterval(id);
  }, [qc, key]);
}
