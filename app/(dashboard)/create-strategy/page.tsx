"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CodeEditor } from "./code-editor";
import { PromotedLockDialog } from "./promoted-lock-dialog";
import { strategyStage } from "@/components/strategy-stage";
import { EditorsBar } from "./editors-bar";
import { Toolbar } from "./toolbar";
import { ConsolePanel } from "./console-panel";
import { ResultsPanel, type ResultsPanelTab } from "./results-panel";
import { shortRunId } from "@/lib/utils";
import type { Run } from "@/types/domain";
import { type EditorTab } from "@/lib/mock/strategy-builder";
import { useEditors, useCreateEditor, useSimulateEditor, useUpdateEditor, useDeleteEditor, fetchEditors } from "@/hooks/api/use-strategy-builder";
import { useHftStrategies, useHftStrategy, useCreateHftStrategy, useUpdateHftStrategy, useDeleteHftStrategy, type HftStrategyType, type FeatureDef } from "@/hooks/api/use-hft-strategies";
import { CreateStrategyModal } from "@/components/layout/create-strategy-modal";
import { useConsoleLog } from "@/store/console-log-store";
import { useMode, type Mode } from "@/store/mode-store";
import { useActiveEditorStore } from "@/store/active-editor-store";
import { useAuth } from "@/hooks/use-auth";
import { canMutate } from "@/lib/rbac";
import { resourceErrorMessage } from "@/lib/api-client";
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
  const mode = useMode();
  const { data: mftEditors } = useEditors();
  const { data: hftEditors } = useHftStrategies();
  // Editors are scoped to the active lab mode: HFT lab shows only HFT strategies, MFT lab only
  // MFT editors (Figma 13964-56847). Wait for the active mode's list to settle. `hftEditors`
  // becomes `[]` (not undefined) even on failure, so a down HFT backend never blocks the page.
  const list = mode === "hft" ? hftEditors : mftEditors;
  if (list === undefined) {
    return <div className="min-h-0 flex-1 bg-surface p-3" />;
  }
  const createdAt = (e: EditorTab) => (e.created_at ? new Date(e.created_at).getTime() : 0);
  const editorsForMode = [...list].sort((a, b) => createdAt(a) - createdAt(b));
  // Remount per mode so each lab is its own workspace (fresh active tab + local editor state).
  return <StrategyBuilder key={mode} mode={mode} initialEditors={editorsForMode} />;
}

