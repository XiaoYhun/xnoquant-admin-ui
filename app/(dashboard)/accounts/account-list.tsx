"use client";
import { useState } from "react";
import { Pen2, TrashBinTrash } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useVenues } from "@/hooks/api/use-venues";
import { useDeleteAccount, useSendDnseOtp } from "@/hooks/api/use-accounts";
import type { Account } from "@/types/domain";

type OtpFeedback = "sending" | "sent" | "error";

const COLS = [
  { key: "name", label: "Name", w: "18%" },
  { key: "venue", label: "Venue", w: "16%" },
  { key: "owner", label: "Owner", w: "12%" },
  { key: "capital", label: "Capital", w: "16%" },
  { key: "strategy", label: "Strategy", w: "16%" },
  { key: "asset", label: "Asset", w: "14%" },
  { key: "action", label: "", w: "8%" },
] as const;

export function AccountList({
  accounts,
  total,
  isLoading,
  isError,
  onEdit,
}: {
  accounts: Account[];
  total: number;
  isLoading: boolean;
  isError?: boolean;
  onEdit: (account: Account) => void;
}) {
  const { data: venues = [] } = useVenues();
  const deleteAccount = useDeleteAccount();
  const sendOtp = useSendDnseOtp();
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
  const [otpFeedback, setOtpFeedback] = useState<Record<string, OtpFeedback | undefined>>({});
  const venueName = (venueId: string) => venues.find((v) => v.id === venueId)?.name ?? venueId;
  const isDnseAccount = (venueId: string) => venues.find((v) => v.id === venueId)?.venue_type === "dnse";

  const handleSendOtp = (account: Account) => {
    setOtpFeedback((prev) => ({ ...prev, [account.id]: "sending" }));
    sendOtp.mutate(account.id, {
      onSuccess: () => {
        setOtpFeedback((prev) => ({ ...prev, [account.id]: "sent" }));
        setTimeout(() => setOtpFeedback((prev) => ({ ...prev, [account.id]: undefined })), 2000);
      },
      onError: () => {
        setOtpFeedback((prev) => ({ ...prev, [account.id]: "error" }));
        setTimeout(() => setOtpFeedback((prev) => ({ ...prev, [account.id]: undefined })), 2000);
      },
    });
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border shadow-[0_4px_12px_0_rgba(0,0,0,0.05)] bg-background">
      <header className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">All accounts</h2>
        <span className="text-sm font-medium text-foreground">&bull; {total}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>}
        {isError && !isLoading && (
          <p className="p-4 text-sm text-destructive">Couldn&rsquo;t load accounts. Please try again.</p>
        )}
        {!isLoading && !isError && accounts.length === 0 && (
          <div className="m-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-10">
            <p className="text-xs text-muted-foreground">No live accounts yet.</p>
          </div>
        )}
        {!isLoading && !isError && accounts.length > 0 && (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                {COLS.map((c) => (
                  <TableHead key={c.key} style={{ width: c.w }} className="bg-surface">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="truncate text-sm text-foreground" title={a.name}>
                    {a.name}
                  </TableCell>
                  <TableCell className="truncate text-sm text-foreground">{venueName(a.venue_id)}</TableCell>
                  <TableCell className="truncate text-sm text-foreground" title={a.owner_username ?? undefined}>
                    {a.owner_username ?? <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  {/* Capital/Strategy/Asset: not in the HFT Account schema — see docs/plans/api-integration.md. */}
                  <TableCell className="text-sm text-muted-foreground">-</TableCell>
                  <TableCell className="text-sm text-muted-foreground">-</TableCell>
                  <TableCell className="text-sm text-muted-foreground">-</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {isDnseAccount(a.venue_id) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={otpFeedback[a.id] === "sending"}
                          className={`h-8 px-2 text-xs ${
                            otpFeedback[a.id] === "error"
                              ? "text-destructive"
                              : otpFeedback[a.id] === "sent"
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => handleSendOtp(a)}
                        >
                          {otpFeedback[a.id] === "sent"
                            ? "OTP sent"
                            : otpFeedback[a.id] === "error"
                              ? "Failed"
                              : otpFeedback[a.id] === "sending"
                                ? "Sending…"
                                : "Send OTP"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${a.name}`}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => onEdit(a)}
                      >
                        <Pen2 weight="Outline" className="size-5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${a.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDelete(a)}
                      >
                        <TrashBinTrash weight="Outline" className="size-5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            deleteAccount.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{pendingDelete?.name}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteAccount.isError && (
            <p className="text-xs text-destructive">Couldn&rsquo;t delete account. Please try again.</p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteAccount.isPending}
              onClick={() => {
                if (pendingDelete) {
                  deleteAccount.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
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
