"use client";

import { useSyncExternalStore } from "react";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

const STORAGE_KEY = "xnq.pageSize";

let listeners: (() => void)[] = [];

function subscribe(onChange: () => void) {
  listeners.push(onChange);
  return () => {
    listeners = listeners.filter((l) => l !== onChange);
  };
}

function getSnapshot() {
  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  return PAGE_SIZE_OPTIONS.includes(stored) ? stored : DEFAULT_PAGE_SIZE;
}

/**
 * Rows per page for the list tables — one setting shared by every list, held in localStorage.
 * The server (and so the first client render) always sees the default; the stored value takes
 * over on hydration.
 */
export function usePageSize(): [number, (size: number) => void] {
  const pageSize = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PAGE_SIZE);

  return [
    pageSize,
    (size: number) => {
      window.localStorage.setItem(STORAGE_KEY, String(size));
      for (const l of listeners) l();
    },
  ];
}
