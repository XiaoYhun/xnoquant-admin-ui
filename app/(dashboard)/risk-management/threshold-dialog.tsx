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

// Editor behind both pencils on the Risk overview tab (Figma 14975:41599). One dialog serves the
// portfolio Red threshold and an account's Yellow threshold — the two writes take the same pair of
// fields, and both PUTs REQUIRE `baseline_equity`, so a threshold-only edit still has to send the
// capital back or the server would read a missing field as a change.
//
// Percentages are entered the way the screen shows them (a positive number of percent) and
// converted to the API's fraction on submit.
const INPUT =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-white/25";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  thresholdLabel: string;
  /** Current threshold as an API fraction (0.1 = 10%), or null when none is configured yet. */
  initialPct: number | null;
  initialCapital: number | null;
  pending: boolean;
  error: unknown;
  onSubmit: (values: { pct: number; capital: number }) => void;
};

export function ThresholdDialog(props: Props) {
  const { open, onOpenChange, title, description, initialPct, initialCapital } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Keyed on the values it seeds from, so the fields reset when the dialog is reopened for
            a different account AND when the thresholds query resolves after it was opened (they
            load separately from status). Mounting is the seeding mechanism — no syncing effect. */}
        {open && <ThresholdForm key={`${initialPct ?? ""}|${initialCapital ?? ""}`} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ThresholdForm({
  onOpenChange,
  thresholdLabel,
  initialPct,
  initialCapital,
  pending,
  error,
  onSubmit,
}: Props) {
  const [pct, setPct] = useState(
    initialPct == null ? "" : String(Number((Math.abs(initialPct) * 100).toFixed(4))),
  );
  const [capital, setCapital] = useState(initialCapital == null ? "" : String(initialCapital));

  const pctNum = Number(pct);
  const capitalNum = Number(capital);
  const valid =
    pct.trim() !== "" &&
    capital.trim() !== "" &&
    Number.isFinite(pctNum) &&
    pctNum > 0 &&
    Number.isFinite(capitalNum) &&
    capitalNum > 0;

  return (
    <>
      <div className="flex flex-col gap-4 py-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{thresholdLabel}</span>
          <div className="flex items-center gap-2">
            <input
              className={INPUT}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              inputMode="decimal"
              placeholder="10"
            />
            <span className="shrink-0 text-sm text-muted-foreground">%</span>
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Capital (baseline equity)</span>
          <div className="flex items-center gap-2">
            <input
              className={INPUT}
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              inputMode="decimal"
              placeholder="2000000000"
            />
            <span className="shrink-0 text-sm text-muted-foreground">₫</span>
          </div>
          <span className="text-[11px] leading-4 text-muted-foreground">
            The confirmed capital drawdown is measured against. Changing it does not move the
            high-water mark — only a reset re-baselines that.
          </span>
        </label>
        {!!error && <p className="text-xs text-destructive">{resourceErrorMessage(error)}</p>}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button disabled={!valid || pending} onClick={() => onSubmit({ pct: pctNum / 100, capital: capitalNum })}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
