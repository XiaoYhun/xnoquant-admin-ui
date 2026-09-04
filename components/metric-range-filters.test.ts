import { describe, it, expect } from "vitest";
import {
  EMPTY_METRIC_RANGES,
  isEmptyMetricRanges,
  matchesMetricRanges,
  type MetricRanges,
  type MetricRow,
} from "./metric-range-filters";

const row = (over: Partial<MetricRow> = {}): MetricRow => ({
  sharpe: 1.5,
  returnPct: 12,
  maxDrawdownPct: -4.1,
  ...over,
});

const ranges = (over: Partial<MetricRanges> = {}): MetricRanges => ({ ...EMPTY_METRIC_RANGES, ...over });

describe("matchesMetricRanges", () => {
  it("passes everything while no bound is set", () => {
    expect(matchesMetricRanges(row({ sharpe: null, returnPct: null, maxDrawdownPct: null }), EMPTY_METRIC_RANGES)).toBe(
      true,
    );
    expect(isEmptyMetricRanges(EMPTY_METRIC_RANGES)).toBe(true);
  });

  it("applies a one-sided bound", () => {
    expect(matchesMetricRanges(row(), ranges({ sharpe: { min: "1", max: "" } }))).toBe(true);
    expect(matchesMetricRanges(row(), ranges({ sharpe: { min: "2", max: "" } }))).toBe(false);
    expect(matchesMetricRanges(row(), ranges({ returnPct: { min: "", max: "10" } }))).toBe(false);
  });

  it("is inclusive at both ends", () => {
    expect(matchesMetricRanges(row({ sharpe: 2 }), ranges({ sharpe: { min: "2", max: "2" } }))).toBe(true);
  });

  it("compares Max DD by magnitude, in either bound order", () => {
    // The column renders "-4.10%": "0 – 5" means "drew down at most 5%".
    expect(matchesMetricRanges(row(), ranges({ maxDd: { min: "0", max: "5" } }))).toBe(true);
    expect(matchesMetricRanges(row(), ranges({ maxDd: { min: "0", max: "3" } }))).toBe(false);
    expect(matchesMetricRanges(row(), ranges({ maxDd: { min: "-5", max: "0" } }))).toBe(true);
  });

  it("drops rows whose metric is still null once that metric is bounded", () => {
    expect(matchesMetricRanges(row({ sharpe: null }), ranges({ sharpe: { min: "1", max: "" } }))).toBe(false);
    // …but a null elsewhere doesn't matter.
    expect(matchesMetricRanges(row({ sharpe: null }), ranges({ returnPct: { min: "1", max: "" } }))).toBe(true);
  });

  it("ignores blank and unparseable bounds", () => {
    expect(matchesMetricRanges(row(), ranges({ sharpe: { min: "  ", max: "-" } }))).toBe(true);
  });

  it("keeps a run-less Alpha pool member only while nothing is bounded", () => {
    expect(matchesMetricRanges(null, EMPTY_METRIC_RANGES)).toBe(true);
    expect(matchesMetricRanges(null, ranges({ sharpe: { min: "1", max: "" } }))).toBe(false);
  });
});
