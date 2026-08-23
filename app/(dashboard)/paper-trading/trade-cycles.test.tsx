import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { TraceEvent } from "@/lib/trace-journal";

// Run 01a00f11's journal groups into 24,314 cycles. Mounting them all is what froze the panel, so
// what matters here is that only a page is in the DOM and that the sentinel reveals the next one.
// The browser can't verify this under automation — IntersectionObserver is suspended in a
// backgrounded tab — so the observer is driven by hand.

const history = vi.hoisted(() => ({ events: [] as TraceEvent[], truncated: false }));

vi.mock("@/hooks/api/use-run-trace", () => ({
  useRunTraceHistory: () => ({ data: history, isLoading: false, isError: false, error: null }),
  useRunTraceStream: () => ({ events: [], state: "off" as const }),
}));

const { TradeCycles } = await import("./trade-cycles");

let callbacks: Array<(entries: { isIntersecting: boolean }[]) => void> = [];

beforeEach(() => {
  callbacks = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        callbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

/** One opened + one filled event per cycle, each with its own `cycle_id`. */
function cycles(n: number): TraceEvent[] {
  return Array.from({ length: n }, (_, i) => [
    { stage: "cycle_opened", cycleId: String(i), side: "BUY", qty: 0.01, at: 1_700_000_000_000 + i },
    { stage: "order_filled", cycleId: String(i), side: "BUY", qty: 0.01, price: 63_000, at: 1_700_000_000_001 + i },
  ]).flat();
}

const rows = () => document.querySelectorAll('[data-slot="accordion-item"]').length;
/** Fire the newest observer as if the sentinel had scrolled into view. */
const revealMore = () => act(() => callbacks[callbacks.length - 1]([{ isIntersecting: true }]));

describe("TradeCycles progressive reveal", () => {
  it("renders one page of a long journal, not all of it", () => {
    history.events = cycles(500);
    render(<TradeCycles runId="run-1" />);

    expect(screen.getByText("Trade cycles (500)")).toBeInTheDocument();
    expect(rows()).toBe(40);
    expect(screen.getByText(/Loading more cycles/)).toHaveTextContent("40 of 500");
  });

  it("reveals another page each time the sentinel comes into view", () => {
    history.events = cycles(500);
    render(<TradeCycles runId="run-1" />);

    revealMore();
    expect(rows()).toBe(80);
    revealMore();
    expect(rows()).toBe(120);
  });

  it("stops at the end and drops the sentinel", () => {
    history.events = cycles(50);
    render(<TradeCycles runId="run-1" />);

    expect(rows()).toBe(40);
    revealMore();
    expect(rows()).toBe(50);
    expect(screen.queryByText(/Loading more cycles/)).not.toBeInTheDocument();
  });

  it("renders every cycle when the journal is shorter than a page", () => {
    history.events = cycles(3);
    render(<TradeCycles runId="run-1" />);

    expect(rows()).toBe(3);
    expect(screen.queryByText(/Loading more cycles/)).not.toBeInTheDocument();
  });
});
