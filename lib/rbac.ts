// Client-side mirror of the backend RBAC reduction (crates/api/src/rbac.rs).
// The HFT API maps a user's `roles` to exactly one ResourceScope; when roles span
// multiple tiers the highest-ranked wins (all > lab > own > none). We re-implement
// that reduction here so the UI can gate role-aware affordances without a round-trip.
//
// SECOND SOURCE OF TRUTH: these arrays must stay in sync with rbac.rs. If the backend
// adds a derived `scope` field to GET /api/auth/me, prefer that and delete this reduction.

export type ResourceScope = "all" | "lab" | "own" | "none";

// Priority order — highest tier first; first match wins.
export const ALL_ACCESS_ROLES: readonly string[] = ["admin"];
export const LAB_ACCESS_ROLES: readonly string[] = ["researcher", "research-lead", "student", "intern"];
export const OWN_ACCESS_ROLES: readonly string[] = ["pm", "trader"];

/** Reduce the caller's raw roles to a single scope. Empty/unmapped roles → "none". */
export function resourceScope(roles: readonly string[] | undefined): ResourceScope {
  const r = roles ?? [];
  if (r.some((role) => ALL_ACCESS_ROLES.includes(role))) return "all";
  if (r.some((role) => LAB_ACCESS_ROLES.includes(role))) return "lab";
  if (r.some((role) => OWN_ACCESS_ROLES.includes(role))) return "own";
  return "none";
}

/** Owner-or-admin write access. Admin (all-access) mutates anything; Lab never grants write. */
export function isAdminScope(scope: ResourceScope): boolean {
  return scope === "all";
}

// ---- Ownership: a resource's owner_id (HFT Run/Strategy) vs the caller's user_id ----

/** True only when the resource carries an owner_id that matches the current user. */
export function isOwner(resource: { owner_id?: string } | undefined, userId: string | undefined): boolean {
  return !!resource?.owner_id && !!userId && resource.owner_id === userId;
}

/**
 * Can the caller mutate (edit/delete/stop) this resource? Owner-or-admin only —
 * a Lab-scoped user can *see* a lab-mate's resource but every write still 404s,
 * so mutation controls must be hidden for anything they don't own.
 */
export function canMutate(
  resource: { owner_id?: string } | undefined,
  caller: { userId: string | undefined; isAdmin: boolean },
): boolean {
  return caller.isAdmin || isOwner(resource, caller.userId);
}

/**
 * True when the resource is visible to the caller but owned by someone else — a lab-mate's
 * share (Lab scope) or the admin cross-user view. Used to render a read-only "Shared" chip.
 */
export function isShared(resource: { owner_id?: string } | undefined, userId: string | undefined): boolean {
  return !!resource?.owner_id && !!userId && resource.owner_id !== userId;
}
