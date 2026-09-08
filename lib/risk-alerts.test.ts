import { describe, it, expect } from "vitest";
import { diffRiskStatus } from "./risk-alerts";
import type { AccountRiskStatus, RiskStatusResponse } from "@/types/domain";

const account = (over: Partial<AccountRiskStatus> = {}): AccountRiskStatus => ({
  account_id: "a1",
  account_name: "Account A",
  drawdown_pct: 0,
  level: "ok",
  yellow_threshold_pct: 0.05,
  ...over,
});

const status = (
  portfolio: Partial<RiskStatusResponse["portfolio"]> = {},
  accounts: AccountRiskStatus[] = [],
): RiskStatusResponse => ({
  portfolio: { level: "ok", drawdown_pct: 0, halted: false, ...portfolio },
  accounts,
});

describe("diffRiskStatus", () => {
  it("stays silent on the first payload, however bad it is", () => {
    const first = status({ level: "red", halted: true }, [account({ level: "yellow" })]);
    expect(diffRiskStatus(undefined, first)).toEqual([]);
  });

  it("stays silent when nothing moved", () => {
    const s = status({ level: "yellow", drawdown_pct: 0.04 }, [account({ level: "yellow" })]);
    expect(diffRiskStatus(s, s)).toEqual([]);
  });

  describe("portfolio", () => {
    it("reports a halt with its reason", () => {
      const alerts = diffRiskStatus(
        status(),
        status({ halted: true, halted_reason: "Red drawdown breached", level: "red" }),
      );
      expect(alerts).toEqual([
        expect.objectContaining({ severity: "red", title: "Portfolio halted", detail: "Red drawdown breached" }),
      ]);
    });

    it("falls back to the drawdown when the halt carries no reason", () => {
      const alerts = diffRiskStatus(
        status(),
        status({ halted: true, drawdown_pct: 0.124, red_threshold_pct: 0.1 }),
      );
      expect(alerts[0].detail).toBe("Drawdown -12.4% against a -10.0% threshold");
    });

    it("does not repeat the level change on the poll that halts", () => {
      const alerts = diffRiskStatus(status(), status({ halted: true, level: "red" }));
      expect(alerts).toHaveLength(1);
    });

    it("reports the halt being lifted", () => {
      const alerts = diffRiskStatus(status({ halted: true, level: "red" }), status());
      expect(alerts.map((a) => a.title)).toEqual(["Portfolio halt lifted", "Portfolio back to Normal"]);
      expect(alerts[0].severity).toBe("ok");
    });

    it("reports a level change on its own", () => {
      const alerts = diffRiskStatus(status(), status({ level: "yellow", drawdown_pct: 0.03 }));
      expect(alerts).toEqual([
        expect.objectContaining({ severity: "yellow", title: "Portfolio → Yellow alert" }),
      ]);
    });
  });

  describe("accounts", () => {
    it("reports a breach, naming the account", () => {
      const alerts = diffRiskStatus(
        status({}, [account()]),
        status({}, [account({ level: "yellow", drawdown_pct: 0.06 })]),
      );
      expect(alerts).toEqual([
        expect.objectContaining({
          severity: "yellow",
          title: "Account A → Yellow alert",
          detail: "Drawdown -6.0% against a -5.0% threshold",
        }),
      ]);
    });

    it("reports a recovery", () => {
      const alerts = diffRiskStatus(
        status({}, [account({ level: "yellow", drawdown_pct: 0.06 })]),
        status({}, [account()]),
      );
      expect(alerts).toEqual([expect.objectContaining({ severity: "ok", title: "Account A back to Normal" })]);
    });

    it("warns once when the drawdown enters the near-threshold band", () => {
      const before = status({}, [account({ drawdown_pct: 0.03 })]);
      const inBand = status({}, [account({ drawdown_pct: 0.041 })]);
      expect(diffRiskStatus(before, inBand)).toEqual([
        expect.objectContaining({ severity: "yellow", title: "Account A nearing its threshold" }),
      ]);
      // Still in the band on the next poll — the edge has already been reported.
      expect(diffRiskStatus(inBand, status({}, [account({ drawdown_pct: 0.045 })]))).toEqual([]);
    });

    it("does not warn below the band", () => {
      const alerts = diffRiskStatus(
        status({}, [account({ drawdown_pct: 0.03 })]),
        status({}, [account({ drawdown_pct: 0.039 })]),
      );
      expect(alerts).toEqual([]);
    });

    it("does not warn for an account with no threshold set", () => {
      const alerts = diffRiskStatus(
        status({}, [account({ yellow_threshold_pct: null, drawdown_pct: 0.03 })]),
        status({}, [account({ yellow_threshold_pct: null, drawdown_pct: 0.9 })]),
      );
      expect(alerts).toEqual([]);
    });

    it("baselines an account that was not in the previous payload", () => {
      const alerts = diffRiskStatus(status(), status({}, [account({ level: "yellow", drawdown_pct: 0.06 })]));
      expect(alerts).toEqual([]);
    });

    it("reports every account that moved", () => {
      const alerts = diffRiskStatus(
        status({}, [account(), account({ account_id: "a2", account_name: "Account B" })]),
        status({}, [
          account({ level: "yellow", drawdown_pct: 0.06 }),
          account({ account_id: "a2", account_name: "Account B", level: "red", drawdown_pct: 0.2 }),
        ]),
      );
      expect(alerts.map((a) => a.title)).toEqual([
        "Account A → Yellow alert",
        "Account B → Red alert",
      ]);
    });
  });
});
