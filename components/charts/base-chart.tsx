"use client";
import { useEffect, useRef } from "react";
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
  const chartRef = useRef<ReactECharts>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ECharts measures its container at init. In a flex/grid card (or when a chart
  // mounts as a loading Skeleton is swapped out) that width isn't settled yet, so
  // the chart lays out at a stale/zero size — a pie collapses to a sliver, bars
  // vanish. Resize once after the first layout, and on every later container resize.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const resize = () => chartRef.current?.getEchartsInstance()?.resize();
    const raf = requestAnimationFrame(resize);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} style={{ width: "100%", height: 240, ...style }}>
      <ReactECharts
        ref={chartRef}
        theme={THEME_NAME}
        option={option}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
