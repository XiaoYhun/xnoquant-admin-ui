"use client";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AltArrowDown, AltArrowUp, TrashBinTrash } from "@solar-icons/react";
import { CloseIcon } from "@/components/icons/close";
import { cn } from "@/lib/utils";

// Figma 14034:37073 — collapsible console panel under the code editor: "Console N" header +
// clear/collapse/close actions, and a scrollable list of timestamped build/log lines.
type LogLine = { time: string; text: string; tone?: "success" };

const CONSOLE_LOGS: LogLine[] = [
  { time: "12:15:14", text: "Welcome to XNO Quant" },
  {
    time: "12:16:00",
    text: "Build Request Successful for Project ID: 3198881 CompileID: 15a2c3e79f0297db25e179b3718ee59f-68c38bce60513cb25365cb7568a88e58 Lean Version: 2.4.0.0.6445",
    tone: "success",
  },
  { time: "12:17:30", text: "Understanding Market Trends" },
  { time: "12:18:45", text: "Risk Management Techniques" },
  {
    time: "12:20:10",
    text: "Build Request Successful for Project ID: 3198882 CompileID: 23b5d4f89f1297eb35e289c4719fe69e-79d48ebc71523dc26376cd8679b99e69 Lean Version: 2.4.0.0.6450",
    tone: "success",
  },
  {
    time: "12:21:25",
    text: "Build Request Successful for Project ID: 3198883 CompileID: 35c6e5g90f2398fc45e39a57220fe70f-80e59fcf82634ed37487de978aabbf70 Lean Version: 2.4.0.0.6455",
    tone: "success",
  },
  {
    time: "12:22:30",
    text: "Build Request Successful for Project ID: 3198884 CompileID: 47d7f6h01f3499gd56e49b68331gf81g-91f60gdf93745fe48598ef089bbccd81 Lean Version: 2.4.0.0.6460",
    tone: "success",
  },
  { time: "12:23:45", text: "Ready. Waiting for the next Simulate run." },
];

export function ConsolePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState(CONSOLE_LOGS);
  const [bodyHeight, setBodyHeight] = useState(180);
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      const next = drag.current.startH + (drag.current.startY - e.clientY);
      setBodyHeight(Math.min(500, Math.max(96, next)));
    };
    const stop = () => {
      drag.current = null;
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

  if (!open) return null;

  const startDrag = (e: ReactMouseEvent) => {
    if (!expanded) setExpanded(true);
    drag.current = { startY: e.clientY, startH: expanded ? bodyHeight : 180 };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="shrink-0 border-t border-border bg-background">
      <div
        onMouseDown={startDrag}
        aria-label="Resize console"
        className="h-1.5 shrink-0 cursor-row-resize bg-border/40 transition-colors hover:bg-primary/40"
      />
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Console</span>
          <span className="flex h-[18px] min-w-[21px] items-center justify-center rounded bg-secondary px-1.5 text-xs font-semibold text-white">
            {logs.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Clear console"
            onClick={() => setLogs([])}
            className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          >
            <TrashBinTrash weight="Outline" className="size-5" />
          </button>
          <button
            type="button"
            aria-label={expanded ? "Collapse console" : "Expand console"}
            onClick={() => setExpanded((e) => !e)}
            className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? (
              <AltArrowUp weight="Outline" className="size-5" />
            ) : (
              <AltArrowDown weight="Outline" className="size-5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Close console"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ height: bodyHeight }} className="overflow-y-auto px-4 py-2 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="py-2 text-muted-foreground">Console cleared.</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 py-0.5">
                <span className="shrink-0 text-muted-foreground">{i + 1}</span>
                <span className="shrink-0 text-muted-foreground">|</span>
                <span className="shrink-0 text-muted-foreground">{log.time}:</span>
                <span className={cn("min-w-0 flex-1 break-words", log.tone === "success" ? "text-primary" : "text-white")}>
                  {log.text}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
