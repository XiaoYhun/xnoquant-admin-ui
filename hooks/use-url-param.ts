"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Read/write one URL search param, so a selection survives a reload and the address bar is a
 * shareable deep link to it. Used by every run-detail side panel (`?run=<id>`).
 *
 * `replace`, not `push`: a table where every row click pushed history would need one Back press
 * per row just to leave the page. The cost is that Back no longer closes the panel — the X and
 * Escape still do.
 *
 * Other params are preserved. Live trade and Alpha pool already carry `?market=`, and clobbering
 * it would drop the reader onto the wrong tab.
 */
export function useUrlParam(key: string): [string | null, (value: string | null) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(key);

  const setValue = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set(key, next);
      else params.delete(key);
      const qs = params.toString();
      // `scroll: false` — selecting a row shouldn't jump a long table back to the top.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [key, pathname, router, searchParams],
  );

  return [value, setValue];
}
