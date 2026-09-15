"use client";
import { useMemo, useState } from "react";
import { AltArrowDown } from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMarketOrderbook } from "@/hooks/api/use-market-orderbook";
import { useOrderbookSymbols, type OrderbookSymbol } from "@/hooks/api/use-orderbook-symbols";
import { useVenues } from "@/hooks/api/use-venues";
import { useAccounts } from "@/hooks/api/use-accounts";

// Right rail of the Live trade screen (Figma 14779:27408). Opens on a book with no clicks — the
// first venue (API order) whose stream actually opens a book (see `opensDirectlyOnABook` below),
// its default symbol.
//
// Fully self-contained: Venue -> Account -> Symbol all live here, not in the page. That also
// means the rail is deliberately NOT scoped by the page's market tab (Stocks/Future/Crypto)
// anymore — the whole point of this picker is "view ANY symbol" (Lark note), so tying it to
// whatever tab the runs table happens to be on would just make the rail's own venue/account
// choice redundant with — and sometimes fight — the table filter. Picking a venue here is now
// the only scoping the rail needs.
//
// Depth comes from `/api/market-data/orderbook/stream`, which serves any symbol on any configured
// venue whether or not a run is using it — so the picker offers the whole catalog (VN30F1M and the
// crypto pairs alike), not just what happens to be running.
//
// The quote strip's last/change and the board's ceiling/reference/floor plus matched volume
// ("KL") and turnover ("GT") have no field in the book frame at all, so they read "—" until an
// endpoint supplies them.
const DASH = <span className="text-[#9db2ce]">—</span>;

// The depth ladder does not group thousands ("1927.90").
const ladderNum = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

// Only SSI needs credentials to read market data — it reads over the same encrypted
// api_key/secret_key columns every other venue's account uses. Binance (spot/futures) reads
// anonymously; DNSE/TCBS have no standalone market-data feed at all and 400 regardless of
// account_id. Source: crates/api/src/routes/market_data.rs on hft-platform's origin/develop.
function accountRequiredFor(venueType: string | undefined): boolean {
  return venueType === "ssi";
}

// Whether this venue, as-is, opens directly on a book with no further clicks: Binance needs
// nothing, SSI needs an account it already has. DNSE/TCBS never do (unsupported venue), and an
// SSI venue with zero accounts doesn't either — both would land the rail on an error/prompt
// instead of a book, so neither is a candidate default even though both stay pickable.
function opensDirectlyOnABook(venueType: string | undefined, hasAccount: boolean): boolean {
  if (venueType === "binance_spot" || venueType === "binance_futures") return true;
  if (venueType === "ssi") return hasAccount;
  return false;
}

// Binance has no natural "first" instrument the way VN30F1M is for SSI, and the alphabetically
// first pair in a several-thousand-symbol catalog is usually an obscure/delisted-looking one
// (e.g. "0GBNB") — a poor default. BTCUSDT is the reference viewer's own placeholder example for
// non-SSI venues (`web/src/routes/orderbook.tsx`) and the obvious "main" pair, so prefer it when
// the venue lists it.
const PREFERRED_SYMBOL: Record<string, string> = {
  binance_spot: "BTCUSDT",
  binance_futures: "BTCUSDT",
};

function defaultSymbolOf(venueType: string | undefined, symbols: OrderbookSymbol[]): OrderbookSymbol | undefined {
  const preferredSymbol = venueType ? PREFERRED_SYMBOL[venueType] : undefined;
  const preferred = preferredSymbol ? symbols.find((s) => s.symbol === preferredSymbol) : undefined;
  return preferred ?? symbols[0];
}

// The whole catalog is several thousand instruments, so the symbol picker is a typeahead over a
// capped slice, not a plain <Select>: rendering every symbol as an item froze the page on open.
const MAX_SHOWN = 100;

type PickerItem = { id: string; label: string };

