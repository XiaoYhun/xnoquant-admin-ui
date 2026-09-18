import { describe, expect, it } from "vitest";
import {
  buildHistogramBarOption,
  buildHoldingTimeOption,
  buildHourlyPnlOption,
  costBreakdownSlices,
  gmtLabel,
  toDrawdownRows,
  toHistogramBars,
  toHoldingTimeBars,
  toHourlyPnlBars,
  topHoursByShare,
} from "./run-detail";
import type { DrawdownEpisode, HistogramBucket, HourlyPnlBucket, RunSummary } from "@/types/domain";

describe("toHistogramBars", () => {
  it("sorts ascending by bucket_start and carries the count", () => {
    const buckets: HistogramBucket[] = [
      { bucket_start: 5, bucket_end: 10, count: 2 },
      { bucket_start: -5, bucket_end: 0, count: 7 },
      { bucket_start: 0, bucket_end: 5, count: 3 },
    ];
    expect(toHistogramBars(buckets)).toEqual([
      { start: -5, end: 0, count: 7 },
      { start: 0, end: 5, count: 3 },
      { start: 5, end: 10, count: 2 },
    ]);
  });

  it("drops non-finite buckets and returns [] for empty input", () => {
    expect(toHistogramBars([{ bucket_start: NaN, bucket_end: 1, count: 1 }])).toEqual([]);
    expect(toHistogramBars([])).toEqual([]);
  });
});

describe("buildHistogramBarOption", () => {
  it("draws one bar per bucket, y = count", () => {
    const bars = toHistogramBars([
      { bucket_start: 0, bucket_end: 1, count: 4 },
      { bucket_start: 1, bucket_end: 2, count: 9 },
    ]);
    const option = buildHistogramBarOption(bars, "bp");
    expect((option.xAxis as { data: string[] }).data).toHaveLength(2);
    const series = option.series as { data: number[] }[];
    expect(series[0].data).toEqual([4, 9]);
  });
});

