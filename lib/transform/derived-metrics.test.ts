import { describe, expect, it } from "vitest";
import { expectancy, payoffRatio, recoveryFactor } from "./derived-metrics";
import type { RunSummary } from "@/types/domain";

describe("derived-metrics", () => {
  describe("payoffRatio", () => {
    it("divides mean win by the magnitude of mean loss", () => {
      expect(payoffRatio({ avg_win: 30, avg_loss: -20 } as RunSummary)).toBeCloseTo(1.5);
    });

    it("is null when there are no losing trades to divide by", () => {
      expect(payoffRatio({ avg_win: 30, avg_loss: 0 } as RunSummary)).toBeNull();
    });
  });

  describe("recoveryFactor", () => {
    it("divides net PnL by max drawdown, unannualized", () => {
      expect(recoveryFactor({ net_pnl: 100, max_drawdown: 25 } as RunSummary)).toBeCloseTo(4);
    });

    it("is null when the run never drew down", () => {
      expect(recoveryFactor({ net_pnl: 100, max_drawdown: 0 } as RunSummary)).toBeNull();
    });
  });

  describe("expectancy", () => {
    it("weights avg win/loss by win rate", () => {
      // 0.6 * 30 - 0.4 * 20 = 18 - 8 = 10
      expect(expectancy({ win_rate: 0.6, avg_win: 30, avg_loss: -20 } as RunSummary)).toBeCloseTo(10);
    });

    it("is negative when losses outweigh the win rate", () => {
      // 0.3 * 10 - 0.7 * 50 = 3 - 35 = -32
      expect(expectancy({ win_rate: 0.3, avg_win: 10, avg_loss: -50 } as RunSummary)).toBeCloseTo(-32);
    });
  });
});
