"use client";
import { useState } from "react";
import { Pen2, TrashBinTrash } from "@solar-icons/react";
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
import { ApiError } from "@/lib/api-client";
import { venueTypeLabel } from "./venue-types";
import type { Venue } from "@/types/domain";

export function VenueList({
  venues,
  total,
  isLoading,
  isError,
  onEdit,
}: {
  venues: Venue[];
  total: number;
  isLoading: boolean;
  isError?: boolean;
  onEdit: (venue: Venue) => void;
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
        {isError && !isLoading && (
          <p className="text-sm text-destructive">Couldn&rsquo;t load venues. Please try again.</p>
        )}
        {!isLoading && !isError && venues.length === 0 && (
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
              aria-label={`Edit ${v.name}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(v)}
            >
              <Pen2 weight="Outline" className="size-5" />
            </Button>
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

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            deleteVenue.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete venue</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{pendingDelete?.name}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteVenue.isError && (
            <p className="text-xs text-destructive">
              {deleteVenue.error instanceof ApiError && deleteVenue.error.status === 409
                ? "This venue is still referenced by one or more accounts."
                : "Couldn't delete venue. Please try again."}
            </p>
          )}
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
