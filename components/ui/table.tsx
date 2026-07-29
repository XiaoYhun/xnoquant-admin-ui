import * as React from "react"

import { cn } from "@/lib/utils"

// Opt-in frozen columns (first/last), so wide lists scroll their middle while the identifying
// and action columns stay in view. Positioning ONLY — deliberately no background and no edge
// rule: the header keeps whatever bg the call site gave it (bg-secondary, or bg-surface on the
// accounts list) and body cells inherit the row's.
const STICKY_COL = {
  left: "sticky left-0",
  right: "sticky right-0",
} as const

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:border-border", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-border bg-secondary/40 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({
  className,
  opaque,
  ...props
}: React.ComponentProps<"tr"> & { opaque?: boolean }) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border transition-colors hover:bg-secondary/40 data-[state=selected]:bg-secondary",
        // Required on any row holding `sticky` cells: those use bg-inherit, so the row has to
        // paint an OPAQUE colour or the scrolled middle columns show through. The hover colour is
        // the exact composite of bg-secondary/40 over bg-background, so this is a visual no-op.
        opaque &&
          "bg-background hover:bg-[color-mix(in_srgb,var(--secondary)_40%,var(--background))]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  sticky,
  ...props
}: React.ComponentProps<"th"> & { sticky?: "left" | "right" }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-12 bg-secondary px-4 text-left align-middle text-xs font-medium text-white whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        sticky && `z-20 ${STICKY_COL[sticky]}`,
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  sticky,
  ...props
}: React.ComponentProps<"td"> & { sticky?: "left" | "right" }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        // bg-inherit pairs with <TableRow opaque> — see the note there.
        sticky && `z-10 bg-inherit ${STICKY_COL[sticky]}`,
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
