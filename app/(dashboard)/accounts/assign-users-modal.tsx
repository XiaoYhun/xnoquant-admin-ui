"use client";
import { useMemo, useState } from "react";
import { MinimalisticMagnifer } from "@solar-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUserRoster, type UserRosterEntry } from "@/hooks/api/use-users";
import { useAccounts } from "@/hooks/api/use-accounts";
import {
  useAccountAssignments,
  useAssignmentCountsByUser,
  useAssignAccount,
  useRevokeAssignment,
} from "@/hooks/api/use-account-assignments";
import { resourceErrorMessage } from "@/lib/api-client";
import type { Account } from "@/types/domain";

// Only trader/pm can hold an account assignment (`POST /assignments` — "grant a trader/pm
// access"), and each role caps how many accounts one user may hold. Shown to the admin as the
// "Rules:" line under the table.
const ROLE_LIMITS = [
  { role: "pm", label: "PM", limit: 10 },
  { role: "trader", label: "Trader", limit: 1 },
] as const;

/** The assignable role a user holds, most permissive first — or null if they hold none. */
function assignableRole(user: UserRosterEntry) {
  return ROLE_LIMITS.find((r) => user.roles.includes(r.role)) ?? null;
}

const GRAD_GREEN = "bg-[linear-gradient(162deg,#cff8ea_0%,#67e1c1_100%)]";
const GRAD_ORANGE = "bg-[linear-gradient(157deg,#ffe3d6_0%,#ff9783_100%)]";

const HEAD = "h-10 bg-surface px-3 py-2.5 text-xs font-normal text-white";
const CELL = "px-3 py-2.5 text-xs text-white";

export function AssignUsersModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const { data: roster = [], isPending: rosterPending } = useUserRoster();
  const { data: accounts = [] } = useAccounts();
  const { data: assignments, isPending: assignmentsPending } = useAccountAssignments(account.id);
  const { counts, isPending: countsPending } = useAssignmentCountsByUser(
    accounts.map((a) => a.id),
    account.id,
    accounts.length > 0,
  );
  const assign = useAssignAccount(account.id);
  const revoke = useRevokeAssignment(account.id);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  // Only the admin's *overrides* are state — the baseline is whoever already has access, so
  // the tick boxes stay in sync with a background refetch instead of snapshotting it once.
  const [changes, setChanges] = useState<Map<string, boolean>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster
      .map((u) => ({ user: u, role: assignableRole(u) }))
      .filter((r) => r.role !== null)
      .filter((r) => roleFilter === "all" || r.role!.role === roleFilter)
      .filter(
        (r) =>
          !q ||
          (r.user.username ?? "").toLowerCase().includes(q) ||
          (r.user.email ?? "").toLowerCase().includes(q),
      );
  }, [roster, search, roleFilter]);

  const isLoading = rosterPending || assignmentsPending || countsPending;

  const assignedNow = useMemo(() => new Set((assignments ?? []).map((a) => a.user_id)), [assignments]);
  const picked = useMemo(() => {
    const next = new Set(assignedNow);
    for (const [userId, on] of changes) {
      if (on) next.add(userId);
      else next.delete(userId);
    }
    return next;
  }, [assignedNow, changes]);

  const toggle = (userId: string) =>
    setChanges((prev) => new Map(prev).set(userId, !picked.has(userId)));

  const toAdd = [...picked].filter((id) => !assignedNow.has(id));
  const toRemove = [...assignedNow].filter((id) => !picked.has(id));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const id of toAdd) await assign.mutateAsync(id);
      for (const id of toRemove) await revoke.mutateAsync(id);
      onClose();
    } catch (e) {
      setError(resourceErrorMessage(e, "this account"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* 788px is the Figma frame height; clamped because min-height beats max-height in CSS,
          so an unclamped floor would overflow a short viewport. */}
      <DialogContent className="flex max-h-[85vh] min-h-[min(788px,85vh)] max-w-[600px] flex-col sm:max-w-[600px] gap-0 overflow-hidden rounded-[20px] border-border bg-background p-0">
        <div className="shrink-0 bg-surface px-4 py-2.5">
          <DialogTitle className="text-lg font-semibold text-white">
            Assign users to &ldquo;{account.name}&rdquo;
          </DialogTitle>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4">
          <p className="text-sm text-muted-foreground">Select user to assign to this account</p>

          <div className="flex items-center gap-3">
            <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[20px] border border-border pr-3 pl-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
              <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
            </div>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value ?? "all")}>
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLE_LIMITS.map((r) => (
                  <SelectItem key={r.role} value={r.role}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl border border-border bg-background">
            {isLoading && <p className="p-4 text-xs text-muted-foreground">Loading&hellip;</p>}
            {!isLoading && rows.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">No matching users.</p>
            )}
            {!isLoading && rows.length > 0 && (
              <Table className="table-fixed">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead className={`${HEAD} w-11`} />
                    <TableHead className={HEAD}>User</TableHead>
                    <TableHead className={`${HEAD} w-[104px]`}>Role</TableHead>
                    <TableHead className={`${HEAD} w-[120px]`}>Current Account</TableHead>
                    <TableHead className={`${HEAD} w-[104px]`}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ user, role }) => {
                    const isPicked = picked.has(user.user_id);
                    // The roster only fills `username` once that user has set one with the auth
                    // service; fall back to the email, then the raw id.
                    const name = user.username?.trim() || user.email || user.user_id;
                    // The count shown includes this account's pending state, so ticking a row
                    // moves it to its limit the same way saving would.
                    const other = counts.get(user.user_id) ?? 0;
                    const shown = other + (isPicked ? 1 : 0);
                    const atLimit = shown >= role!.limit;
                    const blocked = !isPicked && other >= role!.limit;
                    return (
                      <TableRow key={user.user_id} className="h-[52px]">
                        <TableCell className="px-3 py-2.5">
                          <Checkbox
                            className="size-5 rounded-[6px]"
                            checked={isPicked}
                            disabled={blocked}
                            onCheckedChange={() => toggle(user.user_id)}
                            aria-label={`Assign ${name}`}
                          />
                        </TableCell>
                        <TableCell className={`${CELL} overflow-hidden`}>
                          <p className="truncate leading-[18px]">{name}</p>
                          {user.email && user.email !== name && (
                            <p className="truncate text-[10px] leading-[14px] text-muted-foreground">{user.email}</p>
                          )}
                        </TableCell>
                        <TableCell className={CELL}>{role!.label}</TableCell>
                        <TableCell className={CELL}>
                          {shown}/{role!.limit}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <span
                              className={`size-1 shrink-0 rounded-full ${atLimit ? GRAD_ORANGE : GRAD_GREEN}`}
                            />
                            <span
                              className={`text-xs ${atLimit ? GRAD_ORANGE : GRAD_GREEN} bg-clip-text text-transparent`}
                            >
                              {atLimit ? "At limit" : "Available"}
                            </span>
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <p className="text-xs text-muted-foreground">Rules: Trader max 1 account. PM max 10 accounts.</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-[32px] border border-border bg-black px-3 py-2 text-xs text-white transition-opacity hover:opacity-90"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || isLoading || (toAdd.length === 0 && toRemove.length === 0)}
            className="flex-1 cursor-pointer rounded-[32px] bg-[linear-gradient(173deg,#cff8ea_0%,#67e1c1_100%)] px-3 py-2 text-xs text-[#0d0d0d] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : `Assign (${picked.size})`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
