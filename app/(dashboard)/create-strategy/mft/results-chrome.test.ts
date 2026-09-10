import { describe, it, expect } from "vitest";
import { EMPTY, duration, durationDays } from "./results-chrome";
import { formatDurationDays } from "@/lib/utils";

// `avg_holding_time_secs` spans a scalp and a multi-day swing on the same screen, and
// `max_drawdown_duration_days` / `longest_recovery_days` arrive as fractional days.

describe("duration", () => {
  it("picks the coarsest unit that still reads precisely", () => {
    expect(duration(45)).toBe("45s");
    expect(duration(59)).toBe("59s");
    expect(duration(60)).toBe("1m");
    expect(duration(12 * 60)).toBe("12m");
    expect(duration(3600)).toBe("1.0h");
    expect(duration(3.5 * 3600)).toBe("3.5h");
    expect(duration(86_400)).toBe("1.0d");
    expect(duration(2.1 * 86_400)).toBe("2.1d");
  });

  it("has nothing to show for a missing or nonsensical value", () => {
    expect(duration(null)).toBe(EMPTY);
    expect(duration(undefined)).toBe(EMPTY);
    expect(duration(-1)).toBe(EMPTY);
    expect(duration(Number.NaN)).toBe(EMPTY);
  });

  it("keeps a zero-second mean holding time as a number, not a dash", () => {
    // The API returns 0.0 when a run closed no round-trips — that is a fact, not a gap.
    expect(duration(0)).toBe("0s");
  });
});

describe("durationDays", () => {
  it("splits fractional days into days and hours", () => {
    expect(durationDays(2.75)).toBe("2d18h");
    expect(durationDays(1)).toBe("1d0h");
  });

  it("prints sub-day spans in hours alone", () => {
    expect(durationDays(0.5)).toBe("12h");
    expect(durationDays(0)).toBe("0h");
  });

  it("carries a rounded 24th hour into the day rather than printing 2d24h", () => {
    expect(durationDays(2.999)).toBe("3d0h");
  });

  it("has nothing to show for a missing value", () => {
    expect(durationDays(null)).toBe(EMPTY);
    expect(durationDays(undefined)).toBe(EMPTY);
    expect(durationDays(-1)).toBe(EMPTY);
  });
});

describe("formatDurationDays", () => {
  it("reports nothing rather than a dash, so each screen supplies its own", () => {
    // durationDays above is the Results screens' thin wrapper around it.
    expect(formatDurationDays(null)).toBeNull();
    expect(formatDurationDays(2.75)).toBe("2d18h");
  });
});
