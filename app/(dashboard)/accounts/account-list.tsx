"use client";
import { useMemo, useState } from "react";
import { Key, Pen2, TrashBinTrash, UsersGroupRounded } from "@solar-icons/react";
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
import { useDeleteAccount } from "@/hooks/api/use-accounts";
import { useAssigneesByAccount } from "@/hooks/api/use-account-assignments";
import { useUserRoster, userLabelMap } from "@/hooks/api/use-users";
import { useAuth } from "@/hooks/use-auth";
import { RefreshDnseTokenDialog } from "./refresh-dnse-token-dialog";
import { AssignUsersModal } from "./assign-users-modal";
import { resourceErrorMessage } from "@/lib/api-client";
import type { Account } from "@/types/domain";


const COLS = [
  { key: "name", label: "Name", w: "16%" },
  { key: "venue", label: "Venue", w: "15%" },
  { key: "assigned", label: "Assigned users", w: "16%" },
  { key: "capital", label: "Capital", w: "14%" },
  { key: "strategy", label: "Strategy", w: "14%" },
  { key: "asset", label: "Asset", w: "9%" },
  { key: "action", label: "", w: "16%" },
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
  const { isAdmin, user } = useAuth();
  // Both endpoints are admin-only. A non-admin's list is already just the accounts assigned to
  // them (`GET /api/accounts` — "caller's own assigned accounts"), so their own name is the row.
  const assignees = useAssigneesByAccount(
    accounts.map((a) => a.id),
    isAdmin,
  );
  const { data: roster = [] } = useUserRoster(isAdmin);
  const labels = useMemo(() => userLabelMap(roster), [roster]);
  const self = user?.username?.trim() || user?.fullname?.trim() || user?.email || null;
  const assignedNames = (accountId: string) =>
    isAdmin ? (assignees.get(accountId) ?? []).map((id) => labels.get(id) ?? id) : self ? [self] : [];
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
  const [pendingRefresh, setPendingRefresh] = useState<Account | null>(null);
  const [pendingAssign, setPendingAssign] = useState<Account | null>(null);
  const venueName = (venueId: string) => venues.find((v) => v.id === venueId)?.name ?? venueId;
  const isDnseAccount = (venueId: string) => venues.find((v) => v.id === venueId)?.venue_type === "dnse";

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
          <Table className="table-fixed min-w-[1000px]">
            <TableHeader>
              <TableRow>
                {COLS.map((c, i) => (
                  <TableHead
                    key={c.key}
                    style={{ width: c.w }}
                    sticky={i === 0 ? "left" : i === COLS.length - 1 ? "right" : undefined}
                    className="bg-surface"
                  >
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow opaque key={a.id}>
                  <TableCell sticky="left" className="truncate text-sm text-foreground" title={a.name}>
                    {a.name}
                  </TableCell>
                  <TableCell className="truncate text-sm text-foreground">{venueName(a.venue_id)}</TableCell>
                  <TableCell className="truncate text-sm text-foreground" title={assignedNames(a.id).join(", ")}>
                    {assignedNames(a.id).join(", ") || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  {/* Capital/Strategy/Asset: not in the HFT Account schema — see docs/plans/api-integration.md. */}
                  <TableCell className="text-sm text-muted-foreground">-</TableCell>
                  <TableCell className="text-sm text-muted-foreground">-</TableCell>
                  <TableCell className="text-sm text-muted-foreground">-</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* DNSE trading tokens last 8h and need a daily re-auth. */}
                      {isDnseAccount(a.venue_id) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Refresh trading token for ${a.name}`}
                          title="Refresh trading token"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setPendingRefresh(a)}
                        >
                          <Key weight="Outline" className="size-5" />
                        </Button>
                      )}
                      {/* Assign/update/delete are admin-only on the API (403 for everyone else);
                          the DNSE token refresh above is not — an assigned trader may re-auth. */}
                      {isAdmin && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Assign users to ${a.name}`}
                            title="Assign users"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => setPendingAssign(a)}
                          >
                            <UsersGroupRounded weight="Outline" className="size-5" />
                          </Button>
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
                        </>
                      )}
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
            <p className="text-xs text-destructive">{resourceErrorMessage(deleteAccount.error, "this account")}</p>
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

      {pendingAssign && (
        <AssignUsersModal account={pendingAssign} onClose={() => setPendingAssign(null)} />
      )}

      <RefreshDnseTokenDialog
        account={pendingRefresh}
        open={!!pendingRefresh}
        onOpenChange={(o) => !o && setPendingRefresh(null)}
      />
    </section>
  );
}
