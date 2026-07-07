"use client";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";

export interface DonutChartDatum {
  name: string;
  value: number;
}

export interface DonutChartProps {
  data: DonutChartDatum[];
  className?: string;
  style?: React.CSSProperties;
}

export function DonutChart({ data, className, style }: DonutChartProps) {
  const option: EChartsOption = {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, textStyle: { color: "#9db2ce" } },
    series: [
      {
        type: "pie",
        radius: ["55%", "80%"],
        label: { show: false },
        data,
      },
    ],
  };

  return <BaseChart option={option} className={className} style={style} />;
}
