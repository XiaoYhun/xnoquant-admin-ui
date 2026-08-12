"use client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { shortRunId } from "@/lib/utils";

// Run ids are shown truncated to their first two uuid groups (`#019f4559-e48b`) everywhere they
// appear — the run tables and the Results tab's run picker. Those groups are a v7 timestamp
// prefix, so runs created in the same minute look alike; the full id is always one hover away.
export function RunId({ id, className }: { id: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>{shortRunId(id)}</span>
      </TooltipTrigger>
      {/* Full uuid, monospaced so digit groups line up when comparing two runs. */}
      <TooltipContent className="font-mono text-xs">{id}</TooltipContent>
    </Tooltip>
  );
}
