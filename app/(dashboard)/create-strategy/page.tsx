"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CodeEditor } from "./code-editor";
import { EditorsBar } from "./editors-bar";
import { Toolbar } from "./toolbar";
import { ConsolePanel } from "./console-panel";
import { ResultsPanel, type ResultsPanelTab } from "./results-panel";
import { type EditorTab } from "@/lib/mock/strategy-builder";
import { useEditors, useCreateEditor, useSimulateEditor, useUpdateEditor, useDeleteEditor, fetchEditors } from "@/hooks/api/use-strategy-builder";
import { useHftStrategies, useCreateHftStrategy, useDeleteHftStrategy, type HftStrategyType } from "@/hooks/api/use-hft-strategies";
import { CreateStrategyModal } from "@/components/layout/create-strategy-modal";
import { useConsoleLog } from "@/store/console-log-store";
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

export default function Page() {
  const { data: mftEditors } = useEditors();
  const { data: hftEditors } = useHftStrategies();
  // StrategyBuilder snapshots `initialEditors` into state once at mount, so BOTH lists must be
  // settled first — otherwise the HFT list (a separate, slower query to another host) resolves
  // after mount and gets silently dropped from the editors bar. `hftEditors` becomes `[]` (not
  // undefined) even on failure, so this never blocks the builder on a down HFT backend.
  if (!mftEditors || mftEditors.length === 0 || hftEditors === undefined) {
    return <div className="min-h-0 flex-1 bg-surface p-3" />;
  }
  // Interleave both sources chronologically (oldest first) instead of grouping MFT then HFT.
  const createdAt = (e: EditorTab) => (e.created_at ? new Date(e.created_at).getTime() : 0);
  const initialEditors = [...mftEditors, ...hftEditors].sort((a, b) => createdAt(a) - createdAt(b));
  return <StrategyBuilder initialEditors={initialEditors} />;
}

function StrategyBuilder({ initialEditors }: { initialEditors: EditorTab[] }) {
  const [editors, setEditors] = useState<EditorTab[]>(initialEditors);
  const [activeId, setActiveId] = useState(initialEditors[0].id);
  const active = editors.find((e) => e.id === activeId) ?? editors[0];
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resultsTab, setResultsTab] = useState<ResultsPanelTab>("Results");
  const createHftStrategy = useCreateHftStrategy();
  const createEditor = useCreateEditor();
  const simulateEditor = useSimulateEditor();
  const updateEditor = useUpdateEditor();
  const deleteEditor = useDeleteEditor();
  const deleteHftStrategy = useDeleteHftStrategy();
  const qc = useQueryClient();
  const addLog = useConsoleLog((s) => s.addLog);

  const addEditor = async (type: "mft" | "hft", name: string, hftStrategyType?: HftStrategyType) => {
    // Errors propagate to CreateStrategyModal so it can stay open + surface the failure (e.g. 409).
    const tab =
      type === "hft"
        ? await createHftStrategy.mutateAsync({ name, strategyType: hftStrategyType ?? "taker" })
        : await createEditor.mutateAsync(name);
    setEditors((prev) => [...prev, tab]);
    setActiveId(tab.id);
  };
  const handleSimulate = async (editorId: string) => {
    // Focus the Results tab so the running screen is visible even if the user is on Samples.
    setResultsTab("Results");
    // Save the on-screen code first (like xno-builder): otherwise the run uses the stale server
    // copy, which for a freshly-created editor is empty and fails the simulation.
    const editor = editors.find((e) => e.id === editorId);
    await updateEditor.mutateAsync({ id: editorId, code: editor?.code ?? "" });
    await simulateEditor.mutateAsync(editorId);
    await qc.invalidateQueries({ queryKey: ["strategy-builder", "editors"] });
    const fresh = await qc.fetchQuery({ queryKey: ["strategy-builder", "editors"], queryFn: fetchEditors });
    const match = fresh.find((e) => e.id === editorId);
    if (match) {
      setEditors((prev) => prev.map((e) => (e.id === editorId ? { ...e, strategy_ids: match.strategy_ids } : e)));
    }
  };
  const closeEditor = (id: string) => {
    // Both MFT editors and HFT strategies are real server-side records — delete them; the tab is
    // also removed locally below regardless of the delete outcome.
    const editor = editors.find((e) => e.id === id);
    if (editor?.type === "mft") deleteEditor.mutate(id);
    if (editor?.type === "hft") deleteHftStrategy.mutate(id);
    setEditors((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (id === activeId && next.length) setActiveId(next[0].id);
      return next;
    });
  };
  // "Use template" (Samples tab) loads a sample's code into the active editor.
  const setActiveCode = (code: string) => {
    setEditors((prev) => prev.map((e) => (e.id === activeId ? { ...e, code } : e)));
    addLog("info", "Loaded sample code into the editor");
  };
  // Settings popover (MFT Market/Universe/Train ratio) persists via the toolbar; reflect the
  // saved values into local editor state so the cog shows the change without a reload.
  const handleSettingsSaved = (changes: { market?: string; universe?: string; train_ratio?: number }) =>
    setEditors((prev) => prev.map((e) => (e.id === activeId ? { ...e, ...changes } : e)));

  const left = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface">
      <Toolbar
        name={active?.name ?? ""}
        type={active?.type ?? "mft"}
        id={active?.id ?? ""}
        market={active?.market}
        universe={active?.universe}
        trainRatio={active?.train_ratio}
        onToggleConsole={() => setConsoleOpen((v) => !v)}
        onSimulate={handleSimulate}
        onSettingsSaved={handleSettingsSaved}
      />
      <CodeEditor code={active?.code ?? ""} />
      <ConsolePanel open={consoleOpen} onOpenChange={setConsoleOpen} />
    </div>
  );

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
                <ResultsPanel onUseTemplate={setActiveCode} variant={active.type} strategyId={resultsStrategyId} tab={resultsTab} onTabChange={setResultsTab} />
              </div>
            }
          />
        </div>
      </main>
      <CreateStrategyModal open={createOpen} onOpenChange={setCreateOpen} onConfirm={addEditor} />
    </div>
  );
}
