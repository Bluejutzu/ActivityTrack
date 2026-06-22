import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireViewer, requireManager, requireAdmin } from "./rbac";
import { writeAudit } from "./audit";
import { appError } from "./errors";
import { apiTokens, assertSignalSecret } from "./deviceAuth";
import { hashNonce, safeEqual } from "./crypto";

/** All devices with their linked person's name (if any). Viewer+. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    // Defensive cap: fine for the current ~10-device scale, but bounds the query
    // (and the dashboard payload) if the fleet ever grows unexpectedly large.
    const devices = await ctx.db.query("devices").take(2000);

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

/**
 * Approve a device so it can claim its token and its data counts. IT-only.
 * Clears `tokenIssued` so a freshly approved (or re-approved after disable)
 * device mints a new token on its next poll — see `claimToken`.
 */
export const approve = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const actor = await requireAdmin(ctx);
    const device = await ctx.db.get(deviceId);
    if (!device) throw appError("notFound.device", "Device not found");
    await ctx.db.patch(deviceId, { status: "active", tokenIssued: false });
    await writeAudit(ctx, actor._id, "device.approve", device.hostname);
  },
});

/**
 * Disable a device. IT-only. Revokes its token immediately
 * (`apiTokens.invalidateAll`), so ingest/heartbeat start returning 401 even
 * though the agent still holds the now-dead token locally.
 */
export const disable = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const actor = await requireAdmin(ctx);
    const device = await ctx.db.get(deviceId);
    if (!device) throw appError("notFound.device", "Device not found");
    await ctx.db.patch(deviceId, { status: "disabled", tokenIssued: false });
    await apiTokens.invalidateAll(ctx, { namespace: device.deviceId });
    await writeAudit(ctx, actor._id, "device.disable", device.hostname);
  },
});

/**
 * Permanently delete a device. IT-only. Revokes its token first
 * (`apiTokens.invalidateAll`, while we still hold `device.deviceId`) so any
 * agent still polling starts getting 401s, then removes the row. Unlike
 * `disable` this is irreversible: a deleted device must re-enroll from scratch.
 */
export const remove = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const actor = await requireAdmin(ctx);
    const device = await ctx.db.get(deviceId);
    if (!device) throw appError("notFound.device", "Device not found");
    await apiTokens.invalidateAll(ctx, { namespace: device.deviceId });
    await ctx.db.delete(deviceId);
    await writeAudit(ctx, actor._id, "device.remove", device.hostname);
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

/**
 * Self-registration from the desktop agent, called server-to-server from the
 * Elysia API layer (POST /api/agent/register). The agent has no shared secret —
 * it announces its `deviceId` plus a locally-generated one-time pairing nonce,
 * landing in the pending queue for an admin to approve. Deliberately minimal and
 * idempotent (one row per deviceId) and hands nothing sensitive back: the token
 * only exists after approval, via `claimToken`.
 */
export const requestEnrollment = mutation({
  args: {
    secret: v.string(),
    deviceId: v.string(),
    hostname: v.string(),
    windowsUser: v.string(),
    agentVersion: v.string(),
    claimNonce: v.string(),
  },
  handler: async (
    ctx,
    { secret, deviceId, hostname, windowsUser, agentVersion, claimNonce },
  ) => {
    assertSignalSecret(secret);
    const now = Date.now();
    const claimNonceHash = await hashNonce(claimNonce);
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();

    if (!existing) {
      await ctx.db.insert("devices", {
        deviceId,
        hostname,
        lastWindowsUser: windowsUser,
        agentVersion,
        status: "pending",
        lastSeen: now,
        claimNonceHash,
        tokenIssued: false,
      });
      return { status: "pending" as const };
    }

    // An already-paired device shouldn't be re-registering; a stray call must not
    // knock it back to pending. Just refresh its liveness fields.
    if (existing.status === "active" && existing.tokenIssued) {
      await ctx.db.patch(existing._id, {
        hostname,
        lastWindowsUser: windowsUser,
        agentVersion,
        lastSeen: now,
      });
      return { status: "active" as const };
    }

    // Pending, disabled, or approved-but-not-yet-claimed: accept a fresh nonce so
    // a (re-)approval can mint a token. Status is preserved — only an admin moves
    // a device between pending/active/disabled.
    await ctx.db.patch(existing._id, {
      hostname,
      lastWindowsUser: windowsUser,
      agentVersion,
      lastSeen: now,
      claimNonceHash,
    });
    return { status: existing.status };
  },
});

/**
 * The agent polls this (server-to-server via Elysia, POST /api/agent/poll) with
 * its deviceId + pairing nonce until an admin approves it. On the first poll
 * after approval we mint the device's token and return it ONCE — it is never
 * stored in plaintext, so this is the agent's only chance to capture it.
 */
export const claimToken = mutation({
  args: { secret: v.string(), deviceId: v.string(), claimNonce: v.string() },
  handler: async (ctx, { secret, deviceId, claimNonce }) => {
    assertSignalSecret(secret);
    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!device) return { status: "unknown" as const };

    const claimNonceHash = await hashNonce(claimNonce);
    if (!device.claimNonceHash || !safeEqual(device.claimNonceHash, claimNonceHash)) {
      // Wrong machine for this deviceId — don't leak status.
      return { status: "denied" as const };
    }

    if (device.status === "pending") return { status: "pending" as const };
    if (device.status === "disabled") return { status: "disabled" as const };

    // Approved. Mint exactly once; a lost token requires disable + re-approve.
    if (device.tokenIssued) {
      return { status: "active" as const, token: null };
    }
    const { token } = await apiTokens.create(ctx, { namespace: deviceId });
    await ctx.db.patch(device._id, { tokenIssued: true, lastSeen: Date.now() });
    return { status: "active" as const, token };
  },
});
