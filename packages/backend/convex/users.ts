import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { currentUser, requireAdmin, userBySubject } from "./rbac";
import { writeAudit } from "./audit";
import { appError } from "./errors";
import {
  assertEmailAllowedForOrg,
  clerkOrgIdFromIdentity,
  ensureOrganization,
} from "./orgs";

/**
 * Upsert the local user row for the signed-in Clerk account. Called once by the
 * dashboard after authentication so a `users` row (and a role) exists for RBAC.
 *
 * Role bootstrapping: the very first account becomes `it_admin` so the
 * deployment is usable out of the box; everyone after defaults to `viewer` and
 * must be promoted by an admin. Profile fields are refreshed from the JWT on
 * every call; the role is only ever set here on creation (never downgraded).
 */
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError("auth.required", "Not authenticated");

    const email = identity.email ?? undefined;
    const name = identity.name ?? identity.nickname ?? undefined;
    const image = (identity.pictureUrl as string | undefined) ?? undefined;
    const clerkOrgId = clerkOrgIdFromIdentity(
      identity as unknown as { orgId?: unknown; organization_id?: unknown },
    );
    const orgId = clerkOrgId
      ? await ensureOrganization(ctx, {
          clerkOrgId,
          name: (identity as { orgName?: string }).orgName,
          email,
        })
      : undefined;
    if (orgId) await assertEmailAllowedForOrg(ctx, orgId, email);

    const existing = await userBySubject(ctx, identity.subject);
    if (existing) {
      // Keep profile fields fresh; leave the role untouched.
      await ctx.db.patch(existing._id, {
        email,
        name,
        image,
        orgId,
        clerkOrgId: clerkOrgId ?? undefined,
      });
      return existing._id;
    }

    // First account in the deployment becomes it_admin; the rest are viewers.
    const anyUser = orgId
      ? await ctx.db
          .query("users")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .first()
      : await ctx.db.query("users").first();
    const role = anyUser ? "viewer" : "it_admin";

    return await ctx.db.insert("users", {
      subject: identity.subject,
      orgId,
      clerkOrgId: clerkOrgId ?? undefined,
      email,
      name,
      image,
      role,
    });
  },
});

/** The signed-in user (role + identity) for the dashboard shell. Null if out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role ?? "viewer",
      orgId: user.orgId,
      clerkOrgId: user.clerkOrgId,
    };
  },
});

/** All dashboard accounts. IT-only. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireAdmin(ctx);
    const users = actor.orgId
      ? await ctx.db
          .query("users")
          .withIndex("by_org", (q) => q.eq("orgId", actor.orgId))
          .collect()
      : await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      email: u.email,
      name: u.name,
      role: u.role ?? "viewer",
    }));
  },
});

/** Set a user's role. IT-only. Cannot demote yourself out of it_admin (so a
 *  deployment can't be left with zero admins by accident). */
export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("it_admin"),
      v.literal("manager"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, { userId, role }) => {
    const actor = await requireAdmin(ctx);
    if (userId === actor._id && role !== "it_admin") {
      throw appError(
        "user.cannot_demote_self",
        "You cannot remove your own it_admin role",
      );
    }
    const target = await ctx.db.get(userId);
    if (!target) throw appError("notFound.user", "User not found");
    if (actor.orgId && target.orgId !== actor.orgId)
      throw appError("auth.forbidden", "Forbidden");
    await ctx.db.patch(userId, { role });
    await writeAudit(
      ctx,
      actor._id,
      "user.setRole",
      `${target.email ?? userId} -> ${role}`,
    );
  },
});
