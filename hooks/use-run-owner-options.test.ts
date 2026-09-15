import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRunOwnerOptions } from "./use-run-owner-options";
import type { UserRosterEntry } from "./api/use-users";
import type { PaperRunRow } from "@/lib/mock/paper-runs";

const user = (over: Partial<UserRosterEntry> = {}): UserRosterEntry =>
  ({ user_id: "u1", username: "Alice", email: "alice@example.com", roles: ["trader"], ...over }) as UserRosterEntry;

const row = (over: Partial<PaperRunRow> = {}): PaperRunRow =>
  ({ id: "r1", owner_id: "u1", owner: "Alice", ownerEmail: "alice@example.com", ...over }) as PaperRunRow;

describe("useRunOwnerOptions", () => {
  it("builds options from the roster when it has entries, sorted by name", () => {
    const roster = [user({ user_id: "u2", username: "Bob", email: "bob@example.com" }), user()];
    const { result } = renderHook(() => useRunOwnerOptions(roster, [], ""));
    expect(result.current).toEqual([
      { id: "u1", name: "Alice", email: "alice@example.com" },
      { id: "u2", name: "Bob", email: "bob@example.com" },
    ]);
  });

  it("falls back to email when a roster entry has no username", () => {
    const roster = [user({ username: null })];
    const { result } = renderHook(() => useRunOwnerOptions(roster, [], ""));
    expect(result.current).toEqual([{ id: "u1", name: "alice@example.com", email: "alice@example.com" }]);
  });

  it("drops a roster entry with neither username nor email", () => {
    const roster = [user({ username: null, email: null })];
    const { result } = renderHook(() => useRunOwnerOptions(roster, [], ""));
    expect(result.current).toEqual([]);
  });

  it("falls back to the loaded rows' owners when the roster is empty (non-admin)", () => {
    const rows = [row(), row({ id: "r2", owner_id: "u2", owner: "Bob", ownerEmail: null })];
    const { result } = renderHook(() => useRunOwnerOptions([], rows, ""));
    expect(result.current).toEqual([
      { id: "u1", name: "Alice", email: "alice@example.com" },
      { id: "u2", name: "Bob", email: undefined },
    ]);
  });

  it("dedupes rows sharing the same owner", () => {
    const rows = [row(), row({ id: "r2" })];
    const { result } = renderHook(() => useRunOwnerOptions([], rows, ""));
    expect(result.current).toHaveLength(1);
  });

  it("keeps the selected owner in the list even after their rows scroll off the page", () => {
    const page1 = [row()];
    const { result, rerender } = renderHook(
      ({ rows, selected }) => useRunOwnerOptions([], rows, selected),
      { initialProps: { rows: page1, selected: "u1" } },
    );
    expect(result.current).toEqual([{ id: "u1", name: "Alice", email: "alice@example.com" }]);

    // Page 2: no rows for u1 anymore (e.g. combined with another filter) — the selection is
    // remembered from the render where it was still visible.
    rerender({ rows: [row({ id: "r2", owner_id: "u3", owner: "Carol", ownerEmail: null })], selected: "u1" });
    expect(result.current).toContainEqual({ id: "u1", name: "Alice", email: "alice@example.com" });
  });

  it("falls back to a truncated id for a selected owner never seen in roster or rows", () => {
    const { result } = renderHook(() => useRunOwnerOptions([], [], "0123456789ab"));
    expect(result.current).toEqual([{ id: "0123456789ab", name: "01234567…" }]);
  });
});
