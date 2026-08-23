"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Deliberately unstyled beyond layout, and without a built-in chevron: the one caller (the Trade
// cycles panel) places its own arrow on the LEFT of the row per Figma 14727:63161.
//
// The open/close height animation comes from `tw-animate-css` (already imported by globals.css),
// which ships both the `accordion-down`/`accordion-up` keyframes and the matching
// `--animate-*` theme vars — no keyframes of our own needed. It animates `height` against Radix's
// `--radix-accordion-content-height`, which only works while the padding sits on an INNER element:
// padding on the animated box itself would keep it from ever reaching height 0.

function Accordion({ ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("w-full", className)} {...props} />
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex w-full">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn("flex flex-1 cursor-pointer items-center text-left outline-none", className)}
        {...props}
      >
        {children}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  // `duration-100` sets `--tw-duration`, which is what tw-animate-css reads for its accordion
  // keyframes — 100ms instead of the 200ms default, so a row snaps open rather than easing.
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden duration-100 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={className}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
