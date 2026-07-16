"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useUpdateVenue } from "@/hooks/api/use-venues";
import { VENUE_TYPES } from "./venue-types";
import type { Venue } from "@/types/domain";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  venue_type: z.enum(["binance_spot", "binance_futures", "tcbs", "dnse"]),
});
type FormValues = z.infer<typeof schema>;

const fieldClass =
  "h-10 w-full rounded-[20px] border-border bg-surface px-3 text-sm text-foreground dark:bg-surface";

export function EditVenueModal({ venue, onClose }: { venue: Venue | null; onClose: () => void }) {
  const updateVenue = useUpdateVenue();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: venue?.name ?? "", venue_type: venue?.venue_type ?? "binance_spot" },
  });

  useEffect(() => {
    if (venue) {
      reset({ name: venue.name, venue_type: venue.venue_type });
    }
  }, [venue, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!venue) return;
    updateVenue.mutate({ id: venue.id, ...values }, { onSuccess: onClose });
  });

  return (
    <Dialog
      open={!!venue}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit venue</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-venue-name" className="font-normal text-muted-foreground">
                Name
              </Label>
              <Input
                id="edit-venue-name"
                placeholder="Venue name"
                autoComplete="off"
                className={fieldClass}
                {...register("name")}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-venue-type" className="font-normal text-muted-foreground">
                Type
              </Label>
              <Controller
                control={control}
                name="venue_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="edit-venue-type" className={fieldClass}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {VENUE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          {updateVenue.isError && (
            <p className="text-xs text-destructive">Couldn&rsquo;t update venue. Please try again.</p>
          )}
          <DialogFooter>
            <DialogClose asChild className="rounded-full">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <button
              type="submit"
              disabled={updateVenue.isPending}
              className="flex h-[34px] w-fit items-center justify-center gap-1 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Update venue
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
