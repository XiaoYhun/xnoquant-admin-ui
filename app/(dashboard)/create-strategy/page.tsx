"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CodeEditor } from "./code-editor";
import { EditorsBar } from "./editors-bar";
import { Toolbar } from "./toolbar";
import { ConsolePanel } from "./console-panel";
import { ResultsPanel } from "./results-panel";
import { INITIAL_EDITORS, SAMPLE_CODE, type EditorTab } from "@/lib/mock/strategy-builder";

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
        className="group flex w-1 shrink-0 cursor-col-resize items-center justify-center hover:bg-[#344054]"
      >
        <div className="h-10 w-0.5 pl-px rounded-full bg-border/70 transition-colors group-hover:bg-primary/60" />
      </div>
      <div style={{ width: `${100 - leftPct}%` }} className="min-w-0">
        {right}
      </div>
    </div>
  );
}

export default function Page() {
  const [editors, setEditors] = useState<EditorTab[]>(INITIAL_EDITORS);
  const [activeId, setActiveId] = useState(INITIAL_EDITORS[0].id);
  const nextId = useRef(INITIAL_EDITORS.length + 1);
  const active = editors.find((e) => e.id === activeId) ?? editors[0];

  const addEditor = () => {
    const n = nextId.current++;
    const id = `ed-${n}`;
    setEditors((prev) => [...prev, { id, name: `Strategy ${n}`, code: SAMPLE_CODE }]);
    setActiveId(id);
  };
  const closeEditor = (id: string) => {
    setEditors((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (id === activeId && next.length) setActiveId(next[0].id);
      return next;
    });
  };

  const left = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface">
      <Toolbar />
      <CodeEditor code={active?.code ?? ""} />
      <ConsolePanel />
    </div>
  );

  return (
    <div className="p-3 bg-surface flex-1">
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface rounded-[16px] border">
        <EditorsBar editors={editors} activeId={activeId} onSelect={setActiveId} onClose={closeEditor} onAdd={addEditor} />
        <div className="flex min-h-0 flex-1">
          <ResizableSplit
            left={left}
            right={
              <div className="h-full min-h-0 overflow-hidden bg-background">
                <ResultsPanel />
              </div>
            }
          />
        </div>
      </main>
    </div>
  );
}
