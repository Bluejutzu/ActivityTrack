import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireViewer, requireManager } from "./rbac";
import { writeAudit } from "./audit";
import { appError } from "./errors";

/** All people (coworkers being tracked). Readable by any signed-in viewer+. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    // Defensive cap (see devices.list): bounds the query as the roster grows.
    return await ctx.db.query("people").take(2000);
  },
});

/**
 * Normalize a free-text id field: trim, and treat empty string as "clear it"
 * (undefined) so the dashboard can blank a mapping by submitting "".
 */
function normalizeId(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Add a coworker. Manager+ (the boss manages people). */
export const create = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    employeeId: v.optional(v.string()),
    genesysUserId: v.optional(v.string()),
    clockodoUserId: v.optional(v.string()),
  },
  handler: async (ctx, { name, email, employeeId, genesysUserId, clockodoUserId }) => {
    const actor = await requireManager(ctx);
    const id = await ctx.db.insert("people", {
      name,
      email,
      active: true,
      employeeId: normalizeId(employeeId),
      genesysUserId: normalizeId(genesysUserId),
      clockodoUserId: normalizeId(clockodoUserId),
    });
    await writeAudit(ctx, actor._id, "person.create", name);
    return id;
  },
});

/** Edit a coworker's details / active flag / integration mappings. Manager+. */
export const update = mutation({
  args: {
    personId: v.id("people"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    active: v.optional(v.boolean()),
    employeeId: v.optional(v.string()),
    genesysUserId: v.optional(v.string()),
    clockodoUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { personId, name, email, active, employeeId, genesysUserId, clockodoUserId } =
      args;
    const actor = await requireManager(ctx);
    const person = await ctx.db.get(personId);
    if (!person) throw appError("notFound.person", "Person not found");
    await ctx.db.patch(personId, {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(employeeId !== undefined ? { employeeId: normalizeId(employeeId) } : {}),
      ...(genesysUserId !== undefined
        ? { genesysUserId: normalizeId(genesysUserId) }
        : {}),
      ...(clockodoUserId !== undefined
        ? { clockodoUserId: normalizeId(clockodoUserId) }
        : {}),
    });
    await writeAudit(ctx, actor._id, "person.update", person.name);
  },
});

/** Remove a coworker and unlink any devices pointing at them. Manager+. */
export const remove = mutation({
  args: { personId: v.id("people") },
  handler: async (ctx, { personId }) => {
    const actor = await requireManager(ctx);
    const person = await ctx.db.get(personId);
    if (!person) throw appError("notFound.person", "Person not found");

    // Unlink devices first so we don't leave dangling personId references.
    const linked = await ctx.db
      .query("devices")
      .withIndex("by_personId", (q) => q.eq("personId", personId))
      .collect();
    for (const d of linked) {
      await ctx.db.patch(d._id, { personId: undefined });
    }

    await ctx.db.delete(personId);
    await writeAudit(ctx, actor._id, "person.remove", person.name);
  },
});
