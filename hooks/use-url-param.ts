"use client";
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Read/write one URL search param, so a selection survives a reload and the address bar is a
 * shareable deep link to it. Used by every run-detail side panel (`?run=<id>`).
 *
 * The selection is LOCAL state mirrored into the URL with `history.replaceState` (Next's
 * documented shallow-routing escape hatch), NOT `router.replace`. `?run=` is pure client-side UI
 * state — the RSC payload for the page is byte-identical with and without it — so a router
 * transition buys nothing and costs correctness: on a RUNNING run the detail panel re-renders on
 * every `/live/stream` frame, and in a production build those renders kept the transition from
 * landing. Next then restored its stale canonical URL over ours (the panel's X did nothing) or
 * escalated the navigation to a full page reload. A direct history write can't be interrupted.
 *
 * `replaceState`, not `pushState`: a table where every row click pushed history would need one
 * Back press per row just to leave the page. The cost is that Back no longer closes the panel —
 * the X and Escape still do.
 *
 * Other params are preserved. Live trade and Alpha pool already carry `?market=`, and clobbering
 * it would drop the reader onto the wrong tab.
 */
export function useUrlParam(key: string): [string | null, (value: string | null) => void] {
  // `useSearchParams` supplies the INITIAL value only. It is also what makes Next render this
  // Suspense boundary on the client, so a deep-linked `?run=` is already there on first render.
  const searchParams = useSearchParams();
  const [value, setValue] = useState<string | null>(() => searchParams.get(key));

  const setParam = useCallback(
    (next: string | null) => {
      setValue(next);
      const { pathname, search } = window.location;
      const params = new URLSearchParams(search);
      if (next) params.set(key, next);
      else params.delete(key);
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [key],
  );

  return [value, setParam];
}
