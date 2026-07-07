"use client";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

const BASE: EChartsOption = {
  backgroundColor: "transparent",
  textStyle: { fontFamily: "var(--font-be-vietnam-pro), sans-serif", color: "#9db2ce" },
  grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
  color: ["#67e1c1", "#ff135b", "#1fad8e", "#9db2ce"],
  xAxis: { axisLine: { lineStyle: { color: "#1d2939" } }, axisLabel: { color: "#9db2ce" } },
  yAxis: { splitLine: { lineStyle: { color: "#1d2939" } }, axisLabel: { color: "#9db2ce" } },
};

export function BaseChart({ option, className, style }: { option: EChartsOption; className?: string; style?: React.CSSProperties }) {
  return (
    <ReactECharts
      option={{ ...BASE, ...option }}
      className={className}
      style={{ height: 240, width: "100%", ...style }}
      notMerge={false}
    />
  );
}
