"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusIcon } from "@/components/icons/plus";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateVenue } from "@/hooks/api/use-venues";
import { VENUE_TYPES } from "./venue-types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  venue_type: z.enum(["binance_spot", "binance_futures", "tcbs", "dnse"]),
});
type FormValues = z.infer<typeof schema>;

const fieldClass =
  "h-10 w-full rounded-[20px] border-border bg-surface px-3 text-sm text-foreground dark:bg-surface";

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
    <section className="flex h-full min-h-0 w-[480px] shrink-0 flex-col overflow-hidden rounded-xl border border-border shadow-[0_4px_12px_0_rgba(0,0,0,0.05)] bg-background">
      <header className="flex items-center border-b border-border bg-secondary px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">New venue</h2>
      </header>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="venue-name" className="font-normal text-muted-foreground">
              Name
            </Label>
            <Input id="venue-name" placeholder="Venue name" className={fieldClass} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="venue-type" className="font-normal text-muted-foreground">
              Type
            </Label>
            <Controller
              control={control}
              name="venue_type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="venue-type" className={fieldClass}>
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
        {createVenue.isError && (
          <p className="text-xs text-destructive">Couldn&rsquo;t create venue. Please try again.</p>
        )}
        <button
          type="submit"
          disabled={createVenue.isPending}
          className="flex h-[34px] w-fit items-center justify-center gap-1 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <PlusIcon className="size-3.5" />
          Create venue
        </button>
      </form>
    </section>
  );
}
