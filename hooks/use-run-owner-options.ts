"use client";
import { useMemo, useState } from "react";
import type { OwnerOption } from "@/components/owner-filter";
import type { UserRosterEntry } from "@/hooks/api/use-users";
import type { PaperRunRow } from "@/lib/mock/paper-runs";

/**
 * Owner filter options shared by the three run lists (Backtesting/Paper Trading/Live trade).
 *
 * Admins get the full roster (`useUserRoster` — name + email for everyone who has signed in);
 * the roster call 403s for everyone else, so non-admins fall back to whichever owners are on the
 * loaded page instead (`owner_id`/`owner`/`ownerEmail` off each row — see toPaperRunRow).
 *
 * Either way, `selected` is kept in the returned list even when this render's roster/rows don't
 * carry it: the owner filter narrows the table server-side, so paging or combining it with
 * another filter can leave zero matching rows on screen, which would otherwise blank the pill
 * for an owner that's still applied.
 */
export function useRunOwnerOptions(
  roster: UserRosterEntry[],
  rows: PaperRunRow[],
  selected: string,
): OwnerOption[] {
  const options = useMemo(() => {
    if (roster.length > 0) {
      return roster
        .map((u): OwnerOption | null => {
          const name = u.username?.trim() || u.email?.trim();
          return name ? { id: u.user_id, name, email: u.email?.trim() || undefined } : null;
        })
        .filter((o): o is OwnerOption => o !== null);
    }
    const seen = new Map<string, OwnerOption>();
    for (const r of rows) {
      if (r.owner_id && !seen.has(r.owner_id)) {
        seen.set(r.owner_id, {
          id: r.owner_id,
          name: r.owner ?? `${r.owner_id.slice(0, 8)}…`,
          email: r.ownerEmail ?? undefined,
        });
      }
    }
    return [...seen.values()];
  }, [roster, rows]);

  const found = options.find((o) => o.id === selected) ?? null;

  // Remember the selected owner's label while it's visible, so a later render whose roster/rows
  // don't carry it (a page turn, or another filter narrowing the table to zero rows) doesn't
  // blank the filter pill. Adjusted synchronously during render — same idiom as `alignedRunId` on
  // these pages — rather than a ref, since refs can't be read during render.
  const [remembered, setRemembered] = useState<OwnerOption | null>(null);
  if (found && remembered?.id !== found.id) {
    setRemembered(found);
  } else if (selected && !found && remembered?.id !== selected) {
    // Never seen before (e.g. picked, then every one of their rows dropped off before this
    // render) — fall back to the truncated id, same convention as Strategy List's owner cell.
    setRemembered({ id: selected, name: `${selected.slice(0, 8)}…` });
  }

  return useMemo(() => {
    const list = !found && selected && remembered?.id === selected ? [...options, remembered] : options;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [options, found, selected, remembered]);
}
