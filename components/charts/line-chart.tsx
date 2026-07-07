"use client";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";

export interface LineChartSeries {
  name: string;
  data: number[];
}

export interface LineChartProps {
  categories: string[];
  series: LineChartSeries[];
  className?: string;
  style?: React.CSSProperties;
}

export function LineChart({ categories, series, className, style }: LineChartProps) {
  const option: EChartsOption = {
    legend: { top: 0, textStyle: { color: "#9db2ce" } },
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value" },
    series: series.map((s) => ({
      name: s.name,
      type: "line" as const,
      smooth: true,
      showSymbol: false,
      data: s.data,
    })),
  };

  return <BaseChart option={option} className={className} style={style} />;
}
