import type { TradeHistoryRow } from "@/lib/mock/paper-runs";

const CSV_COLUMNS = ["Time", "Symbol", "Side", "Price", "Qty", "Mid", "Outcome"] as const;

export function tradeHistoryToCsv(rows: TradeHistoryRow[]): string {
  // Quote only when a field could break the row; doubling embedded quotes per RFC 4180.
  const cell = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) => [r.time, r.symbol, r.side, r.price, r.qty, r.mid, r.outcome].map(cell).join(","));
  return [CSV_COLUMNS.join(","), ...body].join("\n");
}

export function downloadTradeHistoryCsv(filename: string, rows: TradeHistoryRow[]): void {
  if (rows.length === 0) return;
  // Excel reads a bare UTF-8 CSV as the local codepage; the BOM makes it pick UTF-8.
  const blob = new Blob(["\uFEFF", tradeHistoryToCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
