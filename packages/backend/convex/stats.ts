import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireViewer } from "./rbac";
import type { QueryCtx } from "./_generated/server";

/**
 * Read models for the dashboard. All gated at viewer+; managers/admins use the
 * same data (extra capabilities are about mutations, not visibility).
 */

// A device is "online" if we've heard from it within this window. flush=30s,
// poll=15s by default, so ~3 missed flushes.
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function localDay(at: number, tzOffsetMinutes: number): string {
  return new Date(at - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Latest sample for a device, or null. */
async function latestSample(ctx: QueryCtx, deviceId: string) {
  return await ctx.db
    .query("activitySamples")
    .withIndex("by_device_time", (q) => q.eq("deviceId", deviceId))
    .order("desc")
    .first();
}

/**
 * Team overview: every approved device, who it belongs to, whether the person
 * is active right now, and how much active time they've logged today (their
 * local day). Powers the "Working (3h 42m today)" cards.
 */
export const teamOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    const now = Date.now();

    const devices = await ctx.db
      .query("devices")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return Promise.all(
      devices.map(async (device) => {
        const person = device.personId ? await ctx.db.get(device.personId) : null;
        const latest = await latestSample(ctx, device.deviceId);
        const tzOffset = latest?.tzOffsetMinutes ?? 0;
        const day = localDay(now, tzOffset);

        const stats = await ctx.db
          .query("dailyStats")
          .withIndex("by_device_day", (q) =>
            q.eq("deviceId", device.deviceId).eq("day", day),
          )
          .unique();

        const online = now - device.lastSeen < ONLINE_THRESHOLD_MS;
        const active = online && (latest?.active ?? false);

        return {
          deviceDocId: device._id,
          deviceId: device.deviceId,
          hostname: device.hostname,
          personId: device.personId ?? null,
          personName: person?.name ?? null,
          windowsUser: device.lastWindowsUser,
          online,
          active,
          idleMs: latest?.idleMs ?? null,
          lastSeen: device.lastSeen,
          todayActiveSeconds: stats?.activeSeconds ?? 0,
          todayIdleSeconds: stats?.idleSeconds ?? 0,
        };
      }),
    );
  },
});

/** Daily stats for one device across a [startDay, endDay] inclusive range. */
export const dailyRange = query({
  args: {
    deviceId: v.string(),
    startDay: v.string(), // YYYY-MM-DD
    endDay: v.string(),
  },
  handler: async (ctx, { deviceId, startDay, endDay }) => {
    await requireViewer(ctx);
    return await ctx.db
      .query("dailyStats")
      .withIndex("by_device_day", (q) =>
        q.eq("deviceId", deviceId).gte("day", startDay).lte("day", endDay),
      )
      .collect();
  },
});

/** Recent raw samples for a device (per-person timeline). Capped. */
export const recentSamples = query({
  args: {
    deviceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { deviceId, limit }) => {
    await requireViewer(ctx);
    return await ctx.db
      .query("activitySamples")
      .withIndex("by_device_time", (q) => q.eq("deviceId", deviceId))
      .order("desc")
      .take(Math.min(limit ?? 200, 1000));
  },
});
