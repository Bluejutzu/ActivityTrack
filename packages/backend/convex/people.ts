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
    return await ctx.db.query("people").collect();
  },
});

/** Add a coworker. Manager+ (the boss manages people). */
export const create = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { name, email }) => {
    const actor = await requireManager(ctx);
    const id = await ctx.db.insert("people", { name, email, active: true });
    await writeAudit(ctx, actor._id, "person.create", name);
    return id;
  },
});

/** Edit a coworker's details / active flag. Manager+. */
export const update = mutation({
  args: {
    personId: v.id("people"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { personId, name, email, active }) => {
    const actor = await requireManager(ctx);
    const person = await ctx.db.get(personId);
    if (!person) throw appError("notFound.person", "Person not found");
    await ctx.db.patch(personId, {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(active !== undefined ? { active } : {}),
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
