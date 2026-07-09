"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusIcon } from "@/components/icons/plus";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVenues } from "@/hooks/api/use-venues";
import { useCreateAccount } from "@/hooks/api/use-accounts";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  venue_id: z.string().min(1, "Select a venue"),
  api_key: z.string(),
  secret_key: z.string(),
});
type FormValues = z.infer<typeof schema>;

const fieldClass =
  "h-10 w-full rounded-[20px] border-border bg-surface px-3 text-sm text-foreground dark:bg-surface";

export function NewAccountForm() {
  const { data: venues = [] } = useVenues();
  const createAccount = useCreateAccount();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      venue_id: "",
      api_key: "",
      secret_key: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (!values.api_key.trim()) setError("api_key", { message: "API key is required" });
    if (!values.secret_key.trim()) setError("secret_key", { message: "Secret key is required" });
    if (!values.api_key.trim() || !values.secret_key.trim()) return;
    createAccount.mutate(
      {
        name: values.name,
        venue_id: values.venue_id,
        // No Type field in the Figma form — every new account defaults to "spot".
        account_type: "spot",
        api_key: values.api_key.trim(),
        secret_key: values.secret_key.trim(),
      },
      { onSuccess: () => reset({ name: "", venue_id: "", api_key: "", secret_key: "" }) },
    );
  });

  return (
    <section className="flex h-full min-h-0 w-[480px] shrink-0 flex-col overflow-hidden rounded-xl border border-border shadow-[0_4px_12px_0_rgba(0,0,0,0.05)] bg-background">
      <header className="flex items-center justify-between border-b border-border bg-secondary px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">New live account</h2>
      </header>
      <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-name" className="font-normal text-muted-foreground">
              Name
            </Label>
            <Input
              id="account-name"
              placeholder="Account name"
              autoComplete="off"
              className={fieldClass}
              {...register("name")}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-venue" className="font-normal text-muted-foreground">
              Venue
            </Label>
            <Controller
              control={control}
              name="venue_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="account-venue" className={fieldClass}>
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.venue_id && <p className="text-xs text-destructive">{errors.venue_id.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-api-key" className="font-normal text-muted-foreground">
              API key
            </Label>
            <Input
              id="account-api-key"
              placeholder="API key"
              autoComplete="off"
              className={fieldClass}
              {...register("api_key")}
            />
            {errors.api_key && <p className="text-xs text-destructive">{errors.api_key.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-secret-key" className="font-normal text-muted-foreground">
              Secret key
            </Label>
            <Input
              id="account-secret-key"
              type="password"
              placeholder="Secret key"
              autoComplete="new-password"
              className={fieldClass}
              {...register("secret_key")}
            />
            {errors.secret_key && <p className="text-xs text-destructive">{errors.secret_key.message}</p>}
          </div>
          {/* Capital: kept for design fidelity — the HFT Account/NewAccount schema has no capital
              field, so this value is never sent to the API (see docs/plans/api-integration.md). */}
          <div className="flex items-center justify-between">
            <Label htmlFor="account-capital" className="font-normal text-muted-foreground">
              Capital
            </Label>
            <div className="flex items-center gap-1">
              <input
                id="account-capital"
                type="number"
                placeholder="0"
                className="w-32 bg-transparent text-right text-lg font-semibold text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-lg font-semibold text-foreground">đ</span>
            </div>
          </div>
        </div>
        {createAccount.isError && (
          <p className="text-xs text-destructive">Couldn&rsquo;t create account. Please try again.</p>
        )}
        <button
          type="submit"
          disabled={createAccount.isPending}
          className="flex h-[34px] w-fit items-center justify-center gap-1 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <PlusIcon className="size-3.5" />
          Create account
        </button>
      </form>
    </section>
  );
}
