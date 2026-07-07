"use client";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";

export interface BarChartSeries {
  name: string;
  data: number[];
}

export interface BarChartProps {
  categories: string[];
  series: BarChartSeries[];
  className?: string;
  style?: React.CSSProperties;
}

export function BarChart({ categories, series, className, style }: BarChartProps) {
  const option: EChartsOption = {
    legend: { top: 0, textStyle: { color: "#9db2ce" } },
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value" },
    series: series.map((s) => ({
      name: s.name,
      type: "bar" as const,
      barWidth: "40%",
      data: s.data,
    })),
  };

  return <BaseChart option={option} className={className} style={style} />;
}