describe("toHourlyPnlBars", () => {
  it("always returns 24 hour-ascending entries, zero-filling gaps", () => {
    const buckets: HourlyPnlBucket[] = [
      { hour: 2, pnl: 100, pnl_share_pct: 0.5 },
      { hour: 0, pnl: -20, pnl_share_pct: -0.1 },
    ];
    const bars = toHourlyPnlBars(buckets);
    expect(bars).toHaveLength(24);
    expect(bars.map((b) => b.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(bars[0]).toEqual({ hour: 0, start: 0, label: "00:00", pnl: -20, pnlSharePct: -0.1 });
    expect(bars[2]).toEqual({ hour: 2, start: 120, label: "02:00", pnl: 100, pnlSharePct: 0.5 });
    expect(bars[1]).toEqual({ hour: 1, start: 60, label: "01:00", pnl: 0, pnlSharePct: null });
  });

  it("shifts the bands onto the viewer's clock and re-sorts by local start", () => {
    // GMT+7: the 20:00 UTC bucket opens the local day at 03:00.
    const bars = toHourlyPnlBars([{ hour: 20, pnl: 100, pnl_share_pct: 0.5 }], 420);
    expect(bars[0]).toEqual({ hour: 17, start: 0, label: "00:00", pnl: 0, pnlSharePct: null });
    expect(bars[3]).toEqual({ hour: 20, start: 180, label: "03:00", pnl: 100, pnlSharePct: 0.5 });
    expect(bars.map((b) => b.start)).toEqual(Array.from({ length: 24 }, (_, i) => i * 60));
  });

  it("lands a half-hour zone mid-hour rather than distorting the buckets", () => {
    const bars = toHourlyPnlBars([{ hour: 0, pnl: 1, pnl_share_pct: null }], 330);
    expect(bars.find((b) => b.hour === 0)).toMatchObject({ start: 330, label: "05:30" });
    expect(bars[0].label).toBe("00:30");
  });
});

describe("gmtLabel", () => {
  it("names the offset the way a clock reads it", () => {
    expect(gmtLabel(0)).toBe("UTC");
    expect(gmtLabel(420)).toBe("GMT+7");
    expect(gmtLabel(330)).toBe("GMT+5:30");
    expect(gmtLabel(-300)).toBe("GMT-5");
  });
});

describe("buildHourlyPnlOption", () => {
  it("colours gains green and losses red", () => {
    const bars = toHourlyPnlBars([
      { hour: 0, pnl: 10, pnl_share_pct: 1 },
      { hour: 1, pnl: -5, pnl_share_pct: -1 },
    ]);
    const option = buildHourlyPnlOption(bars, (n) => String(n));
    const series = option.series as { data: { value: number; itemStyle: { color: string } }[] }[];
    expect(series[0].data[0].itemStyle.color).toBe("#67e1c1");
    expect(series[0].data[1].itemStyle.color).toBe("#ff135b");
  });
});

describe("topHoursByShare", () => {
  it("picks the n largest shares, ignoring nulls", () => {
    const buckets: HourlyPnlBucket[] = [
      { hour: 0, pnl: 1, pnl_share_pct: 0.1 },
      { hour: 1, pnl: 1, pnl_share_pct: null },
      { hour: 2, pnl: 1, pnl_share_pct: 0.5 },
      { hour: 3, pnl: 1, pnl_share_pct: 0.3 },
    ];
    const top = topHoursByShare(buckets, 2);
    expect(top.hours).toEqual([2, 3]);
    expect(top.totalSharePct).toBeCloseTo(0.8);
  });

  it("returns an empty answer when nothing has a share", () => {
    expect(topHoursByShare([{ hour: 0, pnl: 0, pnl_share_pct: null }])).toEqual({
      hours: [],
      totalSharePct: null,
    });
  });
});

describe("toDrawdownRows", () => {
  it("normalizes depth/depth_pct to negative regardless of the API's own sign", () => {
    const episodes: DrawdownEpisode[] = [
      {
        peak_ts: 1,
        trough_ts: 2,
        recovery_ts: 3,
        depth: 500, // positive magnitude from the API
        depth_pct: 0.05,
        length_days: 1.5,
        recovery_days: 0.5,
      },
      {
        peak_ts: 4,
        trough_ts: 5,
        recovery_ts: null,
        depth: -300, // already negative
        depth_pct: null,
        length_days: 2,
        recovery_days: null,
      },
    ];
    const rows = toDrawdownRows(episodes);
    expect(rows[0].depth).toBe(-500);
    expect(rows[0].depthPct).toBeCloseTo(-0.05);
    expect(rows[0].recoveryTs).toBe(3);
    expect(rows[1].depth).toBe(-300);
    expect(rows[1].depthPct).toBeNull();
    expect(rows[1].recoveryDays).toBeNull();
  });
});

describe("costBreakdownSlices", () => {
  it("splits commission/tax/slippage when the run recorded the split", () => {
    const summary = { commission_total: 34, tax_total: 66, slippage_total: 0, total_fee: 100 } as RunSummary;
    const slices = costBreakdownSlices(summary);
    expect(slices).toEqual([
      { key: "Commission", value: 34, share: 0.34 },
      { key: "Tax", value: 66, share: 0.66 },
    ]);
  });

  it("falls back to one Total Fee slice (+ slippage) when the split is unavailable", () => {
    const summary = { commission_total: null, tax_total: null, slippage_total: 0, total_fee: 100 } as RunSummary;
    expect(costBreakdownSlices(summary)).toEqual([{ key: "Total Fee", value: 100, share: 1 }]);
  });

  it("returns [] for an undefined summary or an all-zero cost", () => {
    expect(costBreakdownSlices(undefined)).toEqual([]);
    const zero = { commission_total: 0, tax_total: 0, slippage_total: 0, total_fee: 0 } as RunSummary;
    expect(costBreakdownSlices(zero)).toEqual([]);
  });
});

describe("toHoldingTimeBars", () => {
  const m = 60;
  const h = 3600;
  const buckets: HistogramBucket[] = [
    { bucket_start: 5 * m, bucket_end: 15 * m, count: 118 },
    { bucket_start: 0, bucket_end: 5 * m, count: 42 },
    { bucket_start: 15 * m, bucket_end: 30 * m, count: 214 },
    { bucket_start: 30 * m, bucket_end: h, count: 412 },
    { bucket_start: h, bucket_end: 6 * h, count: 512 },
    { bucket_start: 6 * h, bucket_end: 24 * h, count: 86 },
    { bucket_start: 24 * h, bucket_end: 72 * h, count: 34 },
  ];

  it("does not need bucket_end except to close the first bucket", () => {
    const bars = toHoldingTimeBars([
      { bucket_start: 5 * m, count: 2 } as HistogramBucket,
      { bucket_start: 15 * m, count: 1 } as HistogramBucket,
    ]);
    expect(bars.map((b) => b.label)).toEqual(["5-15m", ">15m"]);
  });

  it("labels buckets from their second bounds, one-sided at both ends", () => {
    expect(toHoldingTimeBars(buckets).map((b) => [b.label, b.count])).toEqual([
      ["<5m", 42],
      ["5-15m", 118],
      ["15-30m", 214],
      ["30m-1h", 412],
      ["1h-6h", 512],
      ["6h-1d", 86],
      [">1d", 34],
    ]);
  });

  it("colours bars by band: gray under 1h, green to 6h, yellow beyond", () => {
    const option = buildHoldingTimeOption(
      toHoldingTimeBars([
        { bucket_start: 0, bucket_end: h, count: 1 },
        { bucket_start: h, bucket_end: 2 * h, count: 1 },
        { bucket_start: 6 * h, bucket_end: 24 * h, count: 1 },
      ]),
    );
    const data = (option.series as { data: { itemStyle: { color: { colorStops: { color: string }[] } } }[] }[])[0]
      .data;
    expect(data.map((d) => d.itemStyle.color.colorStops[1].color)).toEqual(["#ccdff1", "#67e1c0", "#f1c617"]);
  });
});
