import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { requireAdmin } from "./rbac";
import { writeAudit } from "./audit";
import { hashPassword } from "./crypto";

const DEBUG_PASSWORD_KEY = "debugToolPasswordHash";

/** Read a setting row (internal — used by the verify HTTP endpoint). */
export const getByKey = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
  },
});

/** Whether the tray-app debug password has been configured. IT-only. */
export const debugPasswordIsSet = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", DEBUG_PASSWORD_KEY))
      .unique();
    return !!row;
  },
});

/** Internal: persist a hashed setting + audit. Called from the action below. */
export const store = internalMutation({
  args: {
    actorUserId: v.id("users"),
    key: v.string(),
    value: v.string(),
    auditLabel: v.string(),
  },
  handler: async (ctx, { actorUserId, key, value, auditLabel }) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("settings", { key, value, updatedAt: Date.now() });
    }
    await writeAudit(ctx, actorUserId, "settings.update", auditLabel);
  },
});

/**
 * Set the tray-app debug login password. Runs as an action so it can use Web
 * Crypto to hash; RBAC is enforced by resolving the caller via api.users.me.
 */
export const setDebugPassword = action({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    const me = await ctx.runQuery(api.users.me, {});
    if (!me || me.role !== "it_admin") {
      throw new Error("Forbidden: requires it_admin role");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    const hash = await hashPassword(password);
    await ctx.runMutation(internal.settings.store, {
      actorUserId: me._id,
      key: DEBUG_PASSWORD_KEY,
      value: hash,
      auditLabel: "debug tool password",
    });
  },
});

export const DEBUG_PASSWORD_SETTING_KEY = DEBUG_PASSWORD_KEY;
