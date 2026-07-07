"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AddCircle } from "@solar-icons/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCreateVenue } from "@/hooks/api/use-venues";
import { VENUE_TYPES, venueTypeLabel } from "./venue-types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  venue_type: z.enum(["binance_spot", "binance_futures", "tcbs", "dnse"]),
});
type FormValues = z.infer<typeof schema>;

export function NewVenueForm() {
  const createVenue = useCreateVenue();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", venue_type: "binance_spot" },
  });

  const onSubmit = handleSubmit((values) => {
    createVenue.mutate(values, { onSuccess: () => reset() });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>New venue</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="venue-name">Name</Label>
            <Input id="venue-name" placeholder="e.g. Binance Spot" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="venue-type">Type</Label>
            <Controller
              control={control}
              name="venue_type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="venue-type" className="w-full">
                    <SelectValue>{(value: FormValues["venue_type"]) => venueTypeLabel(value)}</SelectValue>
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
          <Button type="submit" disabled={createVenue.isPending} className="gap-1.5">
            <AddCircle size={16} weight="Outline" />
            Create venue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
