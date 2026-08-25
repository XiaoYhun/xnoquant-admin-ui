"use client";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons/close";
import { PlusIcon } from "@/components/icons/plus";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MinimalisticMagnifer } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { canMutate, isShared } from "@/lib/rbac";
import type { EditorTab } from "@/lib/mock/strategy-builder";

// Browser-style strip of open editors: click to switch, × to close, + to add a new one.
// The strip never scrolls — it renders only the tabs that fit before the + button, and folds
// the remainder into a "+N" menu.

// Space to keep for the "+N" chip while deciding the cut. It isn't in the DOM yet at that point
// (it only exists once something overflows), so its width can't be measured: px-6 either side
// plus a 2–3 digit count. Keep this in step with the chip's padding below, or the cut
// under-reserves and the chip gets clipped at the right edge.
const OVERFLOW_CHIP_WIDTH = 76;

function SharedBadge() {
  return (
    <span className="shrink-0 rounded-[20px] border border-[#1d2939] bg-[#151a24] px-1.5 py-0.5 text-[10px] font-normal text-[#9db2ce]">
      Shared
    </span>
  );
}

function Tab({
  editor,
  active,
  shared,
  closable,
  grow,
  onSelect,
  onRequestClose,
}: {
  editor: EditorTab;
  active: boolean;
  shared: boolean;
  closable: boolean;
  /** Share the leftover width so the strip runs flush to the pinned "+N" chip. */
  grow?: boolean;
  onSelect?: () => void;
  onRequestClose?: () => void;
}) {
  return (
    <div
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      // Tabs shrink rather than run past the strip: the cut is measured, and a measurement that
      // comes out one tab too generous would otherwise paint over the + button.
      className={cn(
        "group relative flex h-[56px] min-w-0 cursor-pointer items-center gap-2 border-r border-border px-5 text-xs whitespace-nowrap",
        grow && "grow justify-center",
        active ? "text-primary bg-surface" : "text-muted-foreground hover:text-white bg-background border-b",
      )}
    >
      <span className="truncate">{editor.name}</span>
      {/* RBAC plan: a lab-mate's HFT strategy is a read-only share. */}
      {shared && <SharedBadge />}
      {/* Closing an HFT tab DELETEs the strategy server-side, which 404s for a strategy the
          caller doesn't own — hide the × for those. */}
      {closable && (
        <button
          type="button"
          aria-label={`Close ${editor.name}`}
          onClick={(ev) => {
            ev.stopPropagation();
            onRequestClose?.();
          }}
          className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-white cursor-pointer -mr-2"
        >
          <CloseIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function EditorsBar({
  editors,
  activeId,
  onSelect,
  onClose,
  onAdd,
}: {
  editors: EditorTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}) {
  const [pendingClose, setPendingClose] = useState<EditorTab | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { userId, isAdmin } = useAuth();

  const barRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const [visibleCount, setVisibleCount] = useState(editors.length);

  // Decide how many leading tabs fit. An off-screen copy of the full strip gives each tab's true
  // width, so this still works for tabs that aren't currently rendered.
  useEffect(() => {
    const bar = barRef.current;
    const measure = measureRef.current;
    if (!bar || !measure) return;

    const recompute = () => {
      const widths = Array.from(measure.children).map((c) => (c as HTMLElement).offsetWidth);
      const plusWidth = plusRef.current?.offsetWidth ?? 0;
      const activeIndex = editors.findIndex((e) => e.id === activeId);

      const fit = (reserved: number) => {
        let used = 0;
        let count = 0;
        for (const w of widths) {
          if (used + w > bar.clientWidth - reserved) break;
          used += w;
          count += 1;
        }
        return count;
      };

      // The "+N" chip only takes space when something actually overflows. An active tab past the
      // cut is pinned after the leading run, so reserve its width as well — tabs can't shrink, so
      // an unreserved pinned tab runs over the + button. Reserving only ever shortens the run, so
      // the active tab stays past the cut and the second guess holds.
      let count = fit(plusWidth);
      if (count < widths.length) {
        count = fit(plusWidth + OVERFLOW_CHIP_WIDTH);
        if (activeIndex >= count) count = fit(plusWidth + OVERFLOW_CHIP_WIDTH + widths[activeIndex]);
      }
      setVisibleCount(count);
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [editors, activeId]);

  const canClose = (e: EditorTab) => !(e.type === "hft" && e.owner_id && !canMutate(e, { userId, isAdmin }));
  const sharedFor = (e: EditorTab) => e.type === "hft" && isShared(e, userId);

  // Keep the active tab on the strip: if it falls past the cut, it is pinned after the leading
  // run — the fit above has already reserved room for it.
  const visible = editors.slice(0, visibleCount);
  const activeIndex = editors.findIndex((e) => e.id === activeId);
  if (activeIndex >= visibleCount) {
    visible.push(editors[activeIndex]);
  }
  const visibleIds = new Set(visible.map((e) => e.id));
  const hidden = editors.filter((e) => !visibleIds.has(e.id));
  const hasOverflow = hidden.length > 0;

  const q = query.trim().toLowerCase();
  const picked = q ? hidden.filter((e) => e.name.toLowerCase().includes(q)) : hidden;

  return (
    <div ref={barRef} className="relative flex h-14 shrink-0 items-stretch overflow-hidden border-b border-border bg-background">
      {/* Off-screen measuring copy — never visible, never interactive. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 flex items-stretch opacity-0"
        style={{ visibility: "hidden" }}
      >
        {editors.map((e) => (
          <Tab key={e.id} editor={e} active={e.id === activeId} shared={sharedFor(e)} closable={canClose(e)} />
        ))}
      </div>

      {/* When tabs overflow, the strip takes the remaining width and the visible tabs share the
          slack, so the pinned "+N" chip sits flush at the right with no dead space before it.
          With no overflow the tabs keep their natural width — otherwise a single open editor
          would stretch across the whole bar. */}
      <div className={cn("flex items-stretch", hasOverflow && "min-w-0 flex-1")}>
        {visible.map((e) => (
          <Tab
            key={e.id}
            editor={e}
            active={e.id === activeId}
            shared={sharedFor(e)}
            closable={canClose(e)}
            grow={hasOverflow}
            onSelect={() => onSelect(e.id)}
            onRequestClose={() => setPendingClose(e)}
          />
        ))}
      </div>

      <button
        ref={plusRef}
        type="button"
        aria-label="New editor"
        onClick={onAdd}
        className="flex px-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground hover:bg-surface/50 cursor-pointer border-r border-border"
      >
        <PlusIcon className="size-4" />
      </button>

      {hidden.length > 0 && (
        <Popover
          open={pickerOpen}
          onOpenChange={(o) => {
            setPickerOpen(o);
            if (!o) setQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${hidden.length} more strategies`}
              title={`${hidden.length} more strategies`}
              className="flex shrink-0 items-center border-l border-border px-6 text-xs text-muted-foreground transition-colors hover:bg-surface/50 hover:text-foreground cursor-pointer"
            >
              <span className="tabular-nums">+{hidden.length}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <MinimalisticMagnifer size={16} weight="Outline" className="shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search strategies..."
                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {picked.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No strategies match.</p>
              ) : (
                picked.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      onSelect(e.id);
                      setPickerOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-surface",
                      e.id === activeId ? "text-primary" : "text-foreground",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    {sharedFor(e) && <SharedBadge />}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <Dialog open={!!pendingClose} onOpenChange={(o) => !o && setPendingClose(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close editor</DialogTitle>
            <DialogDescription>
              Close &ldquo;{pendingClose?.name}&rdquo;? Unsaved changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingClose) onClose(pendingClose.id);
                setPendingClose(null);
              }}
            >
              Close editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