// Shared trigger for the Venue and Account pills: both are short, unfiltered lists (a handful of
// venues/accounts, never thousands like the symbol catalog), so neither needs the symbol picker's
// search box.
function PickerPill({
  placeholder,
  items,
  value,
  onChange,
}: {
  placeholder: string;
  items: PickerItem[];
  value?: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={items.length === 0}
        className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-2.5 text-[11px] text-foreground outline-none disabled:cursor-not-allowed"
      >
        {selected?.label ?? "—"}
        <AltArrowDown size={12} weight="Outline" className="shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1.5">
        <div className="max-h-56 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{placeholder}</p>
          ) : (
            items.map((i) => (
              <div
                key={i.id}
                onClick={() => {
                  onChange(i.id);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-[6px] px-2 py-2 text-xs text-white hover:bg-secondary/60"
              >
                {i.label}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Scoped subscription: only the selected symbol streams, and it re-binds on venue/account/symbol
// change.
export function OrderbookPanel() {
  const catalog = useOrderbookSymbols();
  const { data: venues = [] } = useVenues();
  const { data: accounts = [] } = useAccounts();

  // Only venues that actually carry a symbol are worth offering — an empty venue would open the
  // Symbol picker on nothing. Deliberately NOT narrowed to venue types the stream supports
  // (Binance/SSI): DNSE and TCBS stay pickable so the rail can show the venue's own refusal
  // ("live orderbook viewing is not supported for venue Dnse") rather than hiding them.
  const venueOptions = useMemo(() => {
    const withSymbols = new Set(catalog.map((o) => o.venueId));
    return venues.filter((v) => withSymbols.has(v.id));
  }, [catalog, venues]);

  // Default venue: the first one (API order) whose stream opens directly on a book, so the rail
  // never opens with no clicks on an error. DNSE/TCBS and an account-less SSI venue stay pickable
  // (see `venueOptions` above) but are skipped as a default; if literally nothing qualifies, fall
  // back to the first venue with symbols at all rather than showing an empty rail.
  const defaultVenue = useMemo(
    () =>
      venueOptions.find((v) => opensDirectlyOnABook(v.venue_type, accounts.some((a) => a.venue_id === v.id))) ??
      venueOptions[0],
    [venueOptions, accounts],
  );

  const [venueId, setVenueId] = useState<string | null>(null);
  const selectedVenue = venueOptions.find((v) => v.id === venueId) ?? defaultVenue;
  const accountRequired = accountRequiredFor(selectedVenue?.venue_type);

  const venueAccounts = useMemo(
    () => accounts.filter((a) => a.venue_id === selectedVenue?.id),
    [accounts, selectedVenue],
  );

  const [accountId, setAccountId] = useState(""); // "" = unset (falls back to the default below)
  const [symbol, setSymbol] = useState<string | null>(null);

  // Switching venues invalidates the account and symbol picked under the old one — reset during
  // render (not an effect), the same pattern `alignedRunId` on the page uses.
  const [prevVenueId, setPrevVenueId] = useState(selectedVenue?.id);
  if (prevVenueId !== selectedVenue?.id) {
    setPrevVenueId(selectedVenue?.id);
    setAccountId("");
    setSymbol(null);
  }

  // Default account: the venue's first account when the stream requires one (SSI); otherwise no
  // account at all — the stream works without one, so "no account" IS the default, matching the
  // hft-platform reference viewer (web/src/routes/orderbook.tsx).
  const selectedAccountId = accountId || (accountRequired ? venueAccounts[0]?.id : undefined);

  const venueSymbols = useMemo(
    () => catalog.filter((o) => o.venueId === selectedVenue?.id),
    [catalog, selectedVenue],
  );
  const selectedSymbol = venueSymbols.find((o) => o.symbol === symbol) ?? defaultSymbolOf(selectedVenue?.venue_type, venueSymbols);

  // No stream target while an SSI venue has no account picked yet — the request would just 400
  // ("account_id is required for SSI venues"), and the rail can say why up front instead.
  const target: OrderbookSymbol | undefined =
    selectedSymbol && (!accountRequired || selectedAccountId)
      ? { ...selectedSymbol, accountId: selectedAccountId }
      : undefined;

  const { book: live, error } = useMarketOrderbook(target);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? venueSymbols.filter((o) => o.symbol.toLowerCase().includes(q)) : venueSymbols;
  }, [venueSymbols, query]);

  // Bids and asks arrive as separate ladders; the table renders them as paired rows, so zip them
  // and let the shorter side leave blanks rather than pretending a level exists on both.
  const levels = useMemo(() => {
    if (!live) return [];
    const depth = Math.max(live.bids.length, live.asks.length);
    return Array.from({ length: depth }, (_, i) => ({ bid: live.bids[i], ask: live.asks[i] }));
  }, [live]);

  // One scale across BOTH sides so bid and ask depth stay comparable — in Figma 14779:27408 the
  // buy amounts (28–42) fill most of their column while the sells (3–4) read as thin slivers.
  // Floored at 1 so an empty/zero ladder can't divide by zero into a NaN width.
  const maxAmount = useMemo(
    () => Math.max(1, ...levels.flatMap((l) => [l.bid?.qty ?? 0, l.ask?.qty ?? 0])),
    [levels],
  );

  // Not every venue publishes a book — DNSE answers "live orderbook viewing is not supported for
  // venue Dnse" — so show the venue's own reason rather than waiting on a stream that won't come.
  // An SSI venue with no account picked never opens a stream at all, so that gets its own message.
  const emptyMessage =
    error ??
    (accountRequired && !selectedAccountId
      ? "Select an account to view this venue's book."
      : selectedSymbol
        ? "Waiting for the first book update…"
        : "No symbols available.");

  const accountItems: PickerItem[] = useMemo(() => {
    const list = venueAccounts.map((a) => ({ id: a.id, label: a.name }));
    return accountRequired ? list : [{ id: "", label: "No account" }, ...list];
  }, [venueAccounts, accountRequired]);

  return (
        <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
      {/* h-12 matches the table's header row (TableHead) so the two bars line up side by side. */}
      <div className="flex h-12 w-full shrink-0 items-center border-b border-border bg-secondary px-4">
        <h2 className="text-sm font-semibold leading-5 text-white">Orderbook</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 py-3">
        <div className="flex shrink-0 items-center gap-2 px-4">
          <PickerPill
            placeholder="No venues available."
            items={venueOptions.map((v) => ({ id: v.id, label: v.name }))}
            value={selectedVenue?.id}
            onChange={setVenueId}
          />
          <PickerPill
            placeholder={accountRequired ? "No accounts for this venue." : "No account"}
            items={accountItems}
            value={selectedAccountId ?? ""}
            onChange={setAccountId}
          />
        </div>

        <div className="flex shrink-0 flex-col gap-1 px-4">
          <div className="flex items-center justify-between gap-2">
            <Popover
              open={pickerOpen}
              onOpenChange={(next) => {
                setPickerOpen(next);
                setQuery("");
              }}
            >
              <PopoverTrigger
                disabled={!selectedSymbol}
                className="flex cursor-pointer items-center gap-1 text-base font-medium leading-6 text-white outline-none disabled:cursor-not-allowed"
              >
                {selectedSymbol?.symbol ?? "—"}
                <AltArrowDown weight="Outline" className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1.5">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search symbol..."
                  className="mb-1 h-8 w-full rounded-md bg-secondary px-2 text-xs text-white outline-none placeholder:text-muted-foreground"
                />
                <div className="max-h-56 overflow-y-auto">
                  {matches.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">No matches.</p>
                  ) : (
                    matches.slice(0, MAX_SHOWN).map((o) => (
                      <div
                        key={o.symbol}
                        onClick={() => {
                          setSymbol(o.symbol);
                          setPickerOpen(false);
                        }}
                        className="cursor-pointer rounded-[6px] px-2 py-2 text-xs text-white hover:bg-secondary/60"
                      >
                        {o.symbol}
                      </div>
                    ))
                  )}
                  {matches.length > MAX_SHOWN && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      {matches.length - MAX_SHOWN} more — keep typing to narrow.
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {/* Last traded price and its change have no field in the live frame. */}
            <div className="flex items-center gap-1.5 text-sm font-medium leading-5">{DASH}</div>
          </div>

          {/* Ceiling / reference / floor use the board's own palette (Trần / Sàn), not the
              green-red PnL palette. No live source for any of these, nor for matched volume
              ("KL") / turnover ("GT") — labels stay so the strip keeps its shape. */}
          <div className="flex items-center justify-between py-0.5 text-[11px] leading-4">
            <div className="flex items-center gap-1.5">
              <span className="flex items-center text-[#dc6bde]">
                <span aria-hidden className="mr-0.5 text-[10px] leading-none">
                  ▲
                </span>
                {DASH}
              </span>
              <span className="flex items-center gap-[3px] text-[#f1c617]">
                <span aria-hidden className="size-2 rounded-[1px] bg-[#f1c617]" />
                {DASH}
              </span>
              <span className="flex items-center text-[#0fdee6]">
                <span aria-hidden className="mr-0.5 text-[10px] leading-none">
                  ▼
                </span>
                {DASH}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5">
                <span className="text-[#9db2ce]">KL:</span>
                {DASH}
              </span>
              <span className="flex items-center gap-0.5">
                <span className="text-[#9db2ce]">GT:</span>
                {DASH}
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-9 w-full shrink-0 items-center border-y border-border bg-surface text-xs leading-5 whitespace-nowrap text-[#9db2ce]">
            <div className="flex h-full min-w-0 flex-1 items-center px-2">Amount Buy</div>
            <div className="flex h-full min-w-0 flex-1 items-center justify-end px-2">P.Buy</div>
            <div className="flex h-full min-w-0 flex-1 items-center px-2">P.Sell</div>
            <div className="flex h-full min-w-0 flex-1 items-center justify-end px-2">Amount Sell</div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-1">
            {levels.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#9db2ce]">{emptyMessage}</p>
            ) : (
              levels.map(({ bid, ask }, i) => (
                <div key={i} className="flex h-7 w-full shrink-0 items-center px-2 text-xs leading-5">
                  <div className="flex h-full min-w-0 flex-1 items-center px-2 text-white">{bid?.qty ?? ""}</div>
                  {/* Depth bar grows inward from the spread, proportional to size. The anchored end
                      (where the two sides meet) stays square; the growing end is rounded. Figma has
                      both ends square — rounding is a deliberate refinement, keep it. */}
                  <div className="relative flex h-full min-w-0 flex-1 items-center justify-end px-2">
                    {bid && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 right-0 rounded-l-[4px] bg-[rgba(103,225,193,0.2)]"
                        style={{ width: `${(bid.qty / maxAmount) * 100}%` }}
                      />
                    )}
                    <span className="relative text-[#67e1c1]">{bid ? ladderNum.format(bid.price) : ""}</span>
                  </div>
                  <div className="relative flex h-full min-w-0 flex-1 items-center px-2">
                    {ask && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[rgba(229,17,82,0.2)]"
                        style={{ width: `${(ask.qty / maxAmount) * 100}%` }}
                      />
                    )}
                    <span className="relative text-[#67e1c1]">{ask ? ladderNum.format(ask.price) : ""}</span>
                  </div>
                  <div className="flex h-full min-w-0 flex-1 items-center justify-end px-2 text-white">
                    {ask?.qty ?? ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
