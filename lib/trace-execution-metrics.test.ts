import { describe, it, expect } from "vitest";
import type { TraceEvent } from "@/hooks/api/use-run-trace";
import {
  deriveFillRateSeries,
  deriveTraceExecutionMetrics,
  fillRateSeries,
  isOrderCancelled,
  isOrderFilled,
  isOrderSubmitted,
} from "./trace-execution-metrics";

const ev = (
  stage: string,
  opts: { at?: number; qty?: number; clientOrderId?: string } = {},
): TraceEvent => ({
  stage,
  at: opts.at,
  qty: opts.qty,
  clientOrderId: opts.clientOrderId,
});

describe("stage matchers", () => {
  it("accepts snake_case and PascalCase kinds", () => {
    expect(isOrderSubmitted("order_submitted")).toBe(true);
    expect(isOrderSubmitted("OrderSubmitted")).toBe(true);
    expect(isOrderFilled("order_filled")).toBe(true);
    expect(isOrderFilled("OrderFilled")).toBe(true);
    expect(isOrderFilled("order_partially_filled")).toBe(true);
    expect(isOrderCancelled("order_cancelled")).toBe(true);
    expect(isOrderCancelled("OrderCanceled")).toBe(true);
    expect(isOrderCancelled("order_rejected")).toBe(true);
  });
});

describe("fillRateSeries (qty-weighted)", () => {
  it("clamps filled qty per client_order_id to requested", () => {
    const series = fillRateSeries([
      ev("order_submitted", { at: 1, qty: 10, clientOrderId: "a" }),
      ev("order_partially_filled", { at: 2, qty: 4, clientOrderId: "a" }),
      ev("order_filled", { at: 3, qty: 10, clientOrderId: "a" }), // overfill → clamp to 10
    ]);
    expect(series.map((p) => p.value)).toEqual([0, 0.4, 1]);
  });

  it("aggregates across orders", () => {
    const series = fillRateSeries([
      ev("order_submitted", { at: 1, qty: 10, clientOrderId: "a" }),
      ev("order_submitted", { at: 2, qty: 10, clientOrderId: "b" }),
      ev("order_filled", { at: 3, qty: 10, clientOrderId: "a" }),
    ]);
    // after both submits: 0/20; after fill a: 10/20
    expect(series[series.length - 1].value).toBeCloseTo(0.5);
  });

  it("skips events without client_order_id", () => {
    expect(fillRateSeries([ev("order_submitted", { at: 1, qty: 5 })])).toEqual([]);
  });
});

describe("deriveTraceExecutionMetrics", () => {
  it("keeps count-based cancel / OTR and qty-weighted fill rate", () => {
    const events = [
      ev("order_submitted", { qty: 10, clientOrderId: "a" }),
      ev("order_submitted", { qty: 10, clientOrderId: "b" }),
      ev("order_submitted", { qty: 10, clientOrderId: "c" }),
      ev("order_filled", { qty: 10, clientOrderId: "a" }),
      ev("order_filled", { qty: 10, clientOrderId: "b" }),
      ev("order_cancelled"),
    ];
    const m = deriveTraceExecutionMetrics(events);
    expect(m.submitted).toBe(3);
    expect(m.filled).toBe(2);
    expect(m.cancelled).toBe(1);
    expect(m.fillRatePct).toBeCloseTo((20 / 30) * 100);
    expect(m.orderToTrade).toBeCloseTo(1.5);
    expect(m.cancelRatePct).toBeCloseTo((1 / 3) * 100);
  });

  it("returns null fill rate when nothing has a client_order_id", () => {
    expect(deriveTraceExecutionMetrics([]).fillRatePct).toBeNull();
    expect(deriveTraceExecutionMetrics([ev("order_filled", { qty: 1 })]).fillRatePct).toBeNull();
  });
});

describe("deriveFillRateSeries", () => {
  it("downsamples qty-weighted series to daily buckets (0–100%)", () => {
    const day1 = Date.UTC(2025, 0, 1, 12);
    const day2 = Date.UTC(2025, 0, 2, 12);
    const series = deriveFillRateSeries(
      [
        ev("OrderSubmitted", { at: day1, qty: 10, clientOrderId: "a" }),
        ev("OrderFilled", { at: day1, qty: 10, clientOrderId: "a" }),
        ev("OrderSubmitted", { at: day2, qty: 10, clientOrderId: "b" }),
      ],
      "Daily",
    );
    expect(series).toEqual([
      { label: "2025-01-01", value: 100 },
      { label: "2025-01-02", value: 50 },
    ]);
  });

  it("ignores non-order lifecycle events", () => {
    expect(deriveFillRateSeries([ev("cycle_opened"), ev("cycle_closed")])).toEqual([]);
  });
});
