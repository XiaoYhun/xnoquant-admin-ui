"use client";
import { useEffect, useState } from "react";

// Trails a fast-changing value (a search box) so it can drive a server query without firing a
// request per keystroke.
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
