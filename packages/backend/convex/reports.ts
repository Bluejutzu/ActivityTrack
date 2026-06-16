import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireViewer } from "./rbac";

/**
 * Read models for the cross-device Reports page. Returns each active device's
 * daily rollups over a [startDay, endDay] window joined to its person, so the
 * client can group them into weeks (or any other time frame) and filter.
 *
 * Viewer+, same as the other dashboard reads — visibility is universal; extra
 * capabilities are about mutations, not what you can see.
 */

/** Per-device daily stats across a date range, for every active device. */
export const weeklyOverview = query({
  args: {
    startDay: v.string(), // YYYY-MM-DD inclusive
    endDay: v.string(), // YYYY-MM-DD inclusive
  },
  handler: async (ctx, { startDay, endDay }) => {
    await requireViewer(ctx);

    const devices = await ctx.db
      .query("devices")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Batch-load linked people once (mirrors stats.teamOverview).
    const personIds = [
      ...new Set(devices.flatMap((d) => (d.personId ? [d.personId] : []))),
    ];
    const peopleById = new Map(
      (await Promise.all(personIds.map((id) => ctx.db.get(id)))).flatMap((p) =>
        p ? [[p._id, p] as const] : [],
      ),
    );

    return await Promise.all(
      devices.map(async (device) => {
        const person = device.personId
          ? (peopleById.get(device.personId) ?? null)
          : null;
        const daily = await ctx.db
          .query("dailyStats")
          .withIndex("by_device_day", (q) =>
            q
              .eq("deviceId", device.deviceId)
              .gte("day", startDay)
              .lte("day", endDay),
          )
          .collect();
        return {
          deviceId: device.deviceId,
          hostname: device.hostname,
          personId: device.personId ?? null,
          personName: person?.name ?? null,
          windowsUser: device.lastWindowsUser ?? null,
          lastSeen: device.lastSeen,
          // Trimmed daily rows — only what the client needs to roll up.
          daily: daily.map((d) => ({
            day: d.day,
            activeSeconds: d.activeSeconds,
            idleSeconds: d.idleSeconds,
          })),
        };
      }),
    );
  },
});
