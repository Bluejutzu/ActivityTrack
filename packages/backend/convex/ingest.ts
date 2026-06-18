import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { readConfig } from "./settings";

/**
 * Server-side persistence for agent samples. This is the ONLY place samples
 * become durable, and it is an internal mutation — reachable only from the
 * authenticated `/ingest` HTTP action (see http.ts), never from clients.
 *
 * Responsibilities:
 *   - Auto-register unknown devices as `pending`; refresh known ones.
 *   - Silently drop samples from `disabled` devices (still 200 to the agent;
 *     the agent is a dumb sender and shouldn't care).
 *   - Append raw samples to `activitySamples`.
 *   - Incrementally accrue active/idle seconds into `dailyStats`, attributing
 *     the wall-clock gap since the device's previous sample to active or idle.
 */

// Largest gap (ms) we'll attribute to a single sample. Bounds the damage from a
// device that was offline for hours then dumps a backlog, or a clock jump.
const MAX_ATTRIBUTION_MS = 120_000;
// Nominal interval credited to the first-ever sample from a device (≈ poll).
const NOMINAL_FIRST_MS = 15_000;

const sampleValidator = v.object({
  deviceId: v.string(),
  windowsUser: v.string(),
  hostname: v.string(),
  idleMs: v.number(),
  active: v.boolean(),
  capturedAt: v.number(),
  tzOffsetMinutes: v.number(),
  agentVersion: v.string(),
  platform: v.string(),
});

/** YYYY-MM-DD for an epoch ms instant, in the device's local timezone. */
function localDay(capturedAt: number, tzOffsetMinutes: number): string {
  const localMs = capturedAt - tzOffsetMinutes * 60_000;
  return new Date(localMs).toISOString().slice(0, 10);
}

export const recordSamples = internalMutation({
  args: {
    samples: v.array(sampleValidator),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { samples, orgId }) => {
    const receivedAt = Date.now();
    // Idle→inactive threshold (Settings → Configuration). Daily active/idle
    // accrual is derived from each sample's idleMs against this, so changing it
    // reshapes the rollups going forward.
    const inactivityMs =
      (await readConfig(ctx)).inactivityThresholdSeconds * 1000;

    // Process per device, oldest sample first, so gap attribution is correct.
    const byDevice = new Map<string, typeof samples>();
    for (const s of samples) {
      const list = byDevice.get(s.deviceId) ?? [];
      list.push(s);
      byDevice.set(s.deviceId, list);
    }

    let inserted = 0;
    for (const [deviceId, deviceSamples] of byDevice) {
      deviceSamples.sort((a, b) => a.capturedAt - b.capturedAt);

      let device = await getDevice(ctx, deviceId);
      // Disabled devices are ignored entirely (no rows written).
      if (device && device.status === "disabled") continue;

      // Running cursor for gap attribution within this batch.
      let prevCapturedAt = device?.lastSeen;

      for (const s of deviceSamples) {
        await ctx.db.insert("activitySamples", { ...s, orgId, receivedAt });
        inserted++;

        // Attribute elapsed wall-clock time to active or idle.
        const rawGap =
          prevCapturedAt === undefined
            ? NOMINAL_FIRST_MS
            : s.capturedAt - prevCapturedAt;
        const gapMs = Math.max(0, Math.min(rawGap, MAX_ATTRIBUTION_MS));
        prevCapturedAt = s.capturedAt;

        await accrueDaily(ctx, orgId, deviceId, s, gapMs, inactivityMs);
      }

      // Upsert the device row from the newest sample we saw.
      const newest = deviceSamples[deviceSamples.length - 1]!;
      if (device) {
        await ctx.db.patch(device._id, {
          orgId,
          hostname: newest.hostname,
          lastWindowsUser: newest.windowsUser,
          lastSeen: Math.max(device.lastSeen, newest.capturedAt),
          agentVersion: newest.agentVersion,
          // A previously-pending device stays pending until an admin approves.
          status: device.status,
        });
      } else {
        await ctx.db.insert("devices", {
          deviceId,
          orgId,
          hostname: newest.hostname,
          lastWindowsUser: newest.windowsUser,
          status: "pending",
          lastSeen: newest.capturedAt,
          agentVersion: newest.agentVersion,
        });
      }
    }

    return { inserted };
  },
});

async function getDevice(
  ctx: MutationCtx,
  deviceId: string,
): Promise<Doc<"devices"> | null> {
  return await ctx.db
    .query("devices")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
}

async function accrueDaily(
  ctx: MutationCtx,
  orgId: Doc<"devices">["orgId"],
  deviceId: string,
  sample: { idleMs: number; capturedAt: number; tzOffsetMinutes: number },
  gapMs: number,
  inactivityMs: number,
): Promise<void> {
  const day = localDay(sample.capturedAt, sample.tzOffsetMinutes);
  const seconds = gapMs / 1000;
  // Count the interval as active when the sample's idle time is under the
  // configured inactivity threshold; otherwise idle.
  const isActive = sample.idleMs < inactivityMs;
  const activeDelta = isActive ? seconds : 0;
  const idleDelta = isActive ? 0 : seconds;

  const existing = await ctx.db
    .query("dailyStats")
    .withIndex("by_device_day", (q) =>
      q.eq("deviceId", deviceId).eq("day", day),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      activeSeconds: existing.activeSeconds + activeDelta,
      idleSeconds: existing.idleSeconds + idleDelta,
      firstSeen: Math.min(existing.firstSeen, sample.capturedAt),
      lastSeen: Math.max(existing.lastSeen, sample.capturedAt),
    });
  } else {
    await ctx.db.insert("dailyStats", {
      orgId,
      deviceId,
      day,
      activeSeconds: activeDelta,
      idleSeconds: idleDelta,
      firstSeen: sample.capturedAt,
      lastSeen: sample.capturedAt,
    });
  }
}
