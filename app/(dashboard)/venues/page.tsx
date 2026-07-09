"use client";
import { useMemo, useState } from "react";
import { MinimalisticMagnifer } from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVenues } from "@/hooks/api/use-venues";
import { NewVenueForm } from "./new-venue-form";
import { VenueList } from "./venue-list";
import { EditVenueModal } from "./edit-venue-modal";
import { VENUE_TYPES } from "./venue-types";
import type { Venue } from "@/types/domain";

export default function Page() {
  const { data: venues = [], isPending, isError } = useVenues();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return venues.filter((v) => {
      const matchesSearch = !q || v.name.toLowerCase().includes(q);
      const matchesType = typeFilter === "all" || v.venue_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [venues, search, typeFilter]);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 bg-surface">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-60 items-center gap-2 rounded-[20px] border border-border px-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search venue..."
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
            {VENUE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <NewVenueForm />
        <VenueList
          venues={filtered}
          total={filtered.length}
          isLoading={isPending}
          isError={isError}
          onEdit={setEditingVenue}
        />
      </div>
      <EditVenueModal venue={editingVenue} onClose={() => setEditingVenue(null)} />
    </main>
  );
}
