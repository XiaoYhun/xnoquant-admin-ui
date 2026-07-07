"use client";
import { useState } from "react";
import { TrashBinTrash } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useDeleteVenue } from "@/hooks/api/use-venues";
import { venueTypeLabel } from "./venue-types";
import type { Venue } from "@/types/domain";

export function VenueList({
  venues,
  total,
  isLoading,
}: {
  venues: Venue[];
  total: number;
  isLoading: boolean;
}) {
  const deleteVenue = useDeleteVenue();
  const [pendingDelete, setPendingDelete] = useState<Venue | null>(null);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border shadow-[0_4px_12px_0_rgba(0,0,0,0.05)] bg-background">
      <header className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">All venues</h2>
        <span className="text-sm font-medium text-foreground">&bull; {total}</span>
      </header>
      <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading&hellip;</p>}
        {!isLoading && venues.length === 0 && (
          <p className="text-sm text-muted-foreground">No venues yet.</p>
        )}
        {venues.map((v) => (
          <div
            key={v.id}
            className="flex items-center gap-4 rounded-xl border border-border px-4 py-3 shadow-[0_2px_8px_0_rgba(152,162,179,0.15)] transition-colors hover:border-primary/30 hover:bg-primary/10"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm font-semibold text-foreground">{v.name}</span>
              <span className="truncate text-xs text-muted-foreground">{venueTypeLabel(v.venue_type)}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${v.name}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setPendingDelete(v)}
            >
              <TrashBinTrash weight="Outline" className="size-5" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete venue</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{pendingDelete?.name}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteVenue.isPending}
              onClick={() => {
                if (pendingDelete) {
                  deleteVenue.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
