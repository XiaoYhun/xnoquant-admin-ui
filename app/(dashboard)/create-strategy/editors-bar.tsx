"use client";
import { useState } from "react";
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
import { AltArrowDown, MinimalisticMagnifer } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { canMutate, isShared } from "@/lib/rbac";
import type { EditorTab } from "@/lib/mock/strategy-builder";

// Browser-style strip of open editors: click to switch, × to close, + to add a new one.
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

  // The strip scrolls horizontally once there are more strategies than fit, which makes finding
  // one a hunt. This picker lists them all, searchable, so any strategy is two clicks away.
  const q = query.trim().toLowerCase();
  const picked = q ? editors.filter((e) => e.name.toLowerCase().includes(q)) : editors;
  return (
    <div className="flex h-14 shrink-0 items-stretch border-b border-border bg-background overflow-y-hidden">
      <div className="flex min-w-0 items-stretch overflow-x-auto overflow-y-hidden">
        {editors.map((e) => {
          const active = e.id === activeId;
          return (
            <div
              key={e.id}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(e.id)}
              className={cn(
                "group relative flex h-[56px] shrink-0 cursor-pointer items-center gap-2 border-r border-border px-5 text-xs whitespace-nowrap",
                active ? "text-primary bg-surface" : "text-muted-foreground hover:text-white bg-background border-b",
              )}
            >
              <span>{e.name}</span>
              {/* RBAC plan: a lab-mate's HFT strategy is a read-only share. */}
              {e.type === "hft" && isShared(e, userId) && (
                <span className="shrink-0 rounded-[20px] border border-[#1d2939] bg-[#151a24] px-1.5 py-0.5 text-[10px] font-normal text-[#9db2ce]">
                  Shared
                </span>
              )}
              {/* Closing an HFT tab DELETEs the strategy server-side, which 404s for a
                  strategy the caller doesn't own — hide the × for those. */}
              {!(e.type === "hft" && e.owner_id && !canMutate(e, { userId, isAdmin })) && (
                <button
                  type="button"
                  aria-label={`Close ${e.name}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setPendingClose(e);
                  }}
                  className="flex size-4 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-white cursor-pointer -mr-2"
                >
                  <CloseIcon className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="New editor"
        onClick={onAdd}
        className="flex px-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground hover:bg-surface/50 cursor-pointer border-r border-border"
      >
        <PlusIcon className="size-4" />
      </button>

      <Popover open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) setQuery(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="All strategies"
            title="All strategies"
            className="flex shrink-0 items-center gap-1 border-l border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-surface/50 hover:text-foreground cursor-pointer"
          >
            <span className="tabular-nums">{editors.length}</span>
            <AltArrowDown weight="Outline" className="size-4" />
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
                  {e.type === "hft" && isShared(e, userId) && (
                    <span className="shrink-0 rounded-[20px] border border-[#1d2939] bg-[#151a24] px-1.5 py-0.5 text-[10px] font-normal text-[#9db2ce]">
                      Shared
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

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