function StrategyBuilder({ mode, initialEditors }: { mode: Mode; initialEditors: EditorTab[] }) {
  const [editors, setEditors] = useState<EditorTab[]>(initialEditors);
  // Baseline of what is on the server, so Save can be offered only when the code actually differs.
  const [savedCodes, setSavedCodes] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialEditors.map((e) => [e.id, e.code])),
  );
  // Restore the tab this lab was last on. Validated against what actually loaded: a remembered
  // strategy may have been deleted since, or belong to another account on this browser.
  const rememberedId = useActiveEditorStore((s) => s.byMode[mode]);
  const setRememberedEditor = useActiveEditorStore((s) => s.setActiveEditor);
  const [activeId, setActiveIdState] = useState(() =>
    rememberedId && initialEditors.some((e) => e.id === rememberedId)
      ? rememberedId
      : (initialEditors[0]?.id ?? ""),
  );
  // Every selection goes through here so the remembered tab can't drift from the rendered one.
  const setActiveId = (id: string) => {
    setActiveIdState(id);
    setRememberedEditor(mode, id);
  };
  const active = editors.find((e) => e.id === activeId) ?? editors[0];
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resultsTab, setResultsTab] = useState<ResultsPanelTab>("Results");
  // The run the Simulate modal just launched. Handed to the Results tab so it opens on that run
  // rather than on the picker's newest-run default, which is a beat behind until `GET /api/runs`
  // catches up with the create.
  const [launchedRun, setLaunchedRun] = useState<Run | undefined>(undefined);
  const createHftStrategy = useCreateHftStrategy();
  const createEditor = useCreateEditor();
  const simulateEditor = useSimulateEditor();
  const updateEditor = useUpdateEditor();
  const updateHftStrategy = useUpdateHftStrategy();
  const deleteEditor = useDeleteEditor();
  const deleteHftStrategy = useDeleteHftStrategy();
  const qc = useQueryClient();
  const addLog = useConsoleLog((s) => s.addLog);
  const { userId, isAdmin } = useAuth();
  // A lab-mate's strategy is a read-only share: every write 404s, so the editor is locked and the
  // Save/Simulate controls hidden. Strategies with no owner_id (MFT editors) stay writable.
  const canWrite = !active?.owner_id || canMutate(active, { userId, isAdmin });

  // Editing a promoted strategy silently revokes its approval — `strategies.version` bumps and
  // the paper/live basket stays pinned to the old one, so it stops launching until an admin
  // re-promotes. Lock the editor and make the two ways forward deliberate. A STALE promotion
  // doesn't lock: the edit that stranded it has already happened.
  const { data: activeStrategy } = useHftStrategy(active?.type === "hft" ? active.id : undefined);
  const stage = activeStrategy ? strategyStage(activeStrategy) : null;
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const promotionLocked =
    !!activeStrategy &&
    !!stage &&
    stage.stage !== "backtest" &&
    !stage.stale &&
    !unlockedIds.includes(activeStrategy.id);
  const [lockPromptOpen, setLockPromptOpen] = useState(false);

  const addEditor = async (type: "mft" | "hft", name: string, hftStrategyType?: HftStrategyType) => {
    // Errors propagate to CreateStrategyModal so it can stay open + surface the failure (e.g. 409).
    const tab =
      type === "hft"
        ? await createHftStrategy.mutateAsync({ name, strategyType: hftStrategyType ?? "taker" })
        : await createEditor.mutateAsync(name);
    setEditors((prev) => [...prev, tab]);
    setSavedCodes((prev) => ({ ...prev, [tab.id]: tab.code }));
    setActiveId(tab.id);
  };
  // Clone the promoted strategy into a fresh one carrying the same code, then switch to it, so
  // the original keeps its approval.
  const cloneActive = async (name: string) => {
    if (!active || active.type !== "hft") return;
    const tab = await createHftStrategy.mutateAsync({
      name,
      strategyType: activeStrategy?.strategy_type ?? "taker",
      code: active.code,
    });
    setEditors((prev) => [...prev, tab]);
    setSavedCodes((prev) => ({ ...prev, [tab.id]: tab.code }));
    setActiveId(tab.id);
    setLockPromptOpen(false);
    addLog("success", `Cloned “${active.name}” to “${name}”`);
  };

  // Explicit code save. Simulate also persists, but a user who only edits code needs a way to
  // commit it without launching a run.
  const handleSave = async () => {
    if (!active) return;
    const { id, type, code, name } = active;
    if (type === "hft") await updateHftStrategy.mutateAsync({ id, code });
    else await updateEditor.mutateAsync({ id, code });
    setSavedCodes((prev) => ({ ...prev, [id]: code }));
    addLog("success", `Saved "${name}"`);
  };
  const handleSimulate = async (editorId: string) => {
    // Focus the Results tab so the running screen is visible even if the user is on Samples.
    setResultsTab("Results");
    // Save the on-screen code first (like xno-builder): otherwise the run uses the stale server
    // copy, which for a freshly-created editor is empty and fails the simulation.
    const editor = editors.find((e) => e.id === editorId);
    if (editor?.type === "hft") {
      // HFT simulation is deferred/mock — just persist the edited code and stop.
      await updateHftStrategy.mutateAsync({ id: editorId, code: editor.code });
      setSavedCodes((prev) => ({ ...prev, [editorId]: editor.code }));
      addLog("info", "HFT code saved (simulation not available yet)");
      return;
    }
    await updateEditor.mutateAsync({ id: editorId, code: editor?.code ?? "" });
    setSavedCodes((prev) => ({ ...prev, [editorId]: editor?.code ?? "" }));
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
  // "Use template" (Samples tab) loads a sample into the active editor. A template defines the
  // features its script indexes into (features[0], features[1], …), so they are persisted with it —
  // otherwise the code would read NaN out of a feature list that was never created.
  const applyTemplate = async (code: string, features: FeatureDef[]) => {
    setEditors((prev) => prev.map((e) => (e.id === activeId ? { ...e, code } : e)));
    if (active?.type === "hft" && features.length) {
      try {
        // Code goes in the same PUT as the features: persisting one without the other leaves the
        // strategy half-applied (features indexed by a script the server never received).
        await updateHftStrategy.mutateAsync({ id: activeId, code, features });
        setSavedCodes((prev) => ({ ...prev, [activeId]: code }));
        addLog("success", `Loaded template — ${features.length} feature${features.length > 1 ? "s" : ""} applied`);
        return;
      } catch (err) {
        addLog("error", `Template features not applied: ${resourceErrorMessage(err, "this strategy")}`);
        return;
      }
    }
    addLog("info", "Loaded sample code into the editor");
  };
  // Monaco keystrokes -> active editor's code, no logging.
  const handleCodeChange = (code: string) => setEditors((prev) => prev.map((e) => (e.id === activeId ? { ...e, code } : e)));
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
        ownerId={active?.owner_id}
        market={active?.market}
        universe={active?.universe}
        trainRatio={active?.train_ratio}
        canWrite={canWrite}
        isDirty={!!active && active.code !== (savedCodes[active.id] ?? "")}
        onSave={handleSave}
        onSimulate={handleSimulate}
        onSettingsSaved={handleSettingsSaved}
        onRenamed={(nextName) =>
          setEditors((prev) => prev.map((e) => (e.id === activeId ? { ...e, name: nextName } : e)))
        }
        onLaunched={(run) => {
          // Surface the run straight away: reveal the Results tab and point it at the new run.
          setLaunchedRun(run);
          setResultsTab("Results");
          addLog("success", `Run ${shortRunId(run.id)} launched in ${run.mode} mode`);
        }}
      />
      {promotionLocked && activeStrategy && stage && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-[rgba(241,198,23,0.08)] px-4 py-2">
          <span className="text-xs text-[#f1c617]">
            Locked — approved for {stage.label.toLowerCase()} at v{activeStrategy.version}. Editing
            revokes that approval.
          </span>
          <button
            type="button"
            onClick={() => setLockPromptOpen(true)}
            className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs text-white transition-colors hover:border-white/25"
          >
            Edit or clone…
          </button>
        </div>
      )}
      <CodeEditor
        code={active?.code ?? ""}
        onChange={handleCodeChange}
        language={active?.type === "hft" ? "rust" : "python"}
        readOnly={!canWrite || promotionLocked}
        modelId={active?.id}
      />
      <ConsolePanel open={consoleOpen} onOpenChange={setConsoleOpen} />
      {activeStrategy && stage && (
        <PromotedLockDialog
          open={lockPromptOpen}
          onOpenChange={setLockPromptOpen}
          strategyName={active?.name ?? ""}
          stage={stage}
          version={activeStrategy.version}
          cloning={createHftStrategy.isPending}
          cloneError={createHftStrategy.error}
          onEditAnyway={() => {
            setUnlockedIds((prev) => [...prev, activeStrategy.id]);
            setLockPromptOpen(false);
          }}
          onClone={cloneActive}
        />
      )}
    </div>
  );

  const resultsStrategyId = active ? (active.type === "hft" ? active.id : active.strategy_ids?.at(-1)) : undefined;

  return (
    <div className="p-3 bg-surface flex-1 min-h-0">
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface rounded-[16px] border border-border">
        <EditorsBar editors={editors} activeId={activeId} onSelect={setActiveId} onClose={closeEditor} onAdd={() => setCreateOpen(true)} />
        {active ? (
          <div className="flex min-h-0 min-w-0 flex-1">
            <ResizableSplit
              left={left}
              right={
                <div className="h-full min-h-0 overflow-hidden bg-background">
                  <ResultsPanel
                    onUseTemplate={applyTemplate}
                    variant={active.type}
                    strategyId={resultsStrategyId}
                    tab={resultsTab}
                    onTabChange={setResultsTab}
                    focusRun={launchedRun}
                  />
                </div>
              }
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            No {mode.toUpperCase()} strategies yet — click the + above to create one.
          </div>
        )}
      </main>
      <CreateStrategyModal open={createOpen} onOpenChange={setCreateOpen} onConfirm={addEditor} mode={mode} />
    </div>
  );
}
