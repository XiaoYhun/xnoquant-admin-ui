"use client";
// OWNED BY: Create Strategy "Samples tab" agent — Figma node 13964:55798.
// Search + All Categories dropdown + collapsible category sections + sample cards
// (selected card = green border + "</> View source" + "Use template" buttons).
import { useState } from "react";
import { AltArrowDown, CheckCircle, Code, Database, MinimalisticMagnifer } from "@solar-icons/react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Self-contained mock data — richer than the shared `SAMPLES` in lib/mock/strategy-builder.
type Sample = { id: string; name: string; description: string };
type SampleCategory = { id: string; name: string; badgeColor: string; samples: Sample[] };

const CATEGORIES: SampleCategory[] = [
  {
    id: "trend-momentum",
    name: "Trend Confirmation / Momentum",
    badgeColor: "#f1c617",
    samples: [
      {
        id: "macd-adx-trend-confirmation",
        name: "MACD-ADX Trend Confirmation",
        description:
          "A trend-following strategy that combines MACD crossovers with ADX strength filtering. The strategy enters a long position when MACD crosses above its signal line while ADX indicates a strong trend, and exits when momentum weakens or trend strength drops, helping to avoid trades during low-trend or choppy market conditions.",
      },
      {
        id: "bollinger-bands-squeeze",
        name: "Bollinger Bands Squeeze",
        description:
          "This strategy focuses on periods of low volatility, identified by a Bollinger Bands squeeze. Traders look for price breakouts once the bands narrow, entering positions in the direction of the breakout with the expectation of a significant price movement.",
      },
      {
        id: "rsi-divergence",
        name: "RSI Divergence",
        description:
          "This strategy utilizes the Relative Strength Index (RSI) to identify potential reversals. By spotting divergences between price action and RSI readings, traders can anticipate trend changes.",
      },
      {
        id: "fibonacci-retracement-levels",
        name: "Fibonacci Retracement Levels",
        description:
          "Traders use Fibonacci retracement levels to identify potential reversal points during market pullbacks, entering positions when the price approaches key retracement levels.",
      },
    ],
  },
  {
    id: "technical-indicators",
    name: "Technical Indicators",
    badgeColor: "#d5d4ff",
    samples: [
      {
        id: "bollinger-bands-breakout-strategy",
        name: "Bollinger Bands Breakout Strategy",
        description:
          "Traders monitor the contraction and expansion of Bollinger Bands to identify potential breakout opportunities, entering positions while placing stop-loss orders to manage risk.",
      },
      {
        id: "stochastic-oscillator-divergence",
        name: "Stochastic Oscillator Divergence",
        description:
          "Divergence between the Stochastic Oscillator and price action can indicate potential reversals, giving traders entry points in the opposite direction with stop-loss orders to limit losses.",
      },
      {
        id: "rsi-overbought-oversold-conditions",
        name: "RSI Overbought/Oversold Conditions",
        description:
          "Traders utilize the RSI to identify overbought or oversold conditions in the market, looking for reversal signals at these extremes with stop-loss orders to protect their trades.",
      },
      {
        id: "volume-profile-analysis",
        name: "Volume Profile Analysis",
        description:
          "Analyzing volume profiles helps traders identify key support and resistance levels based on traded volume at different price levels, with stop-loss orders set to minimize risk.",
      },
    ],
  },
  {
    id: "volatility-breakout",
    name: "Volatility / Breakout",
    badgeColor: "#a7f3d0",
    samples: [
      {
        id: "support-and-resistance-breakouts",
        name: "Support and Resistance Breakouts",
        description:
          "Traders watch for price to break through established support and resistance levels, entering trades upon breakout confirmation with stop-loss orders to manage potential losses.",
      },
      {
        id: "ichimoku-cloud-trading",
        name: "Ichimoku Cloud Trading",
        description:
          "The Ichimoku Cloud provides a comprehensive view of market trends, support, and resistance levels, entering positions when price interacts with the cloud and using stop-loss orders to control risk.",
      },
      {
        id: "atr-volatility-breakout",
        name: "ATR Volatility Breakout",
        description:
          "This strategy uses the Average True Range (ATR) to size breakout thresholds relative to recent volatility, entering trades once price moves beyond an ATR-scaled band from its recent range.",
      },
    ],
  },
];

const ALL_CATEGORIES = "all";

export function SamplesTab() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(CATEGORIES.map((c) => c.id)));
  const [selectedId, setSelectedId] = useState<string>(CATEGORIES[0].samples[0].id);

  const query = search.trim().toLowerCase();
  const filtered = CATEGORIES.filter((c) => category === ALL_CATEGORIES || c.id === category)
    .map((c) => ({
      ...c,
      samples: c.samples.filter(
        (s) => !query || s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query),
      ),
    }))
    .filter((c) => c.samples.length > 0);

  function toggleSection(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <MinimalisticMagnifer
            weight="Outline"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category..."
            className="h-9 rounded-full border-border bg-transparent pl-9 text-xs placeholder:text-muted-foreground"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 shrink-0 rounded-full border-border bg-transparent px-3 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No samples found.</p>}

      {filtered.map((c) => {
        const isOpen = expanded.has(c.id);
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => toggleSection(c.id)}
              className="flex w-full cursor-pointer items-center justify-between py-1 text-left"
            >
              <span className="text-sm font-medium text-[#ccdff1]">{c.name}</span>
              <AltArrowDown
                weight="Outline"
                className={cn("size-4 text-muted-foreground transition-transform", !isOpen && "-rotate-90")}
              />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-2">
                {c.samples.map((s) => {
                  const isSelected = s.id === selectedId;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "rounded-xl border px-3 py-2 transition-colors",
                        isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        className="flex w-full cursor-pointer items-start gap-3 text-left"
                      >
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: c.badgeColor }}
                        >
                          <Database weight="Outline" className="size-4 text-black/70" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-sm font-medium",
                              isSelected
                                ? "bg-gradient-to-b from-[#cff8ea] to-primary bg-clip-text text-transparent"
                                : "text-white",
                            )}
                          >
                            {s.name}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block text-xs text-muted-foreground",
                              !isSelected && "truncate",
                            )}
                          >
                            {s.description}
                          </span>
                        </span>
                      </button>
                      {isSelected && (
                        <div className="flex justify-end gap-2 pt-3">
                          <button
                            type="button"
                            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-border bg-black px-3 text-xs text-white"
                          >
                            <Code weight="Bold" className="size-4" />
                            View source
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs text-black"
                          >
                            <CheckCircle weight="Outline" className="size-4" />
                            Use template
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
