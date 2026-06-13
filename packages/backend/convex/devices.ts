import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireViewer, requireManager, requireAdmin } from "./rbac";
import { writeAudit } from "./audit";

/** All devices with their linked person's name (if any). Viewer+. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    const devices = await ctx.db.query("devices").collect();
    return Promise.all(
      devices.map(async (d) => {
        const person = d.personId ? await ctx.db.get(d.personId) : null;
        return { ...d, personName: person?.name ?? null };
      }),
    );
  },
});

/** Devices awaiting approval (the registration queue). Viewer+ can see them. */
export const listPending = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    return await ctx.db
      .query("devices")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

/** Approve a pending device so its data counts toward the dashboard. IT-only. */
export const approve = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const actor = await requireAdmin(ctx);
    const device = await ctx.db.get(deviceId);
    if (!device) throw new Error("Device not found");
    await ctx.db.patch(deviceId, { status: "active" });
    await writeAudit(ctx, actor._id, "device.approve", device.hostname);
  },
});

/** Disable a device — ingest will drop its samples going forward. IT-only. */
export const disable = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const actor = await requireAdmin(ctx);
    const device = await ctx.db.get(deviceId);
    if (!device) throw new Error("Device not found");
    await ctx.db.patch(deviceId, { status: "disabled" });
    await writeAudit(ctx, actor._id, "device.disable", device.hostname);
  },
});

/** Link a device to a coworker (or pass null to unlink). Manager+. */
export const link = mutation({
  args: {
    deviceId: v.id("devices"),
    personId: v.union(v.id("people"), v.null()),
  },
  handler: async (ctx, { deviceId, personId }) => {
    const actor = await requireManager(ctx);
    const device = await ctx.db.get(deviceId);
    if (!device) throw new Error("Device not found");
    if (personId) {
      const person = await ctx.db.get(personId);
      if (!person) throw new Error("Person not found");
    }
    await ctx.db.patch(deviceId, { personId: personId ?? undefined });
    await writeAudit(
      ctx,
      actor._id,
      "device.link",
      `${device.hostname} -> ${personId ?? "none"}`,
    );
  },
});
