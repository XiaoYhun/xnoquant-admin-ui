"use client";

import { useMemo, useRef, useState } from "react";
import { AltArrowDown, Magnifer } from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type OwnerOption = { id: string; name: string; email?: string };

/**
 * Toolbar "owner" filter — multi-select, popover chrome matching `SymbolFilter`/pill styling
 * matching this page's other filters. `value` is the set of selected owner ids; empty means no
 * filter (every owner). Typing in the search box narrows the list by name or email.
 */
export function OwnerFilter({
  options,
  value,
  onChange,
}: {
  options: OwnerOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q) || (o.email ?? "").toLowerCase().includes(q));
  }, [options, query]);

  const selected = new Set(value);
  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  const label =
    value.length === 0
      ? "All owners"
      : value.length === 1
        ? (options.find((o) => o.id === value[0])?.name ?? "1 owner")
        : `${value.length} owners`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        aria-label="Owner filter"
        className="flex h-8 w-auto shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium text-white"
      >
        {label}
        <AltArrowDown size={14} weight="Outline" className="shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-1.5"
        onOpenAutoFocus={(e) => {
          // Radix would otherwise focus the first row; the search box is what the reader wants.
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="mb-1 flex h-8 items-center gap-2 rounded-[10px] border border-border px-2">
          <Magnifer size={14} weight="Outline" className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search owners..."
            className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((o, i) => {
            const checked = selected.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(o.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 px-2 py-2 text-left hover:bg-secondary/60",
                  i > 0 && "border-t border-border",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                    checked ? "border-primary bg-primary" : "border-input",
                  )}
                >
                  {checked && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="size-3 text-primary-foreground"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">{o.name}</span>
                  {o.email && <span className="block truncate text-xs text-muted-foreground">{o.email}</span>}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              {options.length === 0 ? "No owners." : "No matches."}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
