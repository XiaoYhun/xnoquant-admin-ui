"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Play } from "@solar-icons/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeEditor } from "./code-editor";
import { ResultsPanel } from "./results-panel";

// Draggable two-pane split (editor | results). Left width is a % clamped to [30, 70].
function ResizableSplit({ left, right }: { left: ReactNode; right: ReactNode }) {
  const [leftPct, setLeftPct] = useState(52);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(70, Math.max(30, pct)));
    };
    const stop = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1">
      <div style={{ width: `${leftPct}%` }} className="min-w-0">
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={() => {
          dragging.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        className="w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/50"
      />
      <div style={{ width: `${100 - leftPct}%` }} className="min-w-0">
        {right}
      </div>
    </div>
  );
}

export default function Page() {
  const [group, setGroup] = useState("HFT");
  const [market, setMarket] = useState("crypto");
  const [tf, setTf] = useState("5m");
  const [name, setName] = useState("MACD-ADX Trend Confirmation");

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Strategy name"
            className="h-8 w-72 rounded-[20px] border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus-visible:border-ring"
          />
          <Tabs value={group} onValueChange={(v) => setGroup(v ?? "HFT")}>
            <TabsList>
              <TabsTrigger value="HFT">HFT</TabsTrigger>
              <TabsTrigger value="MFT">MFT</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={market} onValueChange={(v) => setMarket(v ?? "crypto")}>
            <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="crypto">Crypto</SelectItem>
              <SelectItem value="vn30">VN30</SelectItem>
              <SelectItem value="vn100">VN100</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tf} onValueChange={(v) => setTf(v ?? "5m")}>
            <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1m</SelectItem>
              <SelectItem value="5m">5m</SelectItem>
              <SelectItem value="15m">15m</SelectItem>
              <SelectItem value="1h">1h</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 cursor-pointer rounded-full border border-border px-4 text-xs font-medium text-foreground transition-colors hover:bg-white/5"
          >
            Save
          </button>
          <button
            type="button"
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-4 text-xs font-medium text-black transition-opacity hover:opacity-90"
          >
            <Play weight="Bold" className="size-3.5" />
            Simulate
          </button>
        </div>
      </div>

      {/* Editor + results split */}
      <ResizableSplit left={<CodeEditor />} right={<ResultsPanel />} />
    </main>
  );
}
