"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/hooks/use-page-size";
import { cn } from "@/lib/utils";

/** Rows-per-page picker, sat at the end of each list toolbar. */
export function PageSizeSelect({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (size: number) => void;
  className?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger
        aria-label="Rows per page"
        className={cn(
          "h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAGE_SIZE_OPTIONS.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n} / page
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
