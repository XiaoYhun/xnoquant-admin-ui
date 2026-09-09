"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The page numbers to draw: `1 2 3 … 8 9 10` at the ends, `1 … 4 5 6 … 10` in the middle. Seven
 * slots either way, so the pager never changes width as you page through it.
 */
export function pageItems(current: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  if (current <= 3 || current >= count - 2) {
    return [1, 2, 3, "…", count - 2, count - 1, count];
  }
  return [1, "…", current - 1, current, current + 1, "…", count];
}

/**
 * The `…` slot. Clicking it opens a popover to type any page number — the only way to reach the
 * pages the window hides.
 */
export function PageJump({
  pageCount,
  onJump,
  className,
}: {
  pageCount: number;
  onJump: (page: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  // Held as a string so a half-typed entry doesn't collapse to 0.
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 1 && parsed <= pageCount;

  function submit() {
    if (!valid) return;
    onJump(parsed);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setValue("");
      }}
    >
      <PopoverTrigger
        type="button"
        aria-label={`Go to a page between 1 and ${pageCount}`}
        className={cn(
          "flex size-10 items-center justify-center rounded-[20px] text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-white",
          className,
        )}
      >
        …
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="center">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Go to page (1–{pageCount})</p>
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={`1–${pageCount}`}
            className="h-9"
          />
          <Button type="button" size="sm" disabled={!valid} onClick={submit}>
            Go
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Previous · windowed page numbers · Next, shared by the four run-list tables. */
export function TablePagination({
  currentPage,
  pageCount,
  onPageChange,
}: {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onPageChange(Math.max(1, currentPage - 1));
            }}
          />
        </PaginationItem>
        {pageItems(currentPage, pageCount).map((item, i) =>
          item === "…" ? (
            <PaginationItem key={`gap-${i}`}>
              <PageJump pageCount={pageCount} onJump={onPageChange} className="size-9 rounded-md" />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={item === currentPage}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(item);
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onPageChange(Math.min(pageCount, currentPage + 1));
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
