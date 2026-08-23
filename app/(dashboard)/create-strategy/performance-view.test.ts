import { describe, it, expect } from "vitest";
import type { EChartsOption } from "echarts";
import { toReturnHistogram } from "@/lib/transform/results";
import {
  buildDistributionOption,
  buildSignedPnlOption,
  niceSymmetricMax,
} from "./performance-view";

// Design tokens read off the exported bar SVGs in Figma 15039:41614.
const GAIN = ["#02795f", "#05e6b5"];
const LOSS = ["#ff135b", "#ffcce2"];

/** The stop colours of a bar, in gradient order (offset 0 first). */
function stops(option: ReturnType<typeof buildSignedPnlOption>, i: number): string[] {
  const series = option.series as { data: { itemStyle: { color: { colorStops: { color: string }[] } } }[] }[];
  return series[0].data[i].itemStyle.color.colorStops.map((s) => s.color);
}
function radius(option: ReturnType<typeof buildSignedPnlOption>, i: number): number[] {
  const series = option.series as { data: { itemStyle: { borderRadius: number[] } }[] }[];
  return series[0].data[i].itemStyle.borderRadius;
}

describe("niceSymmetricMax", () => {
  it("rounds up to the bound the design's axis labels imply", () => {
    // Figma's sample peaks at 8,350 and labels the axis 10K / 5K / 0 / -5K / -10K.
    expect(niceSymmetricMax([8350, -6350])).toBe(10_000);
    expect(niceSymmetricMax([1200, -400])).toBe(1500);
    expect(niceSymmetricMax([-90])).toBe(100);
  });
  it("leaves an all-flat series to ECharts, since there is no zero line to mirror", () => {
    expect(niceSymmetricMax([0, 0])).toBeUndefined();
    expect(niceSymmetricMax([])).toBeUndefined();
  });
});

describe("buildSignedPnlOption", () => {
  const option = buildSignedPnlOption(
    [
      { label: "29/06/26", value: 8350 },
      { label: "30/06/26", value: -6350 },
    ],
    "42%",
  );

  it("mirrors the y-axis around zero so every panel puts the zero line at the same height", () => {
    const y = (option.yAxis as { min: number; max: number; interval: number }[])[0] ?? option.yAxis;
    expect(y).toMatchObject({ min: -10_000, max: 10_000, interval: 5_000 });
  });

  it("fades each bar away from the zero line, not away from the tip", () => {
    // A gain grows up, so its bounding box runs tip -> zero and the dark stop comes first.
    expect(stops(option, 0)).toEqual(GAIN);
    // A loss hangs down, so its box runs zero -> tip: hot first, pale at the tip.
    expect(stops(option, 1)).toEqual(LOSS);
  });

  it("rounds only the outer tip of each bar", () => {
    expect(radius(option, 0)).toEqual([3, 3, 0, 0]);
    expect(radius(option, 1)).toEqual([0, 0, 3, 3]);
  });
});

describe("buildDistributionOption", () => {
  const axis = (o: EChartsOption) => (o.xAxis as { data: string[] }).data.filter(Boolean);

  it("ticks at round percents rather than wherever every third bar lands", () => {
    // Daily returns spread to ~2.9%. The old extent/binCount split labelled -2.61%, -1.74%, … ;
    // the design ticks whole percents, which is what a reader can actually place a bar against.
    const bins = toReturnHistogram([-2.9, -1.1, -0.4, 0.2, 0.9, 2.4], 20);
    expect(axis(buildDistributionOption(bins, true))).toEqual(["-3%", "-2%", "-1%", "0%", "1%", "2%"]);
  });

  it("keeps the ticks distinct when the bands are far below a percent", () => {
    // A run against a large book moves fractions of a basis point a day. Rounding every tick to
    // the same string is worse than a longer label.
    const labels = axis(buildDistributionOption(toReturnHistogram([-0.0009, 0.0004], 20), true));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("names the band, not its mid-point, in the tooltip", () => {
    const bins = toReturnHistogram([-2.9, 0.9], 20);
    const option = buildDistributionOption(bins, true);
    const formatter = (option.tooltip as { formatter: (p: unknown) => string }).formatter;
    expect(formatter([{ dataIndex: 0, value: 1 }])).toBe("-3.0% to -2.5%<br/>1 day");
    expect(formatter([{ dataIndex: 0, value: 2 }])).toContain("2 days");
  });

  it("uses the up-facing loss order, because a count never hangs below the axis", () => {
    const bins = [
      { lower: -2, center: -1, count: 4 },
      { lower: 0, center: 1, count: 9 },
    ];
    const option = buildDistributionOption(bins, true);
    // Reversed against a downward loss bar: pale at the tip, hot where it meets the baseline.
    expect(stops(option, 0)).toEqual([...LOSS].reverse());
    expect(stops(option, 1)).toEqual(GAIN);
    expect(radius(option, 0)).toEqual([3, 3, 0, 0]);
  });
});
