"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Flashes its background green (value went up) or red (value went down) for a beat, then
// fades back to transparent — like a live trading terminal. Bumping `key` on each change
// restarts the CSS animation from the start.
export function FlashValue({ value, children }: { value: number; children: ReactNode }) {
  const prev = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (value > prev.current) setDir("up");
    else if (value < prev.current) setDir("down");
    else return;
    prev.current = value;
    setTick((t) => t + 1);
  }, [value]);

  return (
    <span
      key={tick}
      className="inline-block rounded-[4px] px-1"
      style={dir ? { animation: `value-flash-${dir} 450ms ease-out` } : undefined}
    >
      {children}
    </span>
  );
}
