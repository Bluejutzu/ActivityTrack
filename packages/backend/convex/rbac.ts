import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { appError } from "./errors";

/**
 * Server-side RBAC. Roles are NEVER trusted from the client — every privileged
 * query/mutation resolves the caller's user row here and checks its `role`.
 *
 * Hierarchy: it_admin > manager > viewer (higher rank ⊃ lower capabilities).
 */
export type Role = "it_admin" | "manager" | "viewer";

const RANK: Record<Role, number> = {
  viewer: 0,
  manager: 1,
  it_admin: 2,
};

/** The signed-in user's row, or null if not authenticated / not provisioned. */
export async function currentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db.get(userId);
}

/** Throw unless someone is signed in; returns their user row. */
export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) throw appError("auth.required", "Not authenticated");
  return user;
}

function rankOf(user: Doc<"users">): number {
  return RANK[(user.role ?? "viewer") as Role];
}

/** Throw unless the caller's role is at least `min`. Returns their user row. */
export async function requireRole(
  ctx: QueryCtx,
  min: Role,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (rankOf(user) < RANK[min]) {
    throw appError("auth.forbidden", `Forbidden: requires ${min} role`);
  }
  return user;
}

export const requireViewer = (ctx: QueryCtx) => requireRole(ctx, "viewer");
export const requireManager = (ctx: QueryCtx) => requireRole(ctx, "manager");
export const requireAdmin = (ctx: QueryCtx) => requireRole(ctx, "it_admin");

export function hasRole(user: Doc<"users"> | null, min: Role): boolean {
  return !!user && rankOf(user) >= RANK[min];
}

export type { Id, Doc };
