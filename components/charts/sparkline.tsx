"use client";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";

const GREEN = "#67e1c1";
const RED = "#ff135b";

export interface SparklineProps {
  data: number[];
  className?: string;
  color?: string;
}

export function Sparkline({ data, className, color }: SparklineProps) {
  const lineColor =
    color ?? (data.length > 0 && data[data.length - 1] >= data[0] ? GREEN : RED);
  const lastIndex = data.length - 1;

  const option: EChartsOption = {
    xAxis: { show: false, type: "category", boundaryGap: false },
    // Fit the axis tightly to the data (min→bottom, max→top) so the curve uses the
    // full height — otherwise a value axis includes 0 and the line reads flat/linear.
    yAxis: { show: false, type: "value", min: "dataMin", max: "dataMax" },
    grid: { left: 2, right: 10, top: 8, bottom: 8 },
    series: [
      {
        type: "line",
        data,
        // Sharp (unsmoothed) line so the volatility in the data actually reads as a
        // real equity curve rather than a gently curved line.
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1.5, color: lineColor },
        itemStyle: { color: lineColor },
      },
      {
        // Pulsing "heartbeat" dot on the last point — a bright dot with a continuously
        // radiating halo (ECharts ripple), plus a soft glow.
        type: "effectScatter",
        data: lastIndex >= 0 ? [[lastIndex, data[lastIndex]]] : [],
        symbolSize: 5,
        showEffectOn: "render",
        rippleEffect: { scale: 4, brushType: "fill", period: 1.6 },
        itemStyle: { color: lineColor, shadowBlur: 12, shadowColor: lineColor },
        z: 5,
      },
    ],
  };

  return <BaseChart option={option} className={className} style={{ height: 40 }} />;
}
