"use client";
import { CloseIcon } from "@/components/icons/close";
import type { EChartsOption } from "echarts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BaseChart } from "@/components/charts/base-chart";
import { LineChart } from "@/components/charts/line-chart";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useTradeHistory } from "@/hooks/api/use-paper-runs";
import type { PaperRunRow } from "@/lib/mock/paper-runs";
import type { RunStatus } from "@/types/domain";
import { StartLiveTradingDialog } from "./start-live-trading-dialog";

// Status dot + label for the detail header (the real run lifecycle).
const STATUS_META: Record<RunStatus, { label: string; color: string }> = {
  running: { label: "Running", color: "#67e1c1" },
  paused: { label: "Paused", color: "#f1c617" },
  stopped: { label: "Stopped", color: "#9db2ce" },
  failed: { label: "Failed", color: "#ff135b" },
  completed: { label: "Completed", color: "#9db2ce" },
  pending: { label: "Pending", color: "#9db2ce" },
};

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border">
      <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">{title}</div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function PnlChart({ run }: { run: PaperRunRow }) {
  const option: EChartsOption = {
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: run.pnlChartSeries.map((p) => p.date) },
    yAxis: { type: "value" },
    series: [
      {
        type: "line",
        data: run.pnlChartSeries.map((p) => p.value),
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 1.5, color: "#67e1c1" },
        itemStyle: { color: "#67e1c1" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(103,225,193,0.35)" },
              { offset: 1, color: "rgba(103,225,193,0)" },
            ],
          },
        },
      },
    ],
  };
  return <BaseChart option={option} style={{ height: 220 }} />;
}

function TradesTab({ runId }: { runId: string }) {
  const { data: trades = [], isLoading } = useTradeHistory(runId);
  return (
    <div className="rounded-xl border border-border">
      <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">Trade history</div>
      <div className="max-h-[560px] overflow-auto">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead className="text-right">Equity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{new Date(t.time).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={t.action === "Buy" ? "default" : "destructive"}>{t.action}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.role}</TableCell>
                  <TableCell className="text-right text-foreground">{t.price.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-foreground">{t.size.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{t.fee.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{t.latencyMs}ms</TableCell>
                  <TableCell className="text-right text-foreground">{formatCurrency(t.equity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export function RunDetailPanel({ run, onClose }: { run: PaperRunRow; onClose: () => void }) {
  const s = STATUS_META[run.status];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{run.strategyName}</h2>
            <span className={`text-sm font-medium ${run.returnPct >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatPercent(run.returnPct)}
            </span>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <CloseIcon className="size-4" />
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </Badge>
          {run.symbols.map((sym) => (
            <Badge key={sym.symbol} variant="outline">
              {sym.symbol} &middot; {sym.market}
            </Badge>
          ))}
          <Badge variant="outline">{run.timeframe}</Badge>
        </div>
        <div className="mt-3 flex justify-end">
          <StartLiveTradingDialog run={run} />
        </div>
      </div>

      <Tabs defaultValue="charts" className="min-h-0 flex-1 gap-0 overflow-hidden">
        <div className="px-4 pt-3">
          <TabsList>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <TabsContent value="charts" className="flex flex-col gap-4">
            <ChartPanel title="PnL">
              <PnlChart run={run} />
            </ChartPanel>
            <ChartPanel title="Returns">
              <LineChart
                categories={run.returnsChartSeries.map((p) => p.date)}
                series={[{ name: "Returns", data: run.returnsChartSeries.map((p) => p.value) }]}
                style={{ height: 220 }}
              />
            </ChartPanel>
          </TabsContent>
          <TabsContent value="trades">
            <TradesTab runId={run.id} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
