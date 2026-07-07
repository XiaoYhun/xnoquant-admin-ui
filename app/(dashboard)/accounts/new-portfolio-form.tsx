"use client";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, ChevronsUpDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts } from "@/hooks/api/use-accounts";
import { useCreatePortfolio } from "@/hooks/api/use-portfolios";
import { formatCurrency } from "@/lib/utils";

const rowSchema = z.object({
  account_id: z.string().min(1, "Select an account"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  sources: z.array(rowSchema).min(1, "Add at least one account"),
});
// z.coerce.number() accepts unknown as input (pre-coercion) but outputs number —
// the form's field values are the input shape, handleSubmit gives the coerced output shape.
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const fieldClass =
  "h-10 w-full rounded-[20px] border-border bg-surface px-3 text-sm text-foreground dark:bg-surface";
const rowFieldClass =
  "h-10 flex-1 rounded-[20px] border-border bg-surface px-3 text-sm text-foreground dark:bg-surface";

export function NewPortfolioForm() {
  const { data: accounts = [] } = useAccounts();
  const createPortfolio = useCreatePortfolio();
  const defaultValues: FormInput = { name: "", sources: [{ account_id: "", amount: 0 }] };
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "sources" });
  const watchedSources = useWatch({ control, name: "sources" });
  const total = (watchedSources ?? []).reduce((sum, s) => sum + (Number(s?.amount) || 0), 0);

  const onSubmit = handleSubmit((values) => {
    createPortfolio.mutate(values, { onSuccess: () => reset(defaultValues) });
  });

  return (
    <section className="flex h-full min-h-0 w-[480px] shrink-0 flex-col overflow-hidden rounded-xl border border-border shadow-[0_4px_12px_0_rgba(0,0,0,0.05)]">
      <header className="flex items-center border-b border-border bg-secondary px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">New portfolio</h2>
      </header>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="portfolio-name" className="font-normal text-muted-foreground">
              Name
            </Label>
            <Input
              id="portfolio-name"
              placeholder="e.g. My portfolio"
              className={fieldClass}
              {...register("name")}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label className="font-normal text-muted-foreground">Allocate from accounts</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name={`sources.${index}.account_id`}
                    render={({ field: selectField }) => (
                      <Select value={selectField.value} onValueChange={selectField.onChange}>
                        <SelectTrigger className={rowFieldClass}>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      placeholder="0"
                      className={`${rowFieldClass} pr-7 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      {...register(`sources.${index}.amount`)}
                    />
                    <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <button
                    type="button"
                    aria-label="Remove account"
                    onClick={() => remove(index)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                {(errors.sources?.[index]?.account_id || errors.sources?.[index]?.amount) && (
                  <p className="text-xs text-destructive">
                    {errors.sources[index]?.account_id?.message ?? errors.sources[index]?.amount?.message}
                  </p>
                )}
              </div>
            ))}
            {errors.sources?.message && <p className="text-xs text-destructive">{errors.sources.message}</p>}
            <button
              type="button"
              onClick={() => append({ account_id: "", amount: 0 })}
              className="flex w-fit items-center gap-1 py-1 text-xs font-medium text-primary"
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
              Add account
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm text-muted-foreground">Total allocated</span>
            <span className="text-lg font-semibold text-foreground">{formatCurrency(total)}</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={createPortfolio.isPending}
          className="flex h-[34px] w-fit items-center justify-center gap-1 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Create portfolio
        </button>
      </form>
    </section>
  );
}
