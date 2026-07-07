"use client";
import { useMemo, useState } from "react";
import { Magnifer } from "@solar-icons/react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVenues } from "@/hooks/api/use-venues";
import { NewVenueForm } from "./new-venue-form";
import { VenueList } from "./venue-list";
import { VENUE_TYPES } from "./venue-types";

export default function Page() {
  const { data: venues = [], isLoading } = useVenues();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return venues.filter((v) => {
      const matchesSearch = !q || v.name.toLowerCase().includes(q);
      const matchesType = typeFilter === "all" || v.venue_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [venues, search, typeFilter]);

  return (
    <main className="flex flex-1 flex-col gap-4 overflow-auto p-6">
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Magnifer
            size={16}
            weight="Outline"
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search venue…"
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {(value: string) => (value === "all" ? "All types" : (VENUE_TYPES.find((t) => t.value === value)?.label ?? value))}
            </SelectValue>
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
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <NewVenueForm />
        <VenueList venues={filtered} total={filtered.length} isLoading={isLoading} />
      </div>
    </main>
  );
}
