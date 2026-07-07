"use client";
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { MinimalisticMagnifer, DangerTriangle } from "@solar-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BaseChart } from "@/components/charts/base-chart";
import {
  RESULT_METRICS,
  YEARLY_ROWS,
  CORRELATION_ROWS,
  FEATURES,
  SAMPLES,
  PNL_SERIES,
  RETURNS_SERIES,
} from "@/lib/mock/strategy-builder";

const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border">
      <div className="border-b border-border px-4 py-2.5 text-sm font-medium text-foreground">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function ResultsTab() {
  const pnlOption: EChartsOption = {
    grid: { left: 4, right: 8, top: 8, bottom: 4, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", show: false, data: PNL_SERIES.map((_, i) => i) },
    yAxis: { type: "value", axisLabel: { color: "#475467", fontSize: 10 }, splitLine: { lineStyle: { color: "#1d2939", type: "dashed" } } },
    series: [
      {
        type: "line",
        data: PNL_SERIES,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: "#67e1c1" },
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
  const returnsOption: EChartsOption = {
    grid: { left: 4, right: 8, top: 8, bottom: 4, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", show: false, data: RETURNS_SERIES.map((_, i) => i) },
    yAxis: { type: "value", axisLabel: { color: "#475467", fontSize: 10 }, splitLine: { lineStyle: { color: "#1d2939", type: "dashed" } } },
    series: [{ type: "line", data: RETURNS_SERIES, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: "#67e1c1" } }],
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {RESULT_METRICS.map((m) => (
          <div key={m.label} className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-3 py-2.5">
            <span className="text-xs text-muted-foreground">{m.label}</span>
            <span
              className={
                m.positive === undefined
                  ? "text-sm font-semibold text-foreground"
                  : `text-sm font-semibold ${m.positive ? GRAD_GREEN : GRAD_RED}`
              }
            >
              {m.value}
            </span>
          </div>
        ))}
      </div>
      <Panel title="PnL">
        <BaseChart option={pnlOption} style={{ height: 180 }} />
      </Panel>
      <Panel title="Returns">
        <BaseChart option={returnsOption} style={{ height: 160 }} />
      </Panel>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead className="text-right">Sharpe</TableHead>
              <TableHead className="text-right">CAGR</TableHead>
              <TableHead className="text-right">Max dd</TableHead>
              <TableHead className="text-right">Profit factor</TableHead>
              <TableHead className="text-right">Calmar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {YEARLY_ROWS.map((r) => (
              <TableRow key={r.year}>
                <TableCell className="text-white">{r.year}</TableCell>
                <TableCell className="text-right text-white">{r.sharpe.toFixed(2)}</TableCell>
                <TableCell className={`text-right ${r.cagr.startsWith("-") ? GRAD_RED : GRAD_GREEN}`}>{r.cagr}</TableCell>
                <TableCell className={`text-right ${GRAD_RED}`}>{r.maxDd}</TableCell>
                <TableCell className="text-right text-white">{r.profitFactor.toFixed(1)}</TableCell>
                <TableCell className={`text-right ${r.calmar < 0 ? GRAD_RED : GRAD_GREEN}`}>{r.calmar.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DetailTab() {
  const marketOption: EChartsOption = {
    legend: { top: 0, right: 0, itemWidth: 8, itemHeight: 8, icon: "roundRect", textStyle: { color: "#9db2ce", fontSize: 11 } },
    grid: { left: 4, right: 8, top: 28, bottom: 4, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", show: false, data: PNL_SERIES.map((_, i) => i) },
    yAxis: { type: "value", axisLabel: { color: "#475467", fontSize: 10 }, splitLine: { lineStyle: { color: "#1d2939", type: "dashed" } } },
    series: [
      { name: "Strategy", type: "line", data: PNL_SERIES, smooth: true, showSymbol: false, lineStyle: { color: "#67e1c1" } },
      { name: "VN-Index", type: "line", data: PNL_SERIES.map((v) => v * 0.6), smooth: true, showSymbol: false, lineStyle: { color: "#9db2ce" } },
    ],
  };
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Self correlation">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Minimum Correlation</span>
              <span className={`text-sm font-semibold ${GRAD_GREEN}`}>-0.45</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Maximum Correlation</span>
              <span className={`text-sm font-semibold ${GRAD_RED}`}>0.92</span>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-[#f1c617]/40 bg-[#f1c617]/10 p-3 text-xs text-[#f1c617]">
            <DangerTriangle size={16} weight="Outline" className="mt-0.5 shrink-0" />
            <p>
              Max Correlation &gt; 0.8. This strategy behaves similarly to &ldquo;MACD_Strategy_V1&rdquo;. Consider
              combining to save on trading costs.
            </p>
          </div>
        </div>
      </Panel>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Universe</TableHead>
              <TableHead className="text-right">Correlation</TableHead>
              <TableHead className="text-right">Sharpe</TableHead>
              <TableHead className="text-right">Returns</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CORRELATION_ROWS.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="whitespace-nowrap text-white">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.universe}</TableCell>
                <TableCell className={`text-right ${r.correlation < 0 ? GRAD_GREEN : "text-white"}`}>
                  {r.correlation.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-white">{r.sharpe.toFixed(2)}</TableCell>
                <TableCell className={`text-right ${GRAD_GREEN}`}>{r.returns}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Panel title="Compare strategy returns with the general market (VN-Index)">
        <BaseChart option={marketOption} style={{ height: 180 }} />
      </Panel>
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-[20px] border border-border px-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
      />
      <MinimalisticMagnifer size={18} weight="Outline" className="shrink-0 text-muted-foreground" />
    </div>
  );
}

function FeaturesTab() {
  const [q, setQ] = useState("");
  const items = useMemo(() => FEATURES.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={q} onChange={setQ} placeholder="Search features..." />
      <div className="flex flex-col gap-1">
        {items.map((f) => (
          <button
            key={f.name}
            type="button"
            className="flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="font-mono text-xs text-primary">{f.name}</span>
            <span className="text-xs text-muted-foreground">{f.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SamplesTab() {
  const [q, setQ] = useState("");
  const items = useMemo(() => SAMPLES.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={q} onChange={setQ} placeholder="Search by name, category..." />
      <div className="flex flex-col gap-2">
        {items.map((s) => (
          <button
            key={s.name}
            type="button"
            className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.category}</span>
            </div>
            <Badge variant="secondary" className="rounded-full font-normal">
              Sharpe {s.sharpe.toFixed(2)}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ResultsPanel() {
  return (
    <Tabs defaultValue="results" className="flex h-full min-h-0 flex-col gap-0 bg-background">
      <div className="shrink-0 border-b border-border px-3 py-2.5">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="detail">Detail</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="samples">Samples</TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <TabsContent value="results">
          <ResultsTab />
        </TabsContent>
        <TabsContent value="detail">
          <DetailTab />
        </TabsContent>
        <TabsContent value="features">
          <FeaturesTab />
        </TabsContent>
        <TabsContent value="samples">
          <SamplesTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}
