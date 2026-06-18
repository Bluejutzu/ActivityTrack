import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { requireViewer, requireManager, requireAdmin } from "./rbac";
import { writeAudit } from "./audit";
import { appError } from "./errors";

function generateSlotCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "AT-";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** All devices with their linked person's name (if any). Viewer+. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    const devices = await ctx.db.query("devices").collect();

    // Batch-load the linked people once instead of one get() per device.
    const personIds = [
      ...new Set(devices.flatMap((d) => (d.personId ? [d.personId] : []))),
    ];
    const peopleById = new Map(
      (await Promise.all(personIds.map((id) => ctx.db.get(id)))).flatMap((p) =>
        p ? [[p._id, p] as const] : [],
      ),
    );

    return devices.map((d) => ({
      ...d,
      personName: d.personId
        ? (peopleById.get(d.personId)?.name ?? null)
        : null,
    }));
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
    if (!device) throw appError("notFound.device", "Device not found");
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
    if (!device) throw appError("notFound.device", "Device not found");
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
    if (!device) throw appError("notFound.device", "Device not found");
    if (personId) {
      const person = await ctx.db.get(personId);
      if (!person) throw appError("notFound.person", "Person not found");
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

/** Create a one-time enrollment code. IT admin only. */
export const createDeviceSlot = mutation({
  args: {
    label: v.optional(v.string()),
    expiresInHours: v.number(),
  },
  handler: async (ctx, { label, expiresInHours }) => {
    const actor = await requireAdmin(ctx);
    const code = generateSlotCode();
    const now = Date.now();
    await ctx.db.insert("deviceSlots", {
      code,
      label,
      createdBy: actor._id,
      createdAt: now,
      expiresAt: now + expiresInHours * 60 * 60 * 1000,
    });
    await writeAudit(ctx, actor._id, "deviceSlot.create", label ?? code);
    return code;
  },
});

/** List recent enrollment slots. IT admin only. */
export const listSlots = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("deviceSlots")
      .withIndex("by_createdAt")
      .order("desc")
      .take(50);
  },
});

/** Revoke an active slot so it can no longer be used. IT admin only. */
export const revokeSlot = mutation({
  args: { slotId: v.id("deviceSlots") },
  handler: async (ctx, { slotId }) => {
    const actor = await requireAdmin(ctx);
    const slot = await ctx.db.get(slotId);
    if (!slot) throw appError("notFound.slot", "Slot not found");
    await ctx.db.patch(slotId, {
      usedAt: Date.now(),
      usedByDeviceId: "__revoked__",
    });
    await writeAudit(ctx, actor._id, "deviceSlot.revoke", slot.code);
  },
});

/** Internal: validate an enrollment code. Returns { valid: true, slotId } or { valid: false, reason }. */
export const validateEnrollmentCode = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const slot = await ctx.db
      .query("deviceSlots")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!slot) return { valid: false as const, reason: "not_found" as const };
    if (slot.usedAt !== undefined)
      return { valid: false as const, reason: "used" as const };
    if (slot.expiresAt < Date.now())
      return { valid: false as const, reason: "expired" as const };
    return { valid: true as const, slotId: slot._id };
  },
});

/** Internal: mark slot used, upsert device row, store device key hash. */
export const completeRegistration = internalMutation({
  args: {
    slotId: v.id("deviceSlots"),
    deviceId: v.string(),
    hostname: v.string(),
    windowsUser: v.string(),
    agentVersion: v.string(),
    keyHash: v.string(),
  },
  handler: async (
    ctx,
    { slotId, deviceId, hostname, windowsUser, agentVersion, keyHash },
  ) => {
    const now = Date.now();
    await ctx.db.patch(slotId, { usedAt: now, usedByDeviceId: deviceId });

    const existing = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        hostname,
        lastWindowsUser: windowsUser,
        agentVersion,
        lastSeen: now,
      });
    } else {
      await ctx.db.insert("devices", {
        deviceId,
        hostname,
        lastWindowsUser: windowsUser,
        status: "pending",
        lastSeen: now,
        agentVersion,
      });
    }

    // Replace any old device key on re-enrollment
    const oldKey = await ctx.db
      .query("deviceKeys")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (oldKey) await ctx.db.delete(oldKey._id);

    await ctx.db.insert("deviceKeys", {
      deviceId,
      keyHash,
      createdAt: now,
    });
  },
});

/** Internal: resolve a key hash to its deviceId (null if not found or disabled). */
export const lookupDeviceByKeyHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) => {
    const entry = await ctx.db
      .query("deviceKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
      .unique();
    if (!entry) return null;
    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", entry.deviceId))
      .unique();
    if (!device || device.status === "disabled") return null;
    return { deviceId: entry.deviceId };
  },
});
