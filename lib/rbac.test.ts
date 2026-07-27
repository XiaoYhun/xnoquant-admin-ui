import { describe, it, expect } from "vitest";
import { resourceScope, isOwner, canMutate, isShared } from "./rbac";

describe("resourceScope", () => {
  it("maps admin to all", () => {
    expect(resourceScope(["admin"])).toBe("all");
  });

  it("takes the highest tier when roles span several (lab beats own)", () => {
    expect(resourceScope(["trader", "researcher"])).toBe("lab");
  });

  it("admin outranks lab", () => {
    // The current dev user's actual role set.
    expect(resourceScope(["default", "contributor", "researcher", "research-lead", "admin"])).toBe("all");
  });

  it.each([
    [["researcher"], "lab"],
    [["research-lead"], "lab"],
    [["student"], "lab"],
    [["intern"], "lab"],
    [["pm"], "own"],
    [["trader"], "own"],
  ] as const)("maps %j to %s", (roles, scope) => {
    expect(resourceScope(roles)).toBe(scope);
  });

  it.each([[[]], [["tester"]], [["default"]], [["contributor"]], [undefined]] as const)(
    "maps unmapped/empty %j to none",
    (roles) => {
      expect(resourceScope(roles)).toBe("none");
    },
  );
});

describe("isOwner", () => {
  it("is true only when owner_id matches the user id", () => {
    expect(isOwner({ owner_id: "u1" }, "u1")).toBe(true);
    expect(isOwner({ owner_id: "u1" }, "u2")).toBe(false);
  });

  it("is false when owner_id or user id is missing", () => {
    expect(isOwner({ owner_id: undefined }, "u1")).toBe(false);
    expect(isOwner(undefined, "u1")).toBe(false);
    expect(isOwner({ owner_id: "u1" }, undefined)).toBe(false);
  });
});

describe("canMutate", () => {
  it("admin can mutate anyone's resource", () => {
    expect(canMutate({ owner_id: "other" }, { userId: "me", isAdmin: true })).toBe(true);
  });

  it("owner can mutate their own", () => {
    expect(canMutate({ owner_id: "me" }, { userId: "me", isAdmin: false })).toBe(true);
  });

  it("a non-admin cannot mutate a resource they don't own (e.g. a lab-mate's)", () => {
    expect(canMutate({ owner_id: "other" }, { userId: "me", isAdmin: false })).toBe(false);
  });
});

describe("isShared", () => {
  it("is false for the caller's own resource", () => {
    expect(isShared({ owner_id: "me" }, "me")).toBe(false);
  });

  it("is true when owned by someone else (e.g. a lab-mate's)", () => {
    expect(isShared({ owner_id: "other" }, "me")).toBe(true);
  });

  it("is false when owner_id or user id is missing", () => {
    expect(isShared({ owner_id: undefined }, "me")).toBe(false);
    expect(isShared(undefined, "me")).toBe(false);
    expect(isShared({ owner_id: "other" }, undefined)).toBe(false);
  });
});
