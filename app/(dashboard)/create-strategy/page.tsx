"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CodeEditor } from "./code-editor";
import { EditorsBar } from "./editors-bar";
import { Toolbar } from "./toolbar";
import { ConsolePanel } from "./console-panel";
import { ResultsPanel } from "./results-panel";
import { type EditorTab } from "@/lib/mock/strategy-builder";
import { useEditors, useCreateEditor } from "@/hooks/api/use-strategy-builder";
import { useHftStrategies, useCreateHftStrategy } from "@/hooks/api/use-hft-strategies";
import { CreateStrategyModal } from "@/components/layout/create-strategy-modal";
import { cn } from "@/lib/utils";

// Draggable two-pane split (editor | results). Left width is a % clamped to [30, 70].
function ResizableSplit({ left, right }: { left: ReactNode; right: ReactNode }) {
  const [leftPct, setLeftPct] = useState(52);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(70, Math.max(30, pct)));
    };
    const stop = () => {
      dragging.current = false;
      setIsDragging(false);
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
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1">
      <div style={{ flex: `${leftPct} 1 0%` }} className="min-w-0 overflow-hidden">
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={() => {
          dragging.current = true;
          setIsDragging(true);
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        className="group flex w-1 shrink-0 cursor-col-resize items-center justify-center hover:bg-[#344054]"
      >
        <div className={cn("h-10 w-0.5 pl-px rounded-full bg-border/70 transition-colors group-hover:bg-primary/60", isDragging && "bg-primary/60")} />
      </div>
      <div style={{ flex: `${100 - leftPct} 1 0%` }} className="min-w-0 overflow-hidden">
        {right}
      </div>
    </div>
  );
}

// T1/T16 — the editor tabs come from the XALPHA editors list (`GET /v2/editors`, MFT) merged
// with the HFT strategies list (`GET /hft/api/strategies`), MFT first. Load them, then mount the
// builder seeded from that merged list so it can own them locally (add/close/edit) without a
// set-state-in-effect. Only MFT gates mounting — HFT still loading/empty must not block the page.
export default function Page() {
  const { data: mftEditors } = useEditors();
  const { data: hftEditors } = useHftStrategies();
  if (!mftEditors || mftEditors.length === 0) {
    return <div className="min-h-0 flex-1 bg-surface p-3" />;
  }
  return <StrategyBuilder initialEditors={[...mftEditors, ...(hftEditors ?? [])]} />;
}

function StrategyBuilder({ initialEditors }: { initialEditors: EditorTab[] }) {
  const [editors, setEditors] = useState<EditorTab[]>(initialEditors);
  const [activeId, setActiveId] = useState(initialEditors[0].id);
  const active = editors.find((e) => e.id === activeId) ?? editors[0];
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const createHftStrategy = useCreateHftStrategy();
  const createEditor = useCreateEditor();

  // T15/T17 — both types create via the API and append the returned tab: MFT via
  // POST /v2/editors (revalidates the editors list), HFT via POST /api/strategies.
  const addEditor = async (type: "mft" | "hft", name: string) => {
    // Errors propagate to CreateStrategyModal so it can stay open + surface the failure (e.g. 409).
    const tab = type === "hft" ? await createHftStrategy.mutateAsync(name) : await createEditor.mutateAsync(name);
    setEditors((prev) => [...prev, tab]);
    setActiveId(tab.id);
  };
  const closeEditor = (id: string) => {
    setEditors((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (id === activeId && next.length) setActiveId(next[0].id);
      return next;
    });
  };
  // "Use template" (Samples tab) loads a sample's code into the active editor.
  const setActiveCode = (code: string) =>
    setEditors((prev) => prev.map((e) => (e.id === activeId ? { ...e, code } : e)));

  const left = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface">
      <Toolbar
        name={active?.name ?? ""}
        type={active?.type ?? "mft"}
        id={active?.id ?? ""}
        onToggleConsole={() => setConsoleOpen((v) => !v)}
      />
      <CodeEditor code={active?.code ?? ""} />
      <ConsolePanel open={consoleOpen} onOpenChange={setConsoleOpen} />
    </div>
  );

  // B7 — Results panel variant/strategyId follow the active editor's type: MFT resolves its
  // strategy from `strategy_ids` (XALPHA editor -> strategy link); HFT's own id IS the strategy id.
  const resultsStrategyId = active.type === "hft" ? active.id : active.strategy_ids?.at(-1);

  return (
    <div className="p-3 bg-surface flex-1 min-h-0">
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface rounded-[16px] border">
        <EditorsBar editors={editors} activeId={activeId} onSelect={setActiveId} onClose={closeEditor} onAdd={() => setCreateOpen(true)} />
        <div className="flex min-h-0 min-w-0 flex-1">
          <ResizableSplit
            left={left}
            right={
              <div className="h-full min-h-0 overflow-hidden bg-background">
                <ResultsPanel onUseTemplate={setActiveCode} variant={active.type} strategyId={resultsStrategyId} />
              </div>
            }
          />
        </div>
      </main>
      <CreateStrategyModal open={createOpen} onOpenChange={setCreateOpen} onConfirm={addEditor} />
    </div>
  );
}
