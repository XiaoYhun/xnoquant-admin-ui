"use client";
import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

// The viewer's offset east of UTC in minutes (GMT+7 → 420), for charts bucketed by hour of day.
// The server cannot know the browser's zone, so it renders `0` (UTC) and hydration corrects it.
// DST is read as of now; a run spanning a switch is still drawn at one offset.
export function useUtcOffsetMinutes(): number {
  return useSyncExternalStore(
    noSubscribe,
    () => -new Date().getTimezoneOffset(),
    () => 0,
  );
}
