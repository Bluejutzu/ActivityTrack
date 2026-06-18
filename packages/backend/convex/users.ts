import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { currentUser, requireAdmin, userBySubject, type Role } from "./rbac";
import { writeAudit } from "./audit";
import { appError } from "./errors";
import { adminEmails, isEmailAllowed, readAllowedDomains } from "./access";

/**
 * Upsert the local user row for the signed-in Clerk account. Called on every
 * dashboard mount (via `useStoreUser`), which makes it the single server-side
 * access gate — a `users` row only exists if the account is permitted, and RBAC
 * requires that row, so this can't be bypassed.
 *
 * Access rule (see access.ts):
 *   - Admins (ACTIVITYTRACK_ADMIN_EMAILS) are always it_admin and always allowed.
 *   - Everyone else is allowed only if their email domain is on the editable
 *     allowlist; they default to viewer (an existing `manager` promotion is kept).
 *   - Bootstrap: if no admins are configured AND no users exist yet, the first
 *     sign-in becomes it_admin so a fresh deploy is never left admin-less.
 *   - Anyone not allowed has any stale row deleted and is rejected.
 */
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError("auth.required", "Not authenticated");

    const email = identity.email ?? undefined;
    const name = identity.name ?? identity.nickname ?? undefined;
    const image = (identity.pictureUrl as string | undefined) ?? undefined;

    const existing = await userBySubject(ctx, identity.subject);

    const admins = adminEmails();
    const domains = await readAllowedDomains(ctx);
    const { allowed, isAdmin } = isEmailAllowed(email, admins, domains);

    // Bootstrap safety net: no admins configured and no users yet → first
    // account in as it_admin. Stops applying once an admin email is set.
    const firstEver = (await ctx.db.query("users").first()) === null;
    const bootstrap = admins.length === 0 && firstEver;

    if (!allowed && !bootstrap) {
      // Revoke any stale row so RBAC denies them going forward.
      if (existing) await ctx.db.delete(existing._id);
      throw appError(
        "auth.not_allowed",
        "Your account is not permitted to access this dashboard",
      );
    }

    // Env admins (or the bootstrap account) are it_admin; otherwise preserve a
    // manually-assigned manager role, defaulting to viewer.
    const role: Role =
      isAdmin || bootstrap
        ? "it_admin"
        : existing?.role === "manager"
          ? "manager"
          : "viewer";

    if (existing) {
      await ctx.db.patch(existing._id, { email, name, image, role });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      subject: identity.subject,
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
    };
  },
});

/** All dashboard accounts. IT-only. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
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
    await ctx.db.patch(userId, { role });
    await writeAudit(
      ctx,
      actor._id,
      "user.setRole",
      `${target.email ?? userId} -> ${role}`,
    );
  },
});
