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
import { cn } from "@/lib/utils";
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
  return (
    <div className="flex h-14 shrink-0 items-stretch overflow-x-auto border-b border-border bg-background">
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
          </div>
        );
      })}
      <button
        type="button"
        aria-label="New editor"
        onClick={onAdd}
        className="flex px-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground hover:bg-surface/50 cursor-pointer border-r border-border"
      >
        <PlusIcon className="size-4" />
      </button>

      {/* T11 — confirm before closing an editor. */}
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
