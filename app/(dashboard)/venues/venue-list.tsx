"use client";
import { useState } from "react";
import { TrashBinTrash } from "@solar-icons/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <Card>
      <CardHeader>
        <CardTitle>All venues • {total}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && venues.length === 0 && (
          <p className="text-sm text-muted-foreground">No venues yet.</p>
        )}
        {venues.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{v.name}</span>
              <Badge variant="secondary" className="w-fit">
                {venueTypeLabel(v.venue_type)}
              </Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${v.name}`}
              onClick={() => setPendingDelete(v)}
            >
              <TrashBinTrash size={16} weight="Outline" className="text-destructive" />
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete venue</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{pendingDelete?.name}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
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
    </Card>
  );
}
