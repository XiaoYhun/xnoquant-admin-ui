"use client";
import type { ReactNode } from "react";
import type { EChartsOption } from "echarts";
import { BaseChart } from "@/components/charts/base-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useStrategyAnalytics } from "@/hooks/api/use-strategies";

function ChartCard({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-background p-4 ${className ?? ""}`}>
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

// Per-segment pastel palette, in the mock's data order [VN30, VNBank, No-Vin, VNRealEstate, Vin]
// — coral / blue / gold / lavender / mint, matching the Figma "Market Allocation".
const DONUT_COLORS = ["#ffab91", "#6db3f2", "#f5c451", "#c3b1e1", "#67e1c1"];
const AXIS_LABEL = { color: "#475467", fontSize: 10 } as const;
const SPLIT_LINE = { show: true, lineStyle: { color: "#1d2939", type: "dashed" } } as const;

export function StrategyAnalyticsHeader() {
  const { data, isLoading } = useStrategyAnalytics();

  if (isLoading || !data) {
    return (
      <div className="flex gap-4">
        <Skeleton className="h-[226px] flex-1" />
        <Skeleton className="h-[226px] flex-1" />
        <Skeleton className="h-[226px] max-w-sm flex-1" />
      </div>
    );
  }

  const lineOption: EChartsOption = {
    grid: { left: 4, right: 16, top: 16, bottom: 4, containLabel: true },
    tooltip: { trigger: "axis", valueFormatter: (v) => `${Number(v).toFixed(3)}%` },
    xAxis: {
      type: "category",
      data: data.portfolioPerformance.categories,
      boundaryGap: false,
      axisLabel: { ...AXIS_LABEL, interval: 4 },
      axisTick: { show: false },
      splitLine: SPLIT_LINE,
    },
    yAxis: { type: "value", interval: 1, axisLabel: { ...AXIS_LABEL, formatter: "{value}%" }, splitLine: SPLIT_LINE },
    series: [
      {
        type: "line",
        data: data.portfolioPerformance.data,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: "#67e1c1" },
        itemStyle: { color: "#67e1c1" },
      },
    ],
  };

  const barOption: EChartsOption = {
    legend: { top: 0, right: 0, itemWidth: 8, itemHeight: 8, icon: "roundRect", textStyle: { color: "#9db2ce", fontSize: 11 } },
    tooltip: { trigger: "axis" },
    grid: { left: 4, right: 4, top: 28, bottom: 4, containLabel: true },
    xAxis: { type: "category", data: data.strategyPipeline.categories, axisLabel: { ...AXIS_LABEL, interval: 4 }, axisTick: { show: false } },
    yAxis: { type: "value", axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: [
      { name: "Total", type: "bar", data: data.strategyPipeline.total, itemStyle: { color: "#cdbfe8", borderRadius: [3, 3, 0, 0] }, barMaxWidth: 6 },
      { name: "Published", type: "bar", data: data.strategyPipeline.published, itemStyle: { color: "#67e1c1", borderRadius: [3, 3, 0, 0] }, barMaxWidth: 6 },
    ],
  };

  const donutOption: EChartsOption = {
    color: DONUT_COLORS,
    tooltip: { trigger: "item", formatter: "{b}: {d}%" },
    series: [
      {
        type: "pie",
        radius: ["50%", "72%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        // Rounded segment ends + a card-coloured border create the gapped, segmented ring.
        itemStyle: { borderRadius: 8, borderColor: "#0a0e14", borderWidth: 4 },
        label: {
          show: true,
          formatter: "{per|{d}%}\n{name|{b}}",
          rich: {
            per: { color: "inherit", fontSize: 13, fontWeight: "bold", lineHeight: 16 },
            name: { color: "#9db2ce", fontSize: 10, lineHeight: 14 },
          },
        },
        labelLine: { show: true, length: 8, length2: 10, lineStyle: { color: "#475467" } },
        data: data.marketAllocation,
      },
    ],
  };

  return (
    <div className="flex gap-4">
      <ChartCard title="Portfolio Performance (All)">
        <BaseChart option={lineOption} style={{ height: 180 }} />
      </ChartCard>
      <ChartCard title="Strategy Pipeline (1 month)">
        <BaseChart option={barOption} style={{ height: 180 }} />
      </ChartCard>
      <ChartCard title="Market Allocation" className="max-w-sm">
        <BaseChart option={donutOption} style={{ height: 180 }} />
      </ChartCard>
    </div>
  );
}
