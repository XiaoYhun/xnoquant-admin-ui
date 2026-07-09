"use client";
// OWNED BY: Create Strategy "Samples tab" agent — Figma node 13964:55798.
// Search + All Categories dropdown + collapsible category sections + sample cards
// (selected card = green border + "</> View source" + "Use template" buttons).
import { useState } from "react";
import { AltArrowDown, CheckCircle, Code, Database, MinimalisticMagnifer } from "@solar-icons/react";
import { CloseIcon } from "@/components/icons/close";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useCodeSamples, type Sample } from "@/hooks/api/use-strategy-builder";

const ALL_CATEGORIES = "all";

export function SamplesTab({ onUseTemplate }: { onUseTemplate?: (code: string) => void }) {
  const { data, isPending, isError } = useCodeSamples();
  const categories = data ?? [];
  const [search, setSearch] = useState("");
  const [viewSource, setViewSource] = useState<Sample | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<Sample | null>(null);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  // Data loads async, so the first category/sample isn't known up front — `null` means "not
  // customized by the user yet" and falls back to expand-all / first-sample lazily below,
  // instead of crashing on an empty array or needing an effect to seed state once data arrives.
  const [expandedOverride, setExpandedOverride] = useState<Set<string> | null>(null);
  const [selectedIdOverride, setSelectedIdOverride] = useState<string | null>(null);
  const expanded = expandedOverride ?? new Set(categories.map((c) => c.id));
  const selectedId = selectedIdOverride ?? categories[0]?.samples[0]?.id ?? "";

  const query = search.trim().toLowerCase();
  const filtered = categories
    .filter((c) => category === ALL_CATEGORIES || c.id === category)
    .map((c) => ({
      ...c,
      samples: c.samples.filter(
        (s) => !query || s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query),
      ),
    }))
    .filter((c) => c.samples.length > 0);

  function toggleSection(id: string) {
    setExpandedOverride((prev) => {
      const next = new Set(prev ?? categories.map((c) => c.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <MinimalisticMagnifer
            weight="Outline"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category..."
            className="h-9 rounded-full border-border bg-transparent pl-9 text-xs placeholder:text-muted-foreground"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 shrink-0 rounded-full border-border bg-transparent px-3 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Loading…</p>}
      {isError && <p className="px-1 py-4 text-center text-xs text-destructive">Couldn&apos;t load samples.</p>}

      {!isPending && !isError && filtered.length === 0 && (
        <p className="py-8 text-center text-xs text-muted-foreground">No samples found.</p>
      )}

      {!isPending && !isError && filtered.map((c) => {
        const isOpen = expanded.has(c.id);
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => toggleSection(c.id)}
              className="flex w-full cursor-pointer items-center justify-between py-1 text-left"
            >
              <span className="text-sm font-medium text-[#ccdff1]">{c.name}</span>
              <AltArrowDown
                weight="Outline"
                className={cn("size-4 text-muted-foreground transition-transform", !isOpen && "-rotate-90")}
              />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-2">
                {c.samples.map((s) => {
                  const isSelected = s.id === selectedId;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "rounded-xl border px-3 py-2 transition-colors",
                        isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedIdOverride(s.id)}
                        className="flex w-full cursor-pointer items-start gap-3 text-left"
                      >
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: c.badgeColor }}
                        >
                          <Database weight="Outline" className="size-4 text-black/70" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-sm font-medium",
                              isSelected
                                ? "bg-gradient-to-b from-[#cff8ea] to-primary bg-clip-text text-transparent"
                                : "text-white",
                            )}
                          >
                            {s.name}
                          </span>
                          {!isSelected && (
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {s.description}
                            </span>
                          )}
                        </span>
                      </button>
                      {/* T4 + B6 — the card grows in height (grid-rows 0fr→1fr) revealing the FULL
                          description and the actions. */}
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-out",
                          isSelected ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                        )}
                      >
                        <div className="overflow-hidden">
                          <p className="pt-2 pl-10 text-xs text-muted-foreground">{s.description}</p>
                          <div className="flex justify-end gap-2 pt-3">
                            <button
                              type="button"
                              tabIndex={isSelected ? 0 : -1}
                              onClick={() => setViewSource(s)}
                              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-border bg-black px-3 text-xs text-white"
                            >
                              <Code weight="Bold" className="size-4" />
                              View source
                            </button>
                            <button
                              type="button"
                              tabIndex={isSelected ? 0 : -1}
                              onClick={() => setPendingTemplate(s)}
                              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs text-black"
                            >
                              <CheckCircle weight="Outline" className="size-4" />
                              Use template
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Figma 13964:53280 — "View source" opens the sample code; "Use template" loads it into the editor. */}
      <Dialog open={!!viewSource} onOpenChange={(o) => !o && setViewSource(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[min(920px,92vw)] gap-0 overflow-hidden rounded-2xl border-border bg-background p-0"
        >
          <DialogTitle className="border-b border-border bg-surface px-4 py-2.5 text-left text-sm font-semibold text-white">
            {viewSource?.name}
          </DialogTitle>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre p-4 font-mono text-xs leading-relaxed text-[#e1e4e8]">
            {viewSource?.code?.trim() || "// No source available for this sample."}
          </pre>
          <div className="flex justify-end gap-3 border-t border-border bg-surface px-4 py-3">
            <button
              type="button"
              onClick={() => setViewSource(null)}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-border bg-black px-3 text-xs text-white"
            >
              <CloseIcon className="size-4" />
              Close
            </button>
            <button
              type="button"
              onClick={() => setPendingTemplate(viewSource)}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-[linear-gradient(165deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs text-black"
            >
              <CheckCircle weight="Outline" className="size-4" />
              Use template
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* T13 — confirm before replacing the editor code with a template. */}
      <Dialog open={!!pendingTemplate} onOpenChange={(o) => !o && setPendingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use template</DialogTitle>
            <DialogDescription>
              Replace the current editor code with &ldquo;{pendingTemplate?.name}&rdquo;? Your current code
              will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (pendingTemplate) onUseTemplate?.(pendingTemplate.code);
                setPendingTemplate(null);
                setViewSource(null);
              }}
            >
              Use template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
