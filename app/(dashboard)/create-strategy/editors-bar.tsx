"use client";
import { CloseIcon } from "@/components/icons/close";
import { PlusIcon } from "@/components/icons/plus";
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
  return (
    <div className="flex h-14 shrink-0 items-stretch border-b border-border bg-background">
      {editors.map((e) => {
        const active = e.id === activeId;
        return (
          <div
            key={e.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(e.id)}
            className={cn(
              "group relative flex cursor-pointer items-center gap-2 border-r border-border px-5 text-xs whitespace-nowrap h-[56px]",
              active ? "text-primary bg-surface" : "text-muted-foreground hover:text-white bg-background",
            )}
          >
            <span>{e.name}</span>
            <button
              type="button"
              aria-label={`Close ${e.name}`}
              onClick={(ev) => {
                ev.stopPropagation();
                onClose(e.id);
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
    </div>
  );
}
