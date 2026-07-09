"use client";
import { useMemo, useState } from "react";
import { MinimalisticMagnifer } from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts } from "@/hooks/api/use-accounts";
import { NewAccountForm } from "./new-account-form";
import { AccountList } from "./account-list";
import { ACCOUNT_TYPES } from "./account-types";
import type { Account } from "@/types/domain";

export default function Page() {
  const { data: accounts = [], isPending, isError } = useAccounts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      const matchesSearch = !q || a.name.toLowerCase().includes(q);
      const matchesType = typeFilter === "all" || a.account_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [accounts, search, typeFilter]);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 bg-surface">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-60 items-center gap-2 rounded-[20px] border border-border px-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
        </div>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value ?? "all")}>
          <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ACCOUNT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <NewAccountForm
          key={editingAccount?.id ?? "new"}
          editingAccount={editingAccount}
          onDone={() => setEditingAccount(null)}
        />
        <AccountList
          accounts={filtered}
          total={filtered.length}
          isLoading={isPending}
          isError={isError}
          onEdit={setEditingAccount}
        />
      </div>
    </main>
  );
}
