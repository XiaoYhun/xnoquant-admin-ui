import { format, isValid, parseISO } from "date-fns";

// Run.started_at — when the engine actually began the run (null for queued runs that
// haven't started yet). Shared by every run list's "Started" column.
export function StartedAt({ iso }: { iso?: string | null }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  const d = parseISO(iso);
  if (!isValid(d)) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-xs text-white">
      <span className="block whitespace-nowrap">{format(d, "yyyy-MM-dd")}</span>
      <span className="block whitespace-nowrap">{format(d, "HH:mm:ss")}</span>
    </span>
  );
}
