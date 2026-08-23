import { describe, it, expect } from "vitest";
import {
  RISK_FEE_DEFAULTS,
  riskFeeValuesOf,
  toFeeConfig,
  toRiskConfig,
  type RiskFeeValues,
} from "./risk-fee-fields";
import type { Account } from "@/types/domain";

const account = (risk: Account["risk"], fee: Account["fee"]) => ({ risk, fee }) as Account;
const values = (patch: Partial<RiskFeeValues>): RiskFeeValues => ({ ...RISK_FEE_DEFAULTS, ...patch });

describe("riskFeeValuesOf", () => {
  it("shows a rate as a percent without the float noise", () => {
    // 0.00018 * 100 is 0.018000000000000002 in binary floating point — which is what the Maker
    // rate box rendered before. The box has to read what an operator would have typed.
    const v = riskFeeValuesOf(account({ type: "none" }, { type: "rate", maker_rate: 0.00018, taker_rate: 0.00045 }));
    expect(v.feeMakerPct).toBe("0.018");
    expect(v.feeTakerPct).toBe("0.045");
  });

  it("round-trips a rate back to the same fraction", () => {
    const fee = { type: "rate", maker_rate: 0.00018, taker_rate: 0.00045 } as const;
    expect(toFeeConfig(riskFeeValuesOf(account({ type: "none" }, fee)))).toEqual(fee);
  });

  it("fills only the selected variant's fields", () => {
    const v = riskFeeValuesOf(
      account({ type: "spot", min_order_value: 10, max_order_value: 5000 }, { type: "rate", maker_rate: 0, taker_rate: 0 }),
    );
    expect(v.riskType).toBe("spot");
    expect([v.riskMinOrderValue, v.riskMaxOrderValue]).toEqual(["10", "5000"]);
    // Futures-only boxes stay empty rather than carrying a stale number into a variant switch.
    expect([v.riskMaxLeverage, v.riskMaxNotional]).toEqual(["", ""]);
  });

  it("reads the DNSE derivatives fee variant", () => {
    const fee = {
      type: "dnse_derivatives",
      clearing_fee: 2700,
      exchange_fee: 2700,
      venue_fee: 1200,
      maintenance_margin: 0.1848,
    } as const;
    const v = riskFeeValuesOf(account({ type: "none" }, fee));
    expect(v.feeType).toBe("dnse_derivatives");
    expect(v.feeMaintenanceMargin).toBe("0.1848");
    expect(toFeeConfig(v)).toEqual(fee);
  });
});

describe("toRiskConfig", () => {
  it("sends `none` with no numbers attached", () => {
    expect(toRiskConfig(values({ riskType: "none", riskMaxLeverage: "5" }))).toEqual({ type: "none" });
  });

  it("builds each futures variant under its own tag", () => {
    const v = values({ riskType: "inverse_futures", riskMaxLeverage: "5", riskMaxNotional: "100000" });
    expect(toRiskConfig(v)).toEqual({ type: "inverse_futures", max_leverage: 5, max_notional: 100000 });
    expect(toRiskConfig({ ...v, riskType: "linear_futures" })).toEqual({
      type: "linear_futures",
      max_leverage: 5,
      max_notional: 100000,
    });
  });

  it("omits a half-filled variant instead of sending a partial limit", () => {
    // `risk` is optional on the wire, so leaving it off keeps whatever the account already had —
    // far better than shipping a limit with one side missing.
    expect(toRiskConfig(values({ riskType: "spot", riskMinOrderValue: "10" }))).toBeUndefined();
    expect(toRiskConfig(values({ riskType: "linear_futures", riskMaxNotional: "1" }))).toBeUndefined();
    expect(toFeeConfig(values({ feeType: "rate", feeMakerPct: "0.018" }))).toBeUndefined();
  });

  it("treats an unparseable number as missing", () => {
    expect(toRiskConfig(values({ riskType: "spot", riskMinOrderValue: "abc", riskMaxOrderValue: "5" }))).toBeUndefined();
  });

  it("keeps zero, which is a real limit and not an empty box", () => {
    expect(toFeeConfig(values({ feeType: "rate", feeMakerPct: "0", feeTakerPct: "0.045" }))).toEqual({
      type: "rate",
      maker_rate: 0,
      taker_rate: 0.00045,
    });
  });
});
