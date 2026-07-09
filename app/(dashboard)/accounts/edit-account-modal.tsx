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
import { useVenues } from "@/hooks/api/use-venues";
import { useUpdateAccount } from "@/hooks/api/use-accounts";
import type { Account } from "@/types/domain";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  venue_id: z.string().min(1, "Select a venue"),
  api_key: z.string(),
  secret_key: z.string(),
});
type FormValues = z.infer<typeof schema>;

const fieldClass =
  "h-10 w-full rounded-[20px] border-border bg-surface px-3 text-sm text-foreground dark:bg-surface";

export function EditAccountModal({
  account,
  onClose,
}: {
  account: Account | null;
  onClose: () => void;
}) {
  const { data: venues = [] } = useVenues();
  const updateAccount = useUpdateAccount();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: account?.name ?? "",
      venue_id: account?.venue_id ?? "",
      api_key: "",
      secret_key: "",
    },
  });

  useEffect(() => {
    if (account) {
      reset({ name: account.name, venue_id: account.venue_id, api_key: "", secret_key: "" });
    }
  }, [account, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!account) return;
    updateAccount.mutate(
      {
        id: account.id,
        name: values.name,
        venue_id: values.venue_id,
        account_type: account.account_type,
        ...(values.api_key.trim() ? { api_key: values.api_key.trim() } : {}),
        ...(values.secret_key.trim() ? { secret_key: values.secret_key.trim() } : {}),
      },
      { onSuccess: onClose },
    );
  });

  return (
    <Dialog
      open={!!account}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit live account</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-account-name" className="font-normal text-muted-foreground">
                Name
              </Label>
              <Input
                id="edit-account-name"
                placeholder="Account name"
                autoComplete="off"
                className={fieldClass}
                {...register("name")}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-account-venue" className="font-normal text-muted-foreground">
                Venue
              </Label>
              <Controller
                control={control}
                name="venue_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="edit-account-venue" className={fieldClass}>
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
              <Label htmlFor="edit-account-api-key" className="font-normal text-muted-foreground">
                API key
              </Label>
              <Input
                id="edit-account-api-key"
                placeholder="Leave blank to keep existing"
                autoComplete="off"
                className={fieldClass}
                {...register("api_key")}
              />
              {errors.api_key && <p className="text-xs text-destructive">{errors.api_key.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-account-secret-key" className="font-normal text-muted-foreground">
                Secret key
              </Label>
              <Input
                id="edit-account-secret-key"
                type="password"
                placeholder="Leave blank to keep existing"
                autoComplete="new-password"
                className={fieldClass}
                {...register("secret_key")}
              />
              {errors.secret_key && <p className="text-xs text-destructive">{errors.secret_key.message}</p>}
            </div>
          </div>
          {updateAccount.isError && (
            <p className="text-xs text-destructive">Couldn&rsquo;t update account. Please try again.</p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <button
              type="submit"
              disabled={updateAccount.isPending}
              className="flex h-[34px] w-fit items-center justify-center gap-1 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Update account
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
