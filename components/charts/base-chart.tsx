"use client";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

const THEME_NAME = "xnoquant-dark";
echarts.registerTheme(THEME_NAME, {
  color: ["#67e1c1", "#ff135b", "#1fad8e", "#9db2ce"],
  backgroundColor: "transparent",
  textStyle: { fontFamily: "var(--font-be-vietnam-pro), sans-serif", color: "#9db2ce" },
  grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
  categoryAxis: {
    axisLine: { lineStyle: { color: "#1d2939" } },
    axisLabel: { color: "#9db2ce" },
    splitLine: { show: false, lineStyle: { color: "#1d2939" } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: "#1d2939" } },
    axisLabel: { color: "#9db2ce" },
    splitLine: { lineStyle: { color: "#1d2939" } },
  },
});

export interface BaseChartProps {
  option: EChartsOption;
  className?: string;
  style?: React.CSSProperties;
}

export function BaseChart({ option, className, style }: BaseChartProps) {
  return (
    <ReactECharts
      theme={THEME_NAME}
      option={option}
      className={className}
      style={{ height: 240, width: "100%", ...style }}
    />
  );
}
