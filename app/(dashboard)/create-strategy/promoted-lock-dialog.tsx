"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { resourceErrorMessage } from "@/lib/api-client";
import type { StageInfo } from "@/components/strategy-stage";

// Guard on editing a promoted strategy. Editing bumps `strategies.version`, which strands the
// paper/live approval on the old version — the API then refuses to launch until an admin
// re-promotes. That is silent and easy to do by accident, so the editor is locked and the two
// deliberate ways forward are offered here.
const INPUT =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-white/25";

export function PromotedLockDialog({
  open,
  onOpenChange,
  strategyName,
  stage,
  version,
  onEditAnyway,
  onClone,
  cloning,
  cloneError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyName: string;
  stage: StageInfo;
  version: number;
  onEditAnyway: () => void;
  onClone: (name: string) => void;
  cloning: boolean;
  cloneError: unknown;
}) {
  const [name, setName] = useState("");
  const suggested = `${strategyName} (copy)`;
  const cloneName = name.trim() || suggested;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setName("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>“{strategyName}” is promoted</DialogTitle>
          <DialogDescription>
            Approved for <strong className="text-white">{stage.label.toLowerCase()}</strong> at{" "}
            <strong className="text-white">v{version}</strong>. Editing the code creates a new
            version and revokes that approval — the strategy stops launching until an admin
            re-promotes it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Clone to a new strategy instead</span>
            <input
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={suggested}
            />
            <span className="text-[11px] leading-4 text-muted-foreground">
              Copies the current code into a new strategy and leaves this one promoted.
            </span>
          </label>
          {!!cloneError && <p className="text-xs text-destructive">{resourceErrorMessage(cloneError)}</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {/* Red: this is the destructive path — it revokes an approval an admin granted. */}
          <Button variant="destructive" onClick={onEditAnyway} disabled={cloning}>
            Edit anyway
          </Button>
          <Button onClick={() => onClone(cloneName)} disabled={cloning}>
            {cloning ? "Cloning…" : "Clone strategy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
